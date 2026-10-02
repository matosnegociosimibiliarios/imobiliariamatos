import { createClient } from '@supabase/supabase-js';
import { db, getSupabaseAdminConfig, requireAdmin } from './_meta.js';

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanRole(value) {
  const role = String(value || '').trim();
  return ['admin', 'broker', 'assistant'].includes(role) ? role : 'assistant';
}

function getAdminClient() {
  const { url, key } = getSupabaseAdminConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

async function sendInviteEmail({ email, fullName, organizationName, replyTo, actionLink }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Serviço de e-mail ainda não configurado.');

  const safeOrg = escapeHtml(organizationName || 'CRM Imobiliário');
  const safeName = escapeHtml(fullName);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${organizationName || 'CRM Imobiliário'} <onboarding@resend.dev>`,
      to: [email],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `Convite para acessar o CRM - ${organizationName || 'Imobiliária'}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202124"><h2>Convite para o CRM</h2><p>Olá, ${safeName}.</p><p>Você foi convidado(a) pela <strong>${safeOrg}</strong> para fazer parte da equipe no CRM.</p><p style="margin:28px 0"><a href="${escapeHtml(actionLink)}" style="background:#111827;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Criar senha e acessar o CRM</a></p><p style="font-size:13px;color:#666">Se você não esperava este convite, ignore este e-mail.</p></div>`,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Não foi possível enviar o e-mail de convite.');
  return payload;
}

async function findUserByEmail(client, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((item) => String(item.email || '').toLowerCase() === email);
    if (found) return found;
    if (users.length < 200) break;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const actor = await requireAdmin(req, 'team.manage');
    const email = cleanEmail(req.body?.email);
    const fullName = String(req.body?.full_name || '').trim();
    const role = cleanRole(req.body?.role);

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (!fullName) return res.status(400).json({ error: 'Informe o nome do usuário.' });

    let organizationId = actor.membership?.organization_id || null;
    const actorRole = actor.membership?.role || (actor.profile?.role === 'admin' ? 'owner' : null);

    if (!organizationId && actor.profile?.role === 'admin') {
      const orgs = await db('organizations?select=id&slug=eq.matos-negocios-imobiliarios&limit=1');
      organizationId = orgs?.[0]?.id || null;
    }

    if (!organizationId) return res.status(400).json({ error: 'Organização não encontrada.' });
    if (role === 'admin' && !['owner', 'admin'].includes(actorRole)) {
      return res.status(403).json({ error: 'Você não pode criar administradores.' });
    }

    const client = getAdminClient();
    let user = await findUserByEmail(client, email);
    const existing = Boolean(user);

    if (!user) {
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'imobiliariamatos.vercel.app';
      const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
      const redirectTo = `${protocol}://${host}/convite`;

      const orgRows = await db(`organizations?select=id,name,email_sender_name,email_reply_to&id=eq.${encodeURIComponent(organizationId)}&limit=1`);
      const org = orgRows?.[0] || {};
      const { data, error } = await client.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          data: { full_name: fullName },
          redirectTo,
        },
      });
      if (error) throw error;
      user = data?.user || null;
      const actionLink = data?.properties?.action_link;
      if (!actionLink) throw new Error('Não foi possível gerar o link seguro do convite.');
      await sendInviteEmail({
        email,
        fullName,
        organizationName: org.email_sender_name || org.name,
        replyTo: org.email_reply_to,
        actionLink,
      });
    }

    const userId = user?.id;
    if (!userId) throw new Error('O Supabase não devolveu o identificador do usuário convidado.');

    const existingProfiles = await db(`profiles?select=id,role&id=eq.${encodeURIComponent(userId)}&limit=1`);
    const globalRole = existingProfiles?.[0]?.role === 'admin' ? 'admin' : 'user';

    await db('profiles?on_conflict=id', {
      method: 'POST',
      body: {
        id: userId,
        full_name: fullName,
        email,
        role: globalRole,
        updated_at: new Date().toISOString(),
      },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });

    await db('organization_members?on_conflict=organization_id,user_id', {
      method: 'POST',
      body: {
        organization_id: organizationId,
        user_id: userId,
        role,
        status: 'active',
        invited_by: actor.id,
        joined_at: existing ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });

    return res.status(200).json({ ok: true, existing, user_id: userId });
  } catch (error) {
    console.error('team-invite', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao convidar usuário.' });
  }
}
