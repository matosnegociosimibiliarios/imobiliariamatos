import { supabase } from '../lib/supabase';
import { PROPERTY_BUCKET } from './properties';

export async function getAdminStats() {
  const statuses = ['published', 'draft', 'sold', 'rented'];

  const results = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)
        .is('deleted_at', null);

      return { status, count: count || 0, error };
    })
  );

  return results;
}

export async function getAllAdminProperties() {
  return supabase
    .from('properties')
    .select(`
      id,
      code,
      title,
      slug,
      purpose,
      property_type,
      status,
      sale_price,
      rent_price,
      featured,
      created_at,
      public_location_text,
      city:cities(name,state_code),
      neighborhood:neighborhoods(name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
}

export async function getAdminProperty(id) {
  return supabase
    .from('properties')
    .select(`
      *,
      property_images(
        id,
        storage_path,
        alt_text,
        display_order,
        is_cover
      )
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function getCities() {
  return supabase
    .from('cities')
    .select('id,name,state,state_code,slug,active')
    .order('name');
}

export async function getNeighborhoods(cityId) {
  if (!cityId) return { data: [], error: null };

  return supabase
    .from('neighborhoods')
    .select('id,name,slug,active')
    .eq('city_id', cityId)
    .order('name');
}

export async function createCityIfNeeded(name, stateCode = 'MG') {
  const cleanName = name.trim();
  const slug = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + `-${stateCode.toLowerCase()}`;

  const { data: existing } = await supabase
    .from('cities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('cities')
    .insert({
      name: cleanName,
      state: stateCode === 'MG' ? 'Minas Gerais' : null,
      state_code: stateCode,
      slug,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createNeighborhoodIfNeeded(cityId, name) {
  const cleanName = name.trim();
  const slug = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { data: existing } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('city_id', cityId)
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('neighborhoods')
    .insert({
      city_id: cityId,
      name: cleanName,
      slug,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveProperty(payload, id = null) {
  if (id) {
    return supabase
      .from('properties')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
  }

  return supabase
    .from('properties')
    .insert(payload)
    .select()
    .single();
}

export async function changePropertyStatus(id, status) {
  const payload = {
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
  };

  return supabase
    .from('properties')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
}

export async function softDeleteProperty(id) {
  return supabase
    .from('properties')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'inactive',
    })
    .eq('id', id);
}

export async function uploadPropertyImages(property, files) {
  const uploaded = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const basePath = property.code.toLowerCase();
    const filename = `${Date.now()}-${i + 1}.${extension}`;
    const storagePath = `${basePath}/${filename}`;

    const { error: uploadError } = await supabase
      .storage
      .from(PROPERTY_BUCKET)
      .upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('property_images')
      .insert({
        property_id: property.id,
        storage_path: storagePath,
        alt_text: `${property.title} - foto ${i + 1}`,
        display_order: i + 1,
        is_cover: i === 0,
      })
      .select()
      .single();

    if (error) throw error;
    uploaded.push(data);
  }

  return uploaded;
}

export async function setCoverImage(propertyId, imageId) {
  await supabase
    .from('property_images')
    .update({ is_cover: false })
    .eq('property_id', propertyId);

  return supabase
    .from('property_images')
    .update({ is_cover: true })
    .eq('id', imageId);
}

export async function deletePropertyImage(image) {
  const { error: storageError } = await supabase
    .storage
    .from(PROPERTY_BUCKET)
    .remove([image.storage_path]);

  if (storageError) throw storageError;

  return supabase
    .from('property_images')
    .delete()
    .eq('id', image.id);
}


export async function getDashboardMetrics(daysBack = 30) {
  return supabase.rpc('admin_dashboard_metrics', {
    days_back: daysBack,
  });
}

export async function getLeadSources(daysBack = 30) {
  return supabase.rpc('admin_lead_sources', {
    days_back: daysBack,
  });
}

export async function getTopLeadProperties(daysBack = 30) {
  return supabase.rpc('admin_top_lead_properties', {
    days_back: daysBack,
  });
}

export async function getLeads() {
  return supabase
    .from('leads')
    .select(`
      *,
      property:properties(id,code,title)
    `)
    .order('created_at', { ascending: false });
}

export async function updateLeadStatus(id, status) {
  return supabase
    .from('leads')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
}

export async function getAppointments() {
  return supabase
    .from('appointments')
    .select(`
      *,
      lead:leads(id,name,whatsapp,email,status),
      property:properties(id,code,title)
    `)
    .order('created_at', { ascending: false });
}

export async function updateAppointment(id, payload) {
  return supabase
    .from('appointments')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
}
