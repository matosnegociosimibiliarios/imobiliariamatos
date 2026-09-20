import { supabase } from '../lib/supabase';

export const EMPTY_AGENCY_SETTINGS = {
  agency_name: '', legal_name: '', trade_name: '', creci: '', cnpj: '', phone: '', whatsapp: '',
  public_email: '', public_address: '', website_url: '', instagram: '', facebook: '', tiktok: '',
  youtube: '', logo_url: '', favicon_url: '', cover_image_url: '', slogan: '', primary_color: '', secondary_color: '',
};

export async function getAgencySettings() { return supabase.rpc('get_agency_public_settings'); }

export async function updateAgencySettings(settings) {
  return supabase.rpc('update_agency_public_settings', {
    p_agency_name: settings.agency_name || null, p_legal_name: settings.legal_name || null,
    p_trade_name: settings.trade_name || null, p_creci: settings.creci || null, p_cnpj: settings.cnpj || null,
    p_phone: settings.phone || null, p_whatsapp: settings.whatsapp || null, p_public_email: settings.public_email || null,
    p_public_address: settings.public_address || null, p_website_url: settings.website_url || null,
    p_instagram: settings.instagram || null, p_facebook: settings.facebook || null, p_tiktok: settings.tiktok || null,
    p_youtube: settings.youtube || null, p_logo_url: settings.logo_url || null, p_favicon_url: settings.favicon_url || null,
    p_cover_image_url: settings.cover_image_url || null, p_slogan: settings.slogan || null,
    p_primary_color: settings.primary_color || null, p_secondary_color: settings.secondary_color || null,
  });
}

export async function getPublicAgencySettings(organizationSlug) {
  return supabase.rpc('get_public_agency_settings', { p_organization_slug: organizationSlug });
}
