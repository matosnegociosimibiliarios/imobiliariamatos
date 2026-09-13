import { supabase, supabaseConfigured } from '../lib/supabase';

const cardFields = `
  id,
  code,
  title,
  slug,
  purpose,
  property_type,
  sale_price,
  rent_price,
  public_location_text,
  total_area,
  built_area,
  bedrooms,
  bathrooms,
  parking_spaces,
  featured,
  created_at,
  city:cities(name,state_code),
  neighborhood:neighborhoods(name)
`;

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function propertyPrice(property, pagePurpose) {
  if (!property) return null;

  if (pagePurpose === 'rent' && property.rent_price != null) {
    return `${formatMoney(property.rent_price)}/mês`;
  }

  if (pagePurpose === 'sale' && property.sale_price != null) {
    return formatMoney(property.sale_price);
  }

  if (property.sale_price != null) return formatMoney(property.sale_price);
  if (property.rent_price != null) return `${formatMoney(property.rent_price)}/mês`;

  return 'Consulte o valor';
}

export function propertyLocation(property) {
  if (property?.public_location_text) return property.public_location_text;

  const parts = [
    property?.neighborhood?.name,
    property?.city?.name,
    property?.city?.state_code,
  ].filter(Boolean);

  return parts.join(' - ') || 'Localização sob consulta';
}

function purposeFilter(query, purpose) {
  if (purpose === 'sale') {
    return query.in('purpose', ['sale', 'sale_and_rent']);
  }

  if (purpose === 'rent') {
    return query.in('purpose', ['rent', 'sale_and_rent']);
  }

  return query;
}

export async function getProperties({
  purpose,
  featuredOnly = false,
  limit = 24,
  propertyType,
  minPrice,
  maxPrice,
  minBedrooms,
} = {}) {
  if (!supabaseConfigured) {
    return { data: [], error: new Error('Supabase não configurado.') };
  }

  let query = supabase
    .from('properties')
    .select(cardFields)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  query = purposeFilter(query, purpose);

  if (featuredOnly) query = query.eq('featured', true);
  if (propertyType) query = query.eq('property_type', propertyType);
  if (minBedrooms) query = query.gte('bedrooms', Number(minBedrooms));

  if (purpose === 'rent') {
    if (minPrice) query = query.gte('rent_price', Number(minPrice));
    if (maxPrice) query = query.lte('rent_price', Number(maxPrice));
  } else if (purpose === 'sale') {
    if (minPrice) query = query.gte('sale_price', Number(minPrice));
    if (maxPrice) query = query.lte('sale_price', Number(maxPrice));
  }

  return query;
}

export async function getHomeProperties() {
  const featured = await getProperties({ featuredOnly: true, limit: 6 });

  if (!featured.error && featured.data?.length) {
    return featured;
  }

  return getProperties({ limit: 6 });
}

export async function getPropertyBySlug(slug) {
  if (!supabaseConfigured) {
    return { data: null, error: new Error('Supabase não configurado.') };
  }

  return supabase
    .from('properties')
    .select(`
      *,
      city:cities(name,state_code),
      neighborhood:neighborhoods(name),
      property_images(id,storage_path,alt_text,display_order,is_cover),
      property_features(
        feature:features(id,key,label,active)
      )
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle();
}

export async function getAgencySettings() {
  if (!supabaseConfigured) {
    return { data: null, error: new Error('Supabase não configurado.') };
  }

  return supabase
    .from('agency_public_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
}
