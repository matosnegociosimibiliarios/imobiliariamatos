import { supabase } from '../lib/supabase';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameText(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  return Boolean(na && nb && na === nb);
}

function propertyArea(item) {
  return number(item.built_area) || number(item.total_area);
}

function scoreComparable(item, subject) {
  let score = 0;

  if (sameText(item.property_type, subject.property_type)) score += 25;
  if (sameText(item.city?.name, subject.city)) score += 15;
  if (sameText(item.neighborhood?.name, subject.neighborhood)) score += 25;

  const targetArea = number(subject.area);
  const area = propertyArea(item);
  if (targetArea > 0 && area > 0) {
    const ratio = Math.abs(area - targetArea) / targetArea;
    if (ratio <= 0.10) score += 20;
    else if (ratio <= 0.20) score += 15;
    else if (ratio <= 0.35) score += 8;
  }

  const bedroomDiff = Math.abs(number(item.bedrooms) - number(subject.bedrooms));
  if (bedroomDiff === 0) score += 5;
  else if (bedroomDiff === 1) score += 3;

  const bathroomDiff = Math.abs(number(item.bathrooms) - number(subject.bathrooms));
  if (bathroomDiff === 0) score += 4;
  else if (bathroomDiff === 1) score += 2;

  const parkingDiff = Math.abs(number(item.parking_spaces) - number(subject.parking_spaces));
  if (parkingDiff === 0) score += 3;
  else if (parkingDiff === 1) score += 1;

  const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;
  if (createdAt) {
    const months = (Date.now() - createdAt) / (1000 * 60 * 60 * 24 * 30.4);
    if (months <= 6) score += 3;
    else if (months <= 12) score += 2;
    else if (months <= 24) score += 1;
  }

  return Math.max(10, Math.min(100, score));
}

export async function getQuickValuationComparables(subject) {
  let query = supabase
    .from('properties')
    .select(`
      id,
      code,
      title,
      property_type,
      purpose,
      status,
      sale_price,
      total_area,
      built_area,
      bedrooms,
      suites,
      bathrooms,
      parking_spaces,
      public_location_text,
      created_at,
      city:cities(id,name,state_code),
      neighborhood:neighborhoods(id,name)
    `)
    .is('deleted_at', null)
    .not('sale_price', 'is', null)
    .gt('sale_price', 0)
    .limit(100);

  if (subject.property_type) query = query.eq('property_type', subject.property_type);

  const propertiesResult = await query;
  if (propertiesResult.error) return { data: [], error: propertiesResult.error };

  const properties = propertiesResult.data || [];
  const propertyIds = properties.map((item) => item.id);

  let deals = [];
  if (propertyIds.length) {
    const dealsResult = await supabase
      .from('deals')
      .select('id,property_id,status,sale_value,completed_at,created_at')
      .in('property_id', propertyIds)
      .eq('status', 'completed')
      .not('sale_value', 'is', null)
      .gt('sale_value', 0);

    if (!dealsResult.error) deals = dealsResult.data || [];
  }

  const closedByProperty = new Map();
  deals.forEach((deal) => {
    const current = closedByProperty.get(deal.property_id);
    const currentDate = current?.completed_at || current?.created_at || '';
    const nextDate = deal.completed_at || deal.created_at || '';
    if (!current || nextDate > currentDate) closedByProperty.set(deal.property_id, deal);
  });

  const targetArea = number(subject.area);

  const data = properties
    .map((item) => {
      const deal = closedByProperty.get(item.id);
      const area = propertyArea(item);
      const value = deal ? number(deal.sale_value) : number(item.sale_price);
      const pricePerM2 = area > 0 ? value / area : 0;
      const similarity = scoreComparable(item, subject);
      const sameNeighborhood = sameText(item.neighborhood?.name, subject.neighborhood);
      const sameCity = sameText(item.city?.name, subject.city);
      const areaDifferencePct = targetArea > 0 && area > 0
        ? Math.abs(area - targetArea) / targetArea * 100
        : null;

      return {
        id: item.id,
        source: deal ? 'closed_sale' : 'active_listing',
        source_label: deal ? 'Venda concluída no GOI' : 'Imóvel anunciado no GOI',
        code: item.code,
        title: item.title,
        property_type: item.property_type,
        city: item.city?.name || '',
        neighborhood: item.neighborhood?.name || '',
        location_text: item.public_location_text || '',
        value,
        area,
        price_per_m2: pricePerM2,
        bedrooms: item.bedrooms,
        suites: item.suites,
        bathrooms: item.bathrooms,
        parking_spaces: item.parking_spaces,
        similarity,
        same_neighborhood: sameNeighborhood,
        same_city: sameCity,
        area_difference_pct: areaDifferencePct,
        reference_date: deal?.completed_at || item.created_at,
        listed_price: number(item.sale_price),
        closed_price: deal ? number(deal.sale_value) : null,
        discount_pct: deal && number(item.sale_price) > 0
          ? Math.max(-50, Math.min(50, (number(item.sale_price) - number(deal.sale_value)) / number(item.sale_price) * 100))
          : null,
      };
    })
    .filter((item) => item.area > 0 && item.value > 0)
    .filter((item) => {
      if (!targetArea) return true;
      return item.area >= targetArea * 0.55 && item.area <= targetArea * 1.65;
    })
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'closed_sale' ? -1 : 1;
      if (a.same_neighborhood !== b.same_neighborhood) return a.same_neighborhood ? -1 : 1;
      if (a.same_city !== b.same_city) return a.same_city ? -1 : 1;
      return b.similarity - a.similarity;
    })
    .slice(0, 20);

  return { data, error: null };
}
