import crypto from 'node:crypto';
import { db, supabaseRpc, requireAdmin, readRawBody, verifyMetaSignature, GRAPH_VERSION } from './_meta.js';

const SCOPES = ['instagram_business_basic', 'instagram_business_manage_messages'];

function instagramAppId() {
  return process.env.META_INSTAGRAM_APP_ID || process.env.META_APP_ID || '1441246188102008';
}
function instagramAppSecret() {
  return process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
}
function redirectUri(req) {
  return process.env.META_INSTAGRAM_REDIRECT_URI || 'https://imobiliariamatos.vercel.app/api/instagram-callback';
}
function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}
function safeError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function startInstagramOAuth(req, res) {
  try {
    const admin = await requireAdmin(req, 'integrations.manage');
    const organizationId = admin.membership?.organization_id;
    if (!organizationId) throw safeError('Não foi possível identificar a imobiliária ativa.', 403);

    const requestedUsername = normalizeUsername(req.query.username || '');
    const state = crypto.randomBytes(32).toString('hex');

    await db('meta_oauth_states', {
      method: 'POST',
      body: {
        state,
        organization_id: organizationId,
        user_id: admin.id,
        requested_username: requestedUsername || null,
        provider: 'instagram',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
      prefer: 'return=minimal',
    });

    const secret = instagramAppSecret();
    if (!secret) throw safeError('Instagram App Secret não configurado no servidor.', 500);

    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', instagramAppId());
    url.searchParams.set('redirect_uri', redirectUri(req));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('state', state);
    url.searchParams.set('force_reauth', '1');

    res.status(200).json({ url: url.toString() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Não foi possível iniciar a conexão do Instagram.' });
  }
}

async function exchangeShortLivedToken(code, req) {
  const secret = instagramAppSecret();
  if (!secret) throw safeError('Instagram App Secret não configurado no servidor.', 500);

  const body = new URLSearchParams({
    client_id: instagramAppId(),
    client_secret: secret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(req),
    code,
  });

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error || !data.access_token) {
    throw safeError(data.error_message || data.error?.message || 'A Meta não aceitou o código de autorização do Instagram.', 400);
  }
  return data;
}

async function exchangeLongLivedToken(shortToken) {
  const secret = instagramAppSecret();
  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', secret);
  url.searchParams.set('access_token', shortToken);

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error || !data.access_token) {
    throw safeError(data.error?.message || 'Não foi possível obter o token de longa duração do Instagram.', 400);
  }
  return data;
}

async function getInstagramProfile(token) {
  const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/me`);
  url.searchParams.set('fields', 'id,user_id,username,name,account_type');
  url.searchParams.set('access_token', token);
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error || !(data.id || data.user_id)) {
    throw safeError(data.error?.message || 'Não foi possível identificar a conta do Instagram autorizada.', 400);
  }
  return data;
}

async function subscribeInstagramWebhooks(token) {
  const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/me/subscribed_apps`);
  url.searchParams.set('subscribed_fields', 'messages,messaging_seen');
  url.searchParams.set('access_token', token);
  const response = await fetch(url, { method: 'POST' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error || data.success !== true) {
    throw safeError(data.error?.message || 'A conta foi autorizada, mas a assinatura do webhook do Instagram falhou.', 502);
  }
  return data;
}

export async function instagramOAuthCallback(req, res) {
  try {
    const { code, state, error: oauthError, error_description: oauthDescription } = req.query;
    if (oauthError) {
      const message = encodeURIComponent(oauthDescription || 'A autorização do Instagram foi cancelada.');
      res.redirect(`/admin/integracoes?instagram=error&message=${message}`);
      return;
    }
    if (!state || !code) throw safeError('Retorno do Instagram sem código ou state.', 400);

    const states = await db(
      `meta_oauth_states?select=id,organization_id,user_id,requested_username,expires_at,consumed_at&state=eq.${encodeURIComponent(state)}&provider=eq.instagram&limit=1`
    );
    const oauthState = states?.[0];
    if (!oauthState || oauthState.consumed_at || new Date(oauthState.expires_at).getTime() < Date.now()) {
      throw safeError('A sessão de conexão do Instagram expirou. Inicie a conexão novamente.', 400);
    }

    await db(`meta_oauth_states?id=eq.${encodeURIComponent(oauthState.id)}`, {
      method: 'PATCH',
      body: { consumed_at: new Date().toISOString() },
      prefer: 'return=minimal',
    });

    const short = await exchangeShortLivedToken(code, req);
    const long = await exchangeLongLivedToken(short.access_token);
    const profile = await getInstagramProfile(long.access_token);
    const instagramUserId = String(profile.user_id || profile.id);
    const username = normalizeUsername(profile.username);

    if (oauthState.requested_username && oauthState.requested_username !== username) {
      throw safeError(`A conta autorizada é @${username}, mas foi solicitado @${oauthState.requested_username}.`, 409);
    }

    const expiresIn = Number(long.expires_in || 0);
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    const existing = await supabaseRpc('get_meta_instagram_connection_by_user_id', {
      p_instagram_user_id: instagramUserId,
    });

    if (existing?.[0]?.organization_id && existing[0].organization_id !== oauthState.organization_id) {
      throw safeError(`O Instagram @${username} já está conectado a outra imobiliária.`, 409);
    }

    const subscribed = await subscribeInstagramWebhooks(long.access_token);

    await supabaseRpc('store_meta_instagram_connection', {
      p_organization_id: oauthState.organization_id,
      p_instagram_user_id: instagramUserId,
      p_username: username,
      p_account_type: profile.account_type || null,
      p_access_token: long.access_token,
      p_scopes: String(short.permissions || SCOPES.join(',')).split(',').map((item) => item.trim()).filter(Boolean),
      p_token_expires_at: expiresAt,
      p_metadata: {
        name: profile.name || null,
        subscription: subscribed,
        connected_via: 'instagram_business_login',
      },
    });

    await db('integration_events', {
      method: 'POST',
      body: {
        platform: 'meta',
        event_type: 'instagram_connected',
        status: 'received',
        organization_id: oauthState.organization_id,
        metadata: { instagram_user_id: instagramUserId, username, account_type: profile.account_type || null },
      },
      prefer: 'return=minimal',
    });

    res.redirect('/admin/integracoes?instagram=connected');
  } catch (error) {
    const message = encodeURIComponent(error.message || 'Não foi possível conectar o Instagram.');
    res.redirect(`/admin/integracoes?instagram=error&message=${message}`);
  }
}

export async function getInstagramConnectionForOrganization(organizationId) {
  const rows = await supabaseRpc('get_meta_instagram_connection', {
    p_organization_id: organizationId,
  });
  return Array.isArray(rows) ? (rows[0] || null) : rows || null;
}

export async function getInstagramConnectionByUserId(instagramUserId) {
  const rows = await supabaseRpc('get_meta_instagram_connection_by_user_id', {
    p_instagram_user_id: instagramUserId,
  });
  return Array.isArray(rows) ? (rows[0] || null) : rows || null;
}

export async function sendInstagramTextForOrganization(organizationId, recipientId, text) {
  const connection = await getInstagramConnectionForOrganization(organizationId);
  if (!connection?.access_token || !connection?.instagram_user_id) {
    throw safeError('Instagram não conectado para esta imobiliária.', 409);
  }

  const response = await fetch(
    `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(connection.instagram_user_id)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient: { id: String(recipientId) }, message: { text: String(text) } }),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw safeError(data.error?.message || 'Instagram recusou o envio da mensagem.', 400);
  return data;
}

function normalizeTimestamp(timestamp) {
  return timestamp ? new Date(Number(timestamp)).toISOString() : new Date().toISOString();
}

export async function upsertInstagramDirectLeadForOrganization({
  organizationId,
  senderId,
  messageId,
  text,
  timestamp,
  metadata = {},
}) {
  const when = normalizeTimestamp(timestamp);
  const existing = await db(
    `leads?select=id,name,status,external_metadata&organization_id=eq.${encodeURIComponent(organizationId)}&source_platform=eq.instagram&source_channel=eq.direct&external_contact_id=eq.${encodeURIComponent(senderId)}&limit=1`
  );
  let lead;
  if (existing?.length) {
    const rows = await db(`leads?id=eq.${encodeURIComponent(existing[0].id)}&organization_id=eq.${encodeURIComponent(organizationId)}`, {
      method: 'PATCH',
      body: {
        last_inbound_message: text,
        last_inbound_at: when,
        last_source_platform: 'instagram',
        last_source_channel: 'direct',
        last_source_detail: 'Instagram Direct',
        last_source_at: when,
        updated_at: new Date().toISOString(),
        external_metadata: { ...(existing[0].external_metadata || {}), instagram: metadata },
      },
      prefer: 'return=representation',
    });
    lead = rows?.[0] || existing[0];
  } else {
    const rows = await db('leads', {
      method: 'POST',
      body: {
        organization_id: organizationId,
        name: `Contato Instagram ${String(senderId).slice(-6)}`,
        message: text,
        source: 'instagram',
        source_detail: 'Direct do Instagram',
        source_platform: 'instagram',
        source_channel: 'direct',
        initial_source_platform: 'instagram',
        initial_source_channel: 'direct',
        initial_source_detail: 'Instagram Direct',
        last_source_platform: 'instagram',
        last_source_channel: 'direct',
        last_source_detail: 'Instagram Direct',
        last_source_at: when,
        external_contact_id: String(senderId),
        last_inbound_message: text,
        last_inbound_at: when,
        status: 'new',
        external_metadata: { instagram: metadata },
      },
      prefer: 'return=representation',
    });
    lead = rows?.[0];
  }

  if (lead?.id) {
    await db('social_messages?on_conflict=platform,external_message_id', {
      method: 'POST',
      body: {
        organization_id: organizationId,
        lead_id: lead.id,
        platform: 'instagram',
        channel: 'direct',
        external_message_id: messageId || null,
        external_sender_id: String(senderId),
        external_recipient_id: metadata?.recipient_id || null,
        direction: 'inbound',
        message_text: text,
        sent_at: when,
        delivery_status: 'received',
        metadata,
      },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });
  }
  return lead;
}

export async function storeInstagramOutboundEchoForOrganization({
  organizationId,
  recipientId,
  messageId,
  text,
  timestamp,
  metadata = {},
}) {
  const existing = await db(
    `leads?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&source_platform=eq.instagram&source_channel=eq.direct&external_contact_id=eq.${encodeURIComponent(recipientId)}&limit=1`
  );
  if (!existing?.length) return null;
  await db('social_messages?on_conflict=platform,external_message_id', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      lead_id: existing[0].id,
      platform: 'instagram',
      channel: 'direct',
      external_message_id: messageId || null,
      external_sender_id: null,
      external_recipient_id: String(recipientId),
      direction: 'outbound',
      message_text: text,
      sent_at: normalizeTimestamp(timestamp),
      delivery_status: 'sent',
      metadata,
    },
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });
  return existing[0];
}

export async function touchInstagramWebhook(instagramUserId) {
  await supabaseRpc('touch_meta_instagram_webhook', { p_instagram_user_id: instagramUserId });
}
