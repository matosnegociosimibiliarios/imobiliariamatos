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


export async function getLeadDetails(id) {
  return supabase
    .from('leads')
    .select(`
      *,
      property:properties(
        id,
        code,
        title,
        slug,
        purpose,
        sale_price,
        rent_price,
        public_location_text
      ),
      appointments(
        id,
        requested_date,
        requested_time,
        scheduled_at,
        status,
        notes,
        created_at
      )
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function updateLead(id, payload) {
  return supabase
    .from('leads')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      property:properties(id,code,title,slug)
    `)
    .single();
}

export async function getLeadNotes(leadId) {
  return supabase
    .from('lead_notes')
    .select('id,lead_id,note,created_by,created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
}

export async function addLeadNote(leadId, note) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return supabase
    .from('lead_notes')
    .insert({
      lead_id: leadId,
      note: note.trim(),
      created_by: user?.id || null,
    })
    .select()
    .single();
}

export async function getLeadStatusHistory(leadId) {
  return supabase
    .from('lead_status_history')
    .select('id,lead_id,from_status,to_status,changed_by,created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
}

export async function getUpcomingActions() {
  return supabase
    .from('leads')
    .select(`
      id,
      name,
      whatsapp,
      status,
      next_action_text,
      next_action_at,
      property:properties(id,code,title)
    `)
    .not('next_action_at', 'is', null)
    .not('status', 'in', '("won","lost")')
    .order('next_action_at', { ascending: true })
    .limit(50);
}

export async function getLostReasons(daysBack = 90) {
  return supabase.rpc('admin_lost_reasons', {
    days_back: daysBack,
  });
}


export async function getOwnerCaptures() {
  return supabase
    .from('owner_captures')
    .select(`
      *,
      converted_property:properties(
        id,
        code,
        title,
        slug,
        status
      )
    `)
    .order('created_at', { ascending: false });
}

export async function getOwnerCaptureDetails(id) {
  return supabase
    .from('owner_captures')
    .select(`
      *,
      converted_property:properties(
        id,
        code,
        title,
        slug,
        status
      )
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function updateOwnerCapture(id, payload) {
  return supabase
    .from('owner_captures')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      converted_property:properties(
        id,
        code,
        title,
        slug,
        status
      )
    `)
    .single();
}

export async function getCaptureNotes(captureId) {
  return supabase
    .from('capture_notes')
    .select('*')
    .eq('capture_id', captureId)
    .order('created_at', { ascending: false });
}

export async function addCaptureNote(captureId, note) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return supabase
    .from('capture_notes')
    .insert({
      capture_id: captureId,
      note: note.trim(),
      created_by: user?.id || null,
    })
    .select()
    .single();
}

export async function getCaptureDocuments(captureId) {
  return supabase
    .from('capture_documents')
    .select('*')
    .eq('capture_id', captureId)
    .order('label');
}

export async function setCaptureDocumentStatus({
  captureId,
  documentType,
  label,
  status,
  notes = null,
}) {
  return supabase
    .from('capture_documents')
    .upsert(
      {
        capture_id: captureId,
        document_type: documentType,
        label,
        status,
        notes,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'capture_id,document_type',
      }
    )
    .select()
    .single();
}

export async function getCaptureStatusHistory(captureId) {
  return supabase
    .from('capture_status_history')
    .select('*')
    .eq('capture_id', captureId)
    .order('created_at', { ascending: false });
}

export async function getCaptureUpcomingActions() {
  return supabase
    .from('owner_captures')
    .select(`
      id,
      owner_name,
      whatsapp,
      status,
      next_action_text,
      next_action_at,
      property_type,
      city_name,
      neighborhood_name
    `)
    .not('next_action_at', 'is', null)
    .not('status', 'in', '("published","lost")')
    .order('next_action_at', { ascending: true })
    .limit(50);
}


export async function getAcquisitionMetrics(daysBack = 30) {
  return supabase.rpc('admin_acquisition_metrics', { days_back: daysBack });
}

export async function getIntegrationMetrics(daysBack = 30) {
  return supabase.rpc('admin_integration_metrics', { days_back: daysBack });
}

export async function getLeadSocialMessages(leadId, platform = null) {
  let query = supabase
    .from('social_messages')
    .select('*')
    .eq('lead_id', leadId);

  if (platform) {
    query = query.eq('platform', platform);
  }

  return query
    .order('sent_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(200);
}

export async function getInstagramConversations() {
  return supabase
    .from('leads')
    .select(`
      id,
      name,
      status,
      source_platform,
      source_channel,
      external_contact_id,
      last_inbound_message,
      last_inbound_at,
      last_outbound_message,
      last_outbound_at,
      last_message_at,
      social_unread_count,
      instagram_unread_count,
      whatsapp_unread_count,
      whatsapp,
      whatsapp_wa_id,
      whatsapp_phone_number_id,
      created_at
    `)
    .eq('source_platform', 'instagram')
    .eq('source_channel', 'direct')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
}

export async function getWhatsAppConversations() {
  return supabase
    .from('leads')
    .select(`
      id,
      name,
      status,
      source_platform,
      source_channel,
      whatsapp,
      whatsapp_wa_id,
      whatsapp_phone_number_id,
      last_inbound_message,
      last_inbound_at,
      last_outbound_message,
      last_outbound_at,
      last_message_at,
      social_unread_count,
      instagram_unread_count,
      whatsapp_unread_count,
      created_at
    `)
    .not('whatsapp_wa_id', 'is', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
}

export async function markLeadSocialRead(leadId, platform = 'instagram') {
  return supabase.rpc('mark_channel_messages_read', {
    p_lead_id: leadId,
    p_platform: platform,
  });
}

export async function sendInstagramMessage(leadId, text) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Sua sessão expirou. Entre novamente no painel.');
  }

  const response = await fetch('/api/instagram-send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      lead_id: leadId,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível enviar a mensagem.');
  }

  return data;
}


export async function sendWhatsAppMessage(leadId, text) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Sua sessão expirou. Entre novamente no painel.');
  }

  const response = await fetch('/api/whatsapp-send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      lead_id: leadId,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível enviar a mensagem pelo WhatsApp.');
  }

  return data;
}


export async function getIntegrationEvents() {
  return supabase.from('integration_events').select('*').order('created_at', { ascending: false }).limit(30);
}


export async function getLeadSourceHistory(leadId) {
  return supabase
    .from('lead_source_history')
    .select('*')
    .eq('lead_id', leadId)
    .order('occurred_at', { ascending: false });
}

export async function getResponseTemplates(channel = 'instagram') {
  const { data, error } = await supabase
    .from('response_templates')
    .select('id,name,channel,content,sort_order,active')
    .eq('active', true)
    .in('channel', ['all', channel])
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  return { data, error };
}

export async function getUnreadInstagramCount() {
  return supabase.rpc('admin_unread_social_count_by_platform', {
    p_platform: 'instagram',
  });
}

export async function getUnreadWhatsAppCount() {
  return supabase.rpc('admin_unread_social_count_by_platform', {
    p_platform: 'whatsapp',
  });
}

export async function markLeadSocialUnread(leadId, platform = 'instagram') {
  return supabase.rpc('mark_channel_conversation_unread', {
    p_lead_id: leadId,
    p_platform: platform,
  });
}

export async function getChannelPerformance(daysBack = 30) {
  return supabase.rpc('admin_channel_performance', {
    days_back: daysBack,
  });
}

export async function getDailyRoutineData() {
  const [leadsResult, capturesResult, appointmentsResult, proposalsResult] = await Promise.all([
    getLeads(),
    getOwnerCaptures(),
    getAppointments(),
    getProposals(),
  ]);

  return {
    data: {
      leads: leadsResult.data || [],
      captures: capturesResult.data || [],
      appointments: appointmentsResult.data || [],
      proposals: proposalsResult.data || [],
    },
    error: leadsResult.error || capturesResult.error || appointmentsResult.error || proposalsResult.error || null,
  };
}

export async function completeLeadNextAction(item) {
  const text = item?.next_action_text?.trim() || 'Ação de atendimento';
  const { data, error } = await updateLead(item.id, {
    next_action_text: null,
    next_action_at: null,
  });

  if (error) return { data, error };
  await addLeadNote(item.id, `Ação concluída: ${text}`);
  return { data, error: null };
}

export async function completeCaptureNextAction(item) {
  const text = item?.next_action_text?.trim() || 'Ação de captação';
  const { data, error } = await updateOwnerCapture(item.id, {
    next_action_text: null,
    next_action_at: null,
  });

  if (error) return { data, error };
  await addCaptureNote(item.id, `Ação concluída: ${text}`);
  return { data, error: null };
}

export async function rescheduleLeadNextAction(item, nextActionAt) {
  return updateLead(item.id, {
    next_action_at: nextActionAt,
  });
}

export async function rescheduleCaptureNextAction(item, nextActionAt) {
  return updateOwnerCapture(item.id, {
    next_action_at: nextActionAt,
  });
}

export async function refreshExpiredProposals() {
  return supabase.rpc('admin_refresh_expired_proposals');
}

export async function getProposals() {
  await refreshExpiredProposals();

  return supabase
    .from('proposals')
    .select(`
      *,
      lead:leads(id,name,whatsapp,email,status,source_platform,source_channel),
      property:properties(id,code,title,slug,public_location_text,status,sale_price,rent_price)
    `)
    .order('updated_at', { ascending: false });
}

export async function getProposal(id) {
  await refreshExpiredProposals();

  return supabase
    .from('proposals')
    .select(`
      *,
      lead:leads(id,name,whatsapp,email,status,property_id),
      property:properties(id,code,title,slug,public_location_text,status,sale_price,rent_price)
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function getLeadProposals(leadId) {
  await refreshExpiredProposals();

  return supabase
    .from('proposals')
    .select(`
      *,
      property:properties(id,code,title,slug,public_location_text)
    `)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
}

export async function createProposal(payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return supabase
    .from('proposals')
    .insert({
      ...payload,
      created_by: user?.id || null,
    })
    .select(`
      *,
      lead:leads(id,name,whatsapp,email,status),
      property:properties(id,code,title,slug)
    `)
    .single();
}

export async function updateProposal(id, payload) {
  return supabase
    .from('proposals')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      lead:leads(id,name,whatsapp,email,status),
      property:properties(id,code,title,slug)
    `)
    .single();
}

export async function deleteProposal(id) {
  return supabase.from('proposals').delete().eq('id', id);
}

export async function getProposalStatusHistory(proposalId) {
  return supabase
    .from('proposal_status_history')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });
}

export async function getProposalMetrics(daysBack = 90) {
  await refreshExpiredProposals();
  return supabase.rpc('admin_proposal_metrics', { days_back: daysBack });
}

export async function getProposalFormOptions() {
  const [leadsResult, propertiesResult] = await Promise.all([
    supabase
      .from('leads')
      .select('id,name,whatsapp,email,status,property_id')
      .not('status', 'eq', 'lost')
      .order('name', { ascending: true }),
    supabase
      .from('properties')
      .select('id,code,title,slug,status,sale_price,rent_price,public_location_text')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  return {
    data: {
      leads: leadsResult.data || [],
      properties: propertiesResult.data || [],
    },
    error: leadsResult.error || propertiesResult.error || null,
  };
}

export async function closeLeadFromProposal(proposal) {
  if (!proposal?.id) {
    return { data: null, error: new Error('Proposta não informada.') };
  }

  return supabase.rpc('admin_create_deal_from_proposal', {
    p_proposal_id: proposal.id,
  });
}

export async function getDeals() {
  return supabase
    .from('deals')
    .select(`
      *,
      lead:leads(id,name,whatsapp,email,status),
      proposal:proposals(id,code,status,proposal_value),
      property:properties(id,code,title,slug,purpose,status,public_location_text),
      documents:deal_documents(id,status,party)
    `)
    .order('created_at', { ascending: false });
}

export async function getDeal(id) {
  return supabase
    .from('deals')
    .select(`
      *,
      lead:leads(id,name,whatsapp,email,status),
      proposal:proposals(id,code,status,proposal_value,payment_terms,conditions),
      property:properties(id,code,title,slug,purpose,status,public_location_text,sale_price,rent_price),
      documents:deal_documents(*)
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function getDealByProposal(proposalId) {
  if (!proposalId) return { data: null, error: null };
  return supabase
    .from('deals')
    .select('id,code,status,commission_status,commission_value,commission_received_amount')
    .eq('proposal_id', proposalId)
    .maybeSingle();
}

export async function getDealByLead(leadId) {
  if (!leadId) return { data: null, error: null };
  return supabase
    .from('deals')
    .select('id,code,status,sale_value,commission_value,commission_status,commission_received_amount')
    .eq('lead_id', leadId)
    .maybeSingle();
}

export async function updateDeal(id, payload) {
  return supabase
    .from('deals')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      lead:leads(id,name,whatsapp,email,status),
      proposal:proposals(id,code,status,proposal_value),
      property:properties(id,code,title,slug,purpose,status,public_location_text),
      documents:deal_documents(*)
    `)
    .single();
}

export async function updateDealDocument(id, payload) {
  return supabase
    .from('deal_documents')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
}

export async function getDealStatusHistory(dealId) {
  return supabase
    .from('deal_status_history')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });
}

export async function getDealMetrics(daysBack = 365) {
  return supabase.rpc('admin_deal_metrics', { days_back: daysBack });
}


export async function getExecutiveDashboardMetrics(daysBack = 30) {
  return supabase.rpc('executive_dashboard_metrics', { p_days_back: daysBack });
}


export async function getCommercialFunnelMetrics(daysBack = 30) {
  return supabase.rpc('commercial_funnel_metrics', { p_days_back: daysBack });
}
