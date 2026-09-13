import { supabase, supabaseConfigured } from '../lib/supabase';

const SESSION_KEY = 'matos_imobiliaria_session_id';

function makeSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getSessionId() {
  if (typeof window === 'undefined') return 'server-session';

  let id = window.localStorage.getItem(SESSION_KEY);

  if (!id) {
    id = makeSessionId();
    window.localStorage.setItem(SESSION_KEY, id);
  }

  return id;
}

function getUtmParams() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);

  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  };
}

export async function trackPageView({
  path,
  pageType = null,
  propertyId = null,
} = {}) {
  if (!supabaseConfigured || !supabase) return;

  const payload = {
    session_id: getSessionId(),
    path: path || window.location.pathname,
    page_type: pageType,
    property_id: propertyId,
    referrer: document.referrer || null,
    ...getUtmParams(),
  };

  const { error } = await supabase
    .from('site_visits')
    .insert(payload);

  if (error) {
    console.warn('Falha ao registrar visita:', error.message);
  }
}

export async function submitLead({
  propertyId = null,
  name,
  whatsapp,
  email = null,
  message = null,
  source = 'site',
  sourceDetail = null,
  landingPath = null,
}) {
  const sourcePlatform = 'site';
  const sourceChannel = propertyId ? 'property_form' : 'form';

  const { data, error } = await supabase.rpc('submit_public_lead', {
    p_property_id: propertyId,
    p_name: name.trim(),
    p_whatsapp: whatsapp.trim(),
    p_email: email?.trim() || null,
    p_message: message?.trim() || null,
    p_source: source,
    p_source_detail: sourceDetail,
    p_session_id: getSessionId(),
    p_landing_path: landingPath || window.location.pathname,
    p_source_platform: sourcePlatform,
    p_source_channel: sourceChannel,
  });

  return {
    data: Array.isArray(data) ? data[0] || null : data,
    error,
  };
}

export async function submitAppointment({
  leadId,
  propertyId = null,
  requestedDate = null,
  requestedTime = null,
}) {
  return supabase
    .from('appointments')
    .insert({
      lead_id: leadId,
      property_id: propertyId,
      requested_date: requestedDate || null,
      requested_time: requestedTime || null,
      status: 'requested',
    })
    .select('id')
    .single();
}


export async function trackEvent(eventType, { propertyId = null, path = null, metadata = {} } = {}) {
  if (!supabaseConfigured || !supabase) return;

  const { error } = await supabase.from('site_events').insert({
    session_id: getSessionId(),
    event_type: eventType,
    property_id: propertyId,
    path: path || window.location.pathname,
    metadata,
  });

  if (error) console.warn('Falha ao registrar evento:', error.message);
}
