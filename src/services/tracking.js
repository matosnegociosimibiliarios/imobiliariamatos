import { supabase, supabaseConfigured } from '../lib/supabase';
import { getPublicOrganizationSlug } from './properties';

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

  const utm = getUtmParams();
  const { error } = await supabase.rpc('track_public_page_view', {
    p_organization_slug: getPublicOrganizationSlug(),
    p_session_id: getSessionId(),
    p_path: path || window.location.pathname,
    p_page_type: pageType,
    p_property_id: propertyId,
    p_referrer: document.referrer || null,
    p_utm_source: utm.utm_source,
    p_utm_medium: utm.utm_medium,
    p_utm_campaign: utm.utm_campaign,
  });

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
    p_organization_slug: getPublicOrganizationSlug(),
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
  const { data, error } = await supabase.rpc('submit_public_appointment', {
    p_organization_slug: getPublicOrganizationSlug(),
    p_lead_id: leadId,
    p_property_id: propertyId,
    p_requested_date: requestedDate || null,
    p_requested_time: requestedTime || null,
  });
  return { data: data ? { id: data } : null, error };
}


export async function trackEvent(eventType, { propertyId = null, path = null, metadata = {} } = {}) {
  if (!supabaseConfigured || !supabase) return;

  const { error } = await supabase.rpc('track_public_event', {
    p_organization_slug: getPublicOrganizationSlug(),
    p_session_id: getSessionId(),
    p_event_type: eventType,
    p_property_id: propertyId,
    p_path: path || window.location.pathname,
    p_metadata: metadata,
  });

  if (error) console.warn('Falha ao registrar evento:', error.message);
}
