import { supabase } from '../lib/supabase';

export async function getPropertyValuations(propertyId) {
  return supabase
    .from('property_valuations')
    .select(`
      *,
      evaluator:profiles(id,full_name),
      comparables:valuation_comparables(
        *,
        adjustments:valuation_adjustments(*),
        comparable_property:properties(id,code,title,sale_price,total_area,built_area,bedrooms,property_type,public_location_text)
      )
    `)
    .eq('property_id', propertyId)
    .order('valuation_date', { ascending: false })
    .order('created_at', { ascending: false });
}

export async function getPropertyValuationCandidates(propertyId, limit = 20) {
  return supabase.rpc('get_property_valuation_candidates', {
    p_property_id: propertyId,
    p_limit: limit,
  });
}

export async function createPropertyValuation(propertyId, payload = {}) {
  return supabase
    .from('property_valuations')
    .insert({
      property_id: propertyId,
      valuation_type: payload.valuation_type || 'market_comparison',
      valuation_date: payload.valuation_date || new Date().toISOString().slice(0, 10),
      purpose: payload.purpose || null,
      methodology_notes: payload.methodology_notes || null,
      observations: payload.observations || null,
      status: payload.status || 'draft',
    })
    .select()
    .single();
}

export async function updatePropertyValuation(id, payload) {
  return supabase
    .from('property_valuations')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
}

export async function recalculatePropertyValuation(id) {
  return supabase.rpc('recalculate_property_valuation', {
    p_valuation_id: id,
  });
}

export async function addValuationComparable(valuationId, comparable) {
  return supabase
    .from('valuation_comparables')
    .insert({
      valuation_id: valuationId,
      comparable_property_id: comparable.comparable_property_id || null,
      transaction_id: comparable.transaction_id || null,
      source_type: comparable.source_type || 'manual',
      selection_status: comparable.selection_status || 'accepted',
      reference_date: comparable.reference_date || new Date().toISOString().slice(0, 10),
      source_label: comparable.source_label || null,
      external_reference: comparable.external_reference || null,
      listed_price: comparable.listed_price ?? null,
      closed_price: comparable.closed_price ?? null,
      reference_value: comparable.reference_value ?? null,
      area: comparable.area ?? null,
      built_area: comparable.built_area ?? null,
      bedrooms: comparable.bedrooms ?? null,
      suites: comparable.suites ?? null,
      bathrooms: comparable.bathrooms ?? null,
      parking_spaces: comparable.parking_spaces ?? null,
      property_type: comparable.property_type || null,
      purpose: comparable.purpose || null,
      city_id: comparable.city_id || null,
      neighborhood_id: comparable.neighborhood_id || null,
      location_text: comparable.location_text || null,
      distance_km: comparable.distance_km ?? null,
      similarity_index: comparable.similarity_index ?? null,
      weight: comparable.weight ?? 1,
      notes: comparable.notes || null,
      property_snapshot: comparable.property_snapshot || {},
    })
    .select()
    .single();
}

export async function deleteValuationComparable(id) {
  return supabase
    .from('valuation_comparables')
    .delete()
    .eq('id', id);
}

export async function addValuationAdjustment(comparableId, payload) {
  return supabase
    .from('valuation_adjustments')
    .insert({
      comparable_id: comparableId,
      adjustment_type: payload.adjustment_type,
      percentage: Number(payload.percentage || 0),
      justification: payload.justification || null,
      sort_order: Number(payload.sort_order || 0),
    })
    .select()
    .single();
}

export async function deleteValuationAdjustment(id) {
  return supabase
    .from('valuation_adjustments')
    .delete()
    .eq('id', id);
}

export async function setPropertyValuationStatus(id, status) {
  return supabase
    .from('property_valuations')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
}


export async function getAdvancedPropertyValuationAnalysis(id) {
  return supabase.rpc('property_valuation_advanced_analysis', { p_valuation_id: id });
}
