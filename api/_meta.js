import crypto from 'node:crypto';

export const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v26.0';

export function envStatus(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'imobiliariamatos.vercel.app';
  return {
    supabase_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    webhook_verify_token: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN),
    meta_app_secret: Boolean(process.env.META_APP_SECRET),
    instagram_access_token: Boolean(process.env.META_INSTAGRAM_ACCESS_TOKEN),
    lead_ads_access_token: Boolean(process.env.META_LEAD_ADS_ACCESS_TOKEN),
    instagram_user_id: Boolean(process.env.META_INSTAGRAM_USER_ID),
    whatsapp_access_token: Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN),
    whatsapp_phone_number_id: Boolean(process.env.META_WHATSAPP_PHONE_NUMBER_ID),
    whatsapp_business_account_id: Boolean(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID),
    webhook_url: `https://${host}/api/meta-webhook`,
    graph_version: GRAPH_VERSION,
  };
}

export function getSupabaseAdminConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ou URL do Supabase não configurados.');
  return { url: url.replace(/\/+$/, ''), key };
}

export async function db(path, { method='GET', body=null, prefer=null } = {}) {
  const { url, key } = getSupabaseAdminConfig();
  const headers = { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' };
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${url}/rest/v1/${path}`, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function logIntegration(eventType, { externalEventId=null, status='received', errorMessage=null, metadata={} } = {}) {
  try {
    await db('integration_events', { method:'POST', body:{ platform:'meta', event_type:eventType, external_event_id:externalEventId, status, error_message:errorMessage, metadata }, prefer:'return=minimal' });
  } catch (error) { console.error('Falha ao registrar integration_event', error); }
}

export async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export function verifyMetaSignature(rawBody, signature) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;
  if (!signature || !signature.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

export async function graphGet(idOrPath, token, fields=null) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${idOrPath}`);
  if (fields) url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', token);
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || `Graph API ${response.status}`);
  return data;
}



const SERVER_ROLE_PERMISSIONS = {
  owner: { all: true },
  admin: { all: true },
  broker: {
    'dashboard.view': true,
    'management.view': true,
    'reports.view': true,
    'analytics.view': true,
    'properties.view': true,
    'properties.manage': true,
    'leads.view': true,
    'leads.manage': true,
    'appointments.view': true,
    'appointments.manage': true,
    'captures.view': true,
    'captures.manage': true,
    'proposals.view': true,
    'proposals.manage': true,
    'deals.view': true,
    'deals.manage': true,
    'documents.view': true,
    'documents.manage': true,
    'messages.view': true,
    'messages.respond': true,
    'team.view': true,
  },
  assistant: {
    'dashboard.view': true,
    'properties.view': true,
    'leads.view': true,
    'leads.manage': true,
    'appointments.view': true,
    'appointments.manage': true,
    'captures.view': true,
    'captures.manage': true,
    'proposals.view': true,
    'documents.view': true,
    'documents.manage': true,
    'messages.view': true,
    'messages.respond': true,
    'team.view': true,
  },
};

function memberHasPermission(member, permission) {
  if (!permission) return true;
  const custom = member?.permissions || {};
  if (Object.prototype.hasOwnProperty.call(custom, permission)) return Boolean(custom[permission]);
  const rolePermissions = SERVER_ROLE_PERMISSIONS[member?.role] || {};
  return Boolean(rolePermissions.all || rolePermissions[permission]);
}

export async function requireAdmin(req, permission = null) {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Sessão administrativa não recebida. Faça login novamente se o problema persistir.');
    error.statusCode = 401;
    throw error;
  }

  const { url, key } = getSupabaseAdminConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${match[1]}`,
    },
  });

  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) {
    const error = new Error('Sessão inválida ou expirada.');
    error.statusCode = 401;
    throw error;
  }

  const profiles = await db(
    `profiles?select=id,role,full_name,email&id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const profile = profiles?.[0] || null;

  // Compatibilidade com o administrador criado antes da camada de equipe.
  if (profile?.role === 'admin' && !permission) return { ...user, profile, membership: null };

  const memberships = await db(
    `organization_members?select=id,organization_id,user_id,role,status,permissions&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`
  );
  const membership = memberships?.[0] || null;

  if (!membership && profile?.role !== 'admin') {
    const error = new Error('Acesso não autorizado.');
    error.statusCode = 403;
    throw error;
  }

  if (permission && profile?.role !== 'admin' && !memberHasPermission(membership, permission)) {
    const error = new Error('Seu perfil não possui permissão para esta ação.');
    error.statusCode = 403;
    throw error;
  }

  return { ...user, profile, membership };
}

export async function sendInstagramText(recipientId, text) {
  const token = process.env.META_INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.META_INSTAGRAM_USER_ID;

  if (!token || !igUserId) {
    throw new Error('Instagram não configurado no servidor.');
  }

  const response = await fetch(
    `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(igUserId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: String(recipientId) },
        message: { text: String(text) },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const error = new Error(
      data.error?.message || `Instagram API ${response.status}`
    );
    error.statusCode = 400;
    error.metaError = data.error || null;
    throw error;
  }

  return data;
}

export async function storeInstagramOutboundEcho({
  recipientId,
  messageId,
  text,
  timestamp,
  metadata = {},
}) {
  if (!recipientId) return null;

  const existing = await db(
    `leads?select=id&source_platform=eq.instagram&source_channel=eq.direct&external_contact_id=eq.${encodeURIComponent(recipientId)}&limit=1`
  );

  if (!existing?.length) return null;

  const when = timestamp
    ? new Date(Number(timestamp)).toISOString()
    : new Date().toISOString();

  await db('social_messages?on_conflict=platform,external_message_id', {
    method: 'POST',
    body: {
      lead_id: existing[0].id,
      platform: 'instagram',
      channel: 'direct',
      external_message_id: messageId || null,
      external_sender_id: process.env.META_INSTAGRAM_USER_ID || null,
      external_recipient_id: String(recipientId),
      direction: 'outbound',
      message_text: text,
      sent_at: when,
      delivery_status: 'sent',
      metadata,
    },
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });

  return existing[0];
}

function normalizeString(value) { return value == null ? null : String(value).trim() || null; }

export async function upsertInstagramDirectLead({ senderId, messageId, text, timestamp, metadata={} }) {
  const existing = await db(`leads?select=id,name,status&source_platform=eq.instagram&source_channel=eq.direct&external_contact_id=eq.${encodeURIComponent(senderId)}&limit=1`);
  const when = timestamp ? new Date(Number(timestamp)).toISOString() : new Date().toISOString();
  let lead;
  if (existing?.length) {
    const rows = await db(`leads?id=eq.${existing[0].id}`, { method:'PATCH', body:{ last_inbound_message:text, last_inbound_at:when, last_source_platform:'instagram', last_source_channel:'direct', last_source_detail:'Instagram Direct', last_source_at:when, updated_at:new Date().toISOString(), external_metadata:metadata }, prefer:'return=representation' });
    lead = rows?.[0] || existing[0];
  } else {
    const rows = await db('leads', { method:'POST', body:{ name:`Contato Instagram ${String(senderId).slice(-6)}`, whatsapp:null, email:null, message:text, source:'instagram', source_detail:'Direct do Instagram', source_platform:'instagram', source_channel:'direct', initial_source_platform:'instagram', initial_source_channel:'direct', initial_source_detail:'Instagram Direct', last_source_platform:'instagram', last_source_channel:'direct', last_source_detail:'Instagram Direct', last_source_at:when, external_contact_id:senderId, last_inbound_message:text, last_inbound_at:when, status:'new', external_metadata:metadata }, prefer:'return=representation' });
    lead = rows?.[0];
  }

  if (lead?.id) {
    try {
      await db('social_messages?on_conflict=platform,external_message_id', { method:'POST', body:{ lead_id:lead.id, platform:'instagram', channel:'direct', external_message_id:messageId || null, external_sender_id:senderId, external_recipient_id:metadata?.recipient_id || null, direction:'inbound', message_text:text, sent_at:when, delivery_status:'received', metadata }, prefer:'resolution=ignore-duplicates,return=minimal' });
    } catch (error) { console.error('Falha ao salvar mensagem social', error); }
  }
  return lead;
}

function fieldValue(fieldData, names) {
  const found = (fieldData || []).find((item) => names.includes(item.name));
  const value = found?.values?.[0];
  return normalizeString(value);
}

export async function createLeadFromLeadAd({ leadgenId, pageId=null, formId=null, adId=null }) {
  const existing = await db(`leads?select=id&source_channel=eq.lead_ads&external_lead_id=eq.${encodeURIComponent(leadgenId)}&limit=1`);
  if (existing?.length) return existing[0];

  const token = process.env.META_LEAD_ADS_ACCESS_TOKEN;
  if (!token) throw new Error('META_LEAD_ADS_ACCESS_TOKEN não configurado.');

  const leadData = await graphGet(leadgenId, token, 'id,created_time,field_data,ad_id,form_id,platform');
  let adData = null;
  const finalAdId = leadData.ad_id || adId;
  if (finalAdId) {
    try { adData = await graphGet(finalAdId, token, 'id,name,adset{id,name},campaign{id,name}'); } catch (error) { console.warn('Não foi possível buscar dados do anúncio', error.message); }
  }

  const fields = leadData.field_data || [];
  const first = fieldValue(fields, ['first_name']);
  const last = fieldValue(fields, ['last_name']);
  const fullName = fieldValue(fields, ['full_name','name']) || [first,last].filter(Boolean).join(' ') || 'Lead Meta';
  const phone = fieldValue(fields, ['phone_number','phone','mobile_number']);
  const email = fieldValue(fields, ['email']);
  const platform = String(leadData.platform || '').toLowerCase() === 'instagram' ? 'instagram' : 'meta';
  const rows = await db('leads', { method:'POST', body:{ name:fullName, whatsapp:phone, email, message:'Lead recebido por formulário de anúncio da Meta.', source:platform === 'instagram' ? 'instagram' : 'meta', source_detail:platform === 'instagram' ? 'Lead Ads - Instagram' : 'Lead Ads - Meta', source_platform:platform, source_channel:'lead_ads', initial_source_platform:platform, initial_source_channel:'lead_ads', initial_source_detail:platform === 'instagram' ? 'Lead Ads - Instagram' : 'Lead Ads - Meta', last_source_platform:platform, last_source_channel:'lead_ads', last_source_detail:platform === 'instagram' ? 'Lead Ads - Instagram' : 'Lead Ads - Meta', last_source_at:new Date().toISOString(), external_lead_id:String(leadgenId), campaign_id:adData?.campaign?.id || null, campaign_name:adData?.campaign?.name || null, adset_id:adData?.adset?.id || null, adset_name:adData?.adset?.name || null, ad_id:finalAdId ? String(finalAdId) : null, ad_name:adData?.name || null, form_id:String(leadData.form_id || formId || '' ) || null, status:'new', external_metadata:{ page_id:pageId, field_data:fields, platform:leadData.platform || null } }, prefer:'return=representation' });
  return rows?.[0];
}


export function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export async function sendWhatsAppText(recipientWaId, text, phoneNumberId = null) {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const senderPhoneNumberId = phoneNumberId || process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !senderPhoneNumberId) {
    throw new Error('WhatsApp não configurado no servidor.');
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(senderPhoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: String(recipientWaId),
        type: 'text',
        text: {
          preview_url: false,
          body: String(text),
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const error = new Error(
      data.error?.message || `WhatsApp API ${response.status}`
    );
    error.statusCode = 400;
    error.metaError = data.error || null;
    throw error;
  }

  return data;
}

async function findLeadByWhatsApp(waId) {
  const byWaId = await db(
    `leads?select=id,name,status,whatsapp,whatsapp_wa_id,whatsapp_phone_number_id,external_metadata,source_platform,source_channel&whatsapp_wa_id=eq.${encodeURIComponent(waId)}&limit=1`
  );
  if (byWaId?.length) return byWaId[0];

  const candidates = await db(
    'leads?select=id,name,status,whatsapp,whatsapp_wa_id,whatsapp_phone_number_id,external_metadata,source_platform,source_channel&whatsapp=not.is.null&limit=1000'
  );
  return (candidates || []).find(
    (item) => normalizePhoneDigits(item.whatsapp) === normalizePhoneDigits(waId)
  ) || null;
}

export async function upsertWhatsAppInboundMessage({
  senderWaId,
  profileName,
  messageId,
  text,
  timestamp,
  phoneNumberId,
  displayPhoneNumber,
  messageType = 'text',
  metadata = {},
}) {
  const when = timestamp
    ? new Date(Number(timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const existing = await findLeadByWhatsApp(senderWaId);
  const safeName = normalizeString(profileName);
  let lead;

  if (existing?.id) {
    const shouldReplaceName =
      safeName &&
      (!existing.name ||
        existing.name.startsWith('Contato WhatsApp ') ||
        existing.name.startsWith('Contato Instagram '));

    const rows = await db(`leads?id=eq.${encodeURIComponent(existing.id)}`, {
      method: 'PATCH',
      body: {
        name: shouldReplaceName ? safeName : existing.name,
        whatsapp: existing.whatsapp || `+${normalizePhoneDigits(senderWaId)}`,
        whatsapp_wa_id: String(senderWaId),
        whatsapp_phone_number_id: phoneNumberId ? String(phoneNumberId) : existing.whatsapp_phone_number_id,
        last_source_platform: 'whatsapp',
        last_source_channel: 'whatsapp',
        last_source_detail: 'WhatsApp Business',
        last_source_at: when,
        updated_at: new Date().toISOString(),
        external_metadata: {
          ...(existing.external_metadata || {}),
          whatsapp: {
            wa_id: String(senderWaId),
            profile_name: safeName,
            phone_number_id: phoneNumberId || null,
            display_phone_number: displayPhoneNumber || null,
          },
        },
      },
      prefer: 'return=representation',
    });
    lead = rows?.[0] || existing;
  } else {
    const rows = await db('leads', {
      method: 'POST',
      body: {
        name: safeName || `Contato WhatsApp ${String(senderWaId).slice(-6)}`,
        whatsapp: `+${normalizePhoneDigits(senderWaId)}`,
        email: null,
        message: text,
        source: 'whatsapp',
        source_detail: 'WhatsApp Business',
        source_platform: 'whatsapp',
        source_channel: 'whatsapp',
        initial_source_platform: 'whatsapp',
        initial_source_channel: 'whatsapp',
        initial_source_detail: 'WhatsApp Business',
        last_source_platform: 'whatsapp',
        last_source_channel: 'whatsapp',
        last_source_detail: 'WhatsApp Business',
        last_source_at: when,
        whatsapp_wa_id: String(senderWaId),
        whatsapp_phone_number_id: phoneNumberId ? String(phoneNumberId) : null,
        status: 'new',
        external_metadata: {
          whatsapp: {
            wa_id: String(senderWaId),
            profile_name: safeName,
            phone_number_id: phoneNumberId || null,
            display_phone_number: displayPhoneNumber || null,
          },
        },
      },
      prefer: 'return=representation',
    });
    lead = rows?.[0];
  }

  if (lead?.id) {
    await db('social_messages?on_conflict=platform,external_message_id', {
      method: 'POST',
      body: {
        lead_id: lead.id,
        platform: 'whatsapp',
        channel: 'whatsapp',
        external_message_id: messageId || null,
        external_sender_id: String(senderWaId),
        external_recipient_id: phoneNumberId ? String(phoneNumberId) : null,
        direction: 'inbound',
        message_text: text,
        sent_at: when,
        delivery_status: 'received',
        metadata: {
          ...metadata,
          message_type: messageType,
          profile_name: safeName,
          display_phone_number: displayPhoneNumber || null,
          phone_number_id: phoneNumberId || null,
        },
      },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });
  }

  return lead;
}

export async function updateWhatsAppDeliveryStatus({
  messageId,
  status,
  timestamp,
  recipientId,
  errors = [],
  metadata = {},
}) {
  if (!messageId) return null;

  const supportedStatus = ['sent', 'delivered', 'read', 'failed'].includes(status)
    ? status
    : 'sent';
  const errorMessage = errors?.length
    ? errors.map((item) => item?.message || item?.title || item?.code).filter(Boolean).join(' | ')
    : null;

  const body = {
    delivery_status: supportedStatus,
    error_message: errorMessage,
    metadata: {
      ...metadata,
      recipient_id: recipientId || null,
      status_timestamp: timestamp || null,
      errors: errors || [],
    },
  };

  return db(
    `social_messages?platform=eq.whatsapp&external_message_id=eq.${encodeURIComponent(messageId)}`,
    { method: 'PATCH', body, prefer: 'return=minimal' }
  );
}
