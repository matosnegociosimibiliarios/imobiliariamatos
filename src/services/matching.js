import { supabase } from '../lib/supabase';

export const MATCH_PURPOSES = [
  { value: 'sale', label: 'Comprar' },
  { value: 'rent', label: 'Alugar' },
  { value: 'either', label: 'Comprar ou alugar' },
];

export const MATCH_URGENCIES = [
  { value: 'now', label: 'O quanto antes' },
  { value: '30_days', label: 'Até 30 dias' },
  { value: '90_days', label: 'Até 90 dias' },
  { value: 'research', label: 'Ainda pesquisando' },
];

export const MATCH_PROPERTY_TYPES = ['Casa', 'Apartamento', 'Terreno', 'Sítio', 'Comercial'];

export const MATCH_STATUS_LABELS = {
  suggested: 'Sugerido',
  interested: 'Interessado',
  visit: 'Visita',
  discarded: 'Descartado',
};

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function cleanArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return [];
}

function propertyPriceForPurpose(property, purpose) {
  if (purpose === 'rent') return Number(property.rent_price || 0) || null;
  if (purpose === 'sale') return Number(property.sale_price || 0) || null;
  return Number(property.sale_price || property.rent_price || 0) || null;
}

function purposeMatches(property, purpose) {
  if (!purpose || purpose === 'either') return true;
  if (purpose === 'sale') return ['sale', 'sale_and_rent'].includes(property.purpose);
  if (purpose === 'rent') return ['rent', 'sale_and_rent'].includes(property.purpose);
  return true;
}

function priceScore(price, minPrice, maxPrice) {
  if (!price) return 0;
  const min = Number(minPrice || 0);
  const max = Number(maxPrice || 0);

  if (min && price < min) {
    if (price >= min * 0.9) return 0.65;
    return 0.35;
  }

  if (max && price > max) {
    if (price <= max * 1.05) return 0.8;
    if (price <= max * 1.1) return 0.55;
    if (price <= max * 1.2) return 0.25;
    return 0;
  }

  return 1;
}

function meetsMinimum(value, minimum) {
  if (minimum === null || minimum === undefined || minimum === '') return 1;
  const actual = Number(value || 0);
  const target = Number(minimum || 0);
  if (actual >= target) return 1;
  if (target > 0 && actual >= target - 1) return 0.45;
  return 0;
}

export function calculatePropertyMatch(property, preferences) {
  if (!purposeMatches(property, preferences.purpose)) return null;

  let achieved = 0;
  let possible = 0;
  const reasons = [];

  possible += 15;
  achieved += 15;
  reasons.push(preferences.purpose === 'rent' ? 'Disponível para aluguel' : preferences.purpose === 'sale' ? 'Disponível para compra' : 'Finalidade compatível');

  const price = propertyPriceForPurpose(property, preferences.purpose);
  if (preferences.min_price || preferences.max_price) {
    possible += 25;
    const factor = priceScore(price, preferences.min_price, preferences.max_price);
    achieved += 25 * factor;
    if (factor >= 0.8) reasons.push('Preço dentro ou muito próximo do orçamento');
  }

  const types = cleanArray(preferences.property_types);
  if (types.length) {
    possible += 15;
    if (types.map(normalize).includes(normalize(property.property_type))) {
      achieved += 15;
      reasons.push(`Tipo desejado: ${property.property_type}`);
    }
  }

  const cities = cleanArray(preferences.preferred_cities).map(normalize);
  if (cities.length) {
    possible += 10;
    if (cities.includes(normalize(property.city?.name))) {
      achieved += 10;
      reasons.push(`Cidade preferida: ${property.city?.name}`);
    }
  }

  const neighborhoods = cleanArray(preferences.preferred_neighborhoods).map(normalize);
  if (neighborhoods.length) {
    possible += 10;
    if (neighborhoods.includes(normalize(property.neighborhood?.name))) {
      achieved += 10;
      reasons.push(`Bairro preferido: ${property.neighborhood?.name}`);
    }
  }

  if (preferences.min_bedrooms !== null && preferences.min_bedrooms !== undefined) {
    possible += 8;
    const factor = meetsMinimum(property.bedrooms, preferences.min_bedrooms);
    achieved += 8 * factor;
    if (factor === 1) reasons.push(`${property.bedrooms || 0} quarto(s)`);
  }

  if (preferences.min_bathrooms !== null && preferences.min_bathrooms !== undefined) {
    possible += 5;
    const factor = meetsMinimum(property.bathrooms, preferences.min_bathrooms);
    achieved += 5 * factor;
    if (factor === 1) reasons.push(`${property.bathrooms || 0} banheiro(s)`);
  }

  if (preferences.min_parking_spaces !== null && preferences.min_parking_spaces !== undefined) {
    possible += 5;
    const factor = meetsMinimum(property.parking_spaces, preferences.min_parking_spaces);
    achieved += 5 * factor;
    if (factor === 1) reasons.push(`${property.parking_spaces || 0} vaga(s)`);
  }

  if (preferences.min_total_area) {
    possible += 4;
    const factor = Number(property.total_area || 0) >= Number(preferences.min_total_area) ? 1 : 0;
    achieved += 4 * factor;
    if (factor === 1) reasons.push('Área total atende ao mínimo');
  }

  if (preferences.min_built_area) {
    possible += 3;
    const factor = Number(property.built_area || 0) >= Number(preferences.min_built_area) ? 1 : 0;
    achieved += 3 * factor;
    if (factor === 1) reasons.push('Área construída atende ao mínimo');
  }

  const score = possible > 0 ? Math.round((achieved / possible) * 100) : 0;

  return {
    property,
    score,
    reasons: reasons.slice(0, 4),
    price,
  };
}

export async function getLeadPreferences(leadId) {
  return supabase
    .from('lead_preferences')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle();
}

export async function saveLeadPreferences(leadId, payload) {
  return supabase
    .from('lead_preferences')
    .upsert({
      lead_id: leadId,
      ...payload,
      updated_by: (await supabase.auth.getUser()).data?.user?.id || null,
    }, { onConflict: 'lead_id' })
    .select()
    .single();
}

export async function getLeadMatchStatuses(leadId) {
  return supabase
    .from('lead_property_matches')
    .select('*')
    .eq('lead_id', leadId);
}

export async function saveLeadMatchStatus(leadId, propertyId, status, score = null) {
  const userId = (await supabase.auth.getUser()).data?.user?.id || null;
  return supabase
    .from('lead_property_matches')
    .upsert({
      lead_id: leadId,
      property_id: propertyId,
      status,
      score,
      updated_by: userId,
    }, { onConflict: 'lead_id,property_id' })
    .select()
    .single();
}

export async function getAvailablePropertiesForMatch() {
  return supabase
    .from('properties')
    .select(`
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
      status,
      city:cities(name,state_code),
      neighborhood:neighborhoods(name)
    `)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
}

export async function getLeadPropertyMatches(leadId, preferences) {
  const [propertiesResult, statusesResult] = await Promise.all([
    getAvailablePropertiesForMatch(),
    getLeadMatchStatuses(leadId),
  ]);

  if (propertiesResult.error) return { data: [], error: propertiesResult.error };
  if (statusesResult.error) return { data: [], error: statusesResult.error };

  const statusByProperty = Object.fromEntries(
    (statusesResult.data || []).map((item) => [item.property_id, item])
  );

  const matches = (propertiesResult.data || [])
    .map((property) => calculatePropertyMatch(property, preferences))
    .filter(Boolean)
    .map((match) => ({
      ...match,
      savedStatus: statusByProperty[match.property.id]?.status || 'suggested',
    }))
    .sort((a, b) => {
      const aDiscarded = a.savedStatus === 'discarded' ? 1 : 0;
      const bDiscarded = b.savedStatus === 'discarded' ? 1 : 0;
      if (aDiscarded !== bDiscarded) return aDiscarded - bDiscarded;
      return b.score - a.score;
    });

  return { data: matches, error: null };
}
