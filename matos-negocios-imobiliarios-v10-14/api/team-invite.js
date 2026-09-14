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

      const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo,
      });
      if (error) throw error;
      user = data?.user || null;
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
