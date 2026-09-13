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

function normalizeString(value) { return value == null ? null : String(value).trim() || null; }

export async function upsertInstagramDirectLead({ senderId, messageId, text, timestamp, metadata={} }) {
  const existing = await db(`leads?select=id,name,status&source_platform=eq.instagram&source_channel=eq.direct&external_contact_id=eq.${encodeURIComponent(senderId)}&limit=1`);
  const when = timestamp ? new Date(Number(timestamp)).toISOString() : new Date().toISOString();
  let lead;
  if (existing?.length) {
    const rows = await db(`leads?id=eq.${existing[0].id}`, { method:'PATCH', body:{ last_inbound_message:text, last_inbound_at:when, updated_at:new Date().toISOString(), external_metadata:metadata }, prefer:'return=representation' });
    lead = rows?.[0] || existing[0];
  } else {
    const rows = await db('leads', { method:'POST', body:{ name:`Contato Instagram ${String(senderId).slice(-6)}`, whatsapp:null, email:null, message:text, source:'instagram', source_detail:'Direct do Instagram', source_platform:'instagram', source_channel:'direct', external_contact_id:senderId, last_inbound_message:text, last_inbound_at:when, status:'new', external_metadata:metadata }, prefer:'return=representation' });
    lead = rows?.[0];
  }

  if (lead?.id) {
    try {
      await db('social_messages?on_conflict=platform,external_message_id', { method:'POST', body:{ lead_id:lead.id, platform:'instagram', channel:'direct', external_message_id:messageId || null, external_sender_id:senderId, direction:'inbound', message_text:text, sent_at:when, metadata }, prefer:'resolution=ignore-duplicates,return=minimal' });
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
  const rows = await db('leads', { method:'POST', body:{ name:fullName, whatsapp:phone, email, message:'Lead recebido por formulário de anúncio da Meta.', source:platform === 'instagram' ? 'instagram' : 'meta', source_detail:platform === 'instagram' ? 'Lead Ads - Instagram' : 'Lead Ads - Meta', source_platform:platform, source_channel:'lead_ads', external_lead_id:String(leadgenId), campaign_id:adData?.campaign?.id || null, campaign_name:adData?.campaign?.name || null, adset_id:adData?.adset?.id || null, adset_name:adData?.adset?.name || null, ad_id:finalAdId ? String(finalAdId) : null, ad_name:adData?.name || null, form_id:String(leadData.form_id || formId || '' ) || null, status:'new', external_metadata:{ page_id:pageId, field_data:fields, platform:leadData.platform || null } }, prefer:'return=representation' });
  return rows?.[0];
}
