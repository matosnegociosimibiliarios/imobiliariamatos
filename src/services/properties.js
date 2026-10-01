import { supabase, supabaseConfigured } from '../lib/supabase';

export const PROPERTY_BUCKET = 'property-images';

export function getPublicOrganizationSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('imobiliaria') || import.meta.env.VITE_PUBLIC_ORGANIZATION_SLUG || 'matos-negocios-imobiliarios';
}

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
  tag,
  created_at,
  city:cities(id,name,state_code,slug),
  neighborhood:neighborhoods(name),
  property_images(
    id,
    storage_path,
    alt_text,
    display_order,
    is_cover
  )
`;

export function getPublicImageUrl(storagePath) {
  if (!supabaseConfigured || !storagePath) return null;

  const { data } = supabase
    .storage
    .from(PROPERTY_BUCKET)
    .getPublicUrl(storagePath);

  return data?.publicUrl || null;
}

export function getCoverImage(property) {
  const images = [...(property?.property_images || [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const cover = images.find((image) => image.is_cover) || images[0];
  if (!cover) return null;

  return {
    ...cover,
    publicUrl: getPublicImageUrl(cover.storage_path),
  };
}

export function getPropertyImages(property) {
  return [...(property?.property_images || [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((image) => ({
      ...image,
      publicUrl: getPublicImageUrl(image.storage_path),
    }))
    .filter((image) => image.publicUrl);
}

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
  cityId,
  minPrice,
  maxPrice,
  minBedrooms,
} = {}) {
  if (!supabaseConfigured) {
    return { data: [], error: new Error('Supabase não configurado.') };
  }

  const organizationSlug = getPublicOrganizationSlug();
  const base = await supabase.rpc('get_public_properties', { p_organization_slug: organizationSlug, p_purpose: purpose || null, p_featured_only: featuredOnly, p_limit: limit });
  if (base.error) return base;
  const ids = (base.data || []).map((item) => item.id);
  if (!ids.length) return { data: [], error: null };
  let query = supabase.from('properties').select(cardFields).in('id', ids).order('created_at', { ascending: false }).limit(limit);


  if (propertyType) query = query.eq('property_type', propertyType);
  if (cityId) query = query.eq('city_id', cityId);
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

  const organizationSlug = getPublicOrganizationSlug();
  const resolved = await supabase.rpc('get_public_property_by_slug', { p_organization_slug: organizationSlug, p_property_slug: slug });
  if (resolved.error || !resolved.data?.id) return { data: null, error: resolved.error };
  return supabase
    .from('properties')
    .select(`
      *,
      city:cities(id,name,state_code,slug),
      neighborhood:neighborhoods(name),
      property_images(
        id,
        storage_path,
        alt_text,
        display_order,
        is_cover
      ),
      property_features(
        feature:features(id,key,label,active)
      )
    `)
    .eq('id', resolved.data.id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle();
}

export async function getAgencySettings() {
  if (!supabaseConfigured) {
    return { data: null, error: new Error('Supabase não configurado.') };
  }

  return supabase.rpc('get_public_agency_settings', { p_organization_slug: getPublicOrganizationSlug() });
}


export const PROPERTY_TYPE_SLUGS = {
  Casa: 'casas',
  Apartamento: 'apartamentos',
  Terreno: 'terrenos',
  Sítio: 'sitios',
  Comercial: 'imoveis-comerciais',
};

export const SLUG_PROPERTY_TYPES = Object.fromEntries(
  Object.entries(PROPERTY_TYPE_SLUGS).map(([name, slug]) => [slug, name])
);

export async function getCityBySlug(slug) {
  if (!supabaseConfigured) return { data: null, error: new Error('Supabase não configurado.') };
  return supabase.from('cities').select('id,name,state,state_code,slug,active').eq('slug', slug).eq('active', true).maybeSingle();
}
