import { supabase } from '../lib/supabase';

export const PROPERTY_FEEDBACK_OPTIONS = [
  ['liked', 'Gostou'],
  ['not_liked', 'Não gostou'],
  ['expensive', 'Achou caro'],
  ['old', 'Imóvel antigo'],
  ['needs_renovation', 'Precisa de reforma'],
  ['location', 'Localização não agradou'],
  ['small', 'Achou pequeno'],
  ['large', 'Achou grande demais'],
  ['no_parking', 'Falta de vaga'],
  ['documentation', 'Documentação'],
  ['other', 'Outro'],
];

export const PROPERTY_FEEDBACK_LABELS = Object.fromEntries(PROPERTY_FEEDBACK_OPTIONS);

function daysSince(value) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export async function getPropertyIndicatorsDataset() {
  const [
    propertiesResult,
    managementResult,
    leadsResult,
    appointmentsResult,
    proposalsResult,
    profilesResult,
    settingsResult,
    historyResult,
  ] = await Promise.all([
    supabase.from('properties').select('id,code,title,purpose,status,sale_price,rent_price,public_location_text,created_at,published_at').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('property_management').select('property_id,owner_name,owner_whatsapp,owner_email,listing_started_at'),
    supabase.from('leads').select('id,property_id,name,whatsapp,email,status,assigned_to,property_feedback_code,property_feedback_notes,created_at').not('property_id', 'is', null),
    supabase.from('appointments').select('id,lead_id,property_id,status,scheduled_at,requested_date,assigned_to,feedback_code,feedback_notes,notes,created_at').not('property_id', 'is', null),
    supabase.from('proposals').select('id,code,lead_id,property_id,status,proposal_value,assigned_to,feedback_code,feedback_notes,created_at').not('property_id', 'is', null),
    supabase.from('profiles').select('id,full_name,email'),
    supabase.from('property_owner_report_settings').select('*'),
    supabase.from('property_owner_report_history').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  const error = propertiesResult.error || managementResult.error || leadsResult.error || appointmentsResult.error
    || proposalsResult.error || profilesResult.error || settingsResult.error || historyResult.error;
  if (error) return { data: null, error };

  const profiles = new Map((profilesResult.data || []).map((item) => [item.id, item]));
  const management = new Map((managementResult.data || []).map((item) => [item.property_id, item]));
  const settings = new Map((settingsResult.data || []).map((item) => [item.property_id, item]));

  const properties = (propertiesResult.data || []).map((property) => {
    const propertyLeads = (leadsResult.data || []).filter((item) => item.property_id === property.id);
    const propertyAppointments = (appointmentsResult.data || []).filter((item) => item.property_id === property.id);
    const propertyProposals = (proposalsResult.data || []).filter((item) => item.property_id === property.id);
    const completedVisits = propertyAppointments.filter((item) => item.status === 'completed');

    const feedback = [
      ...propertyLeads.filter((item) => item.property_feedback_code || item.property_feedback_notes).map((item) => ({
        id: 'lead-' + item.id,
        stage: 'Atendimento',
        client: item.name,
        broker: profiles.get(item.assigned_to)?.full_name || 'Não definido',
        code: item.property_feedback_code,
        notes: item.property_feedback_notes,
        date: item.created_at,
      })),
      ...propertyAppointments.filter((item) => item.feedback_code || item.feedback_notes).map((item) => {
        const lead = propertyLeads.find((leadItem) => leadItem.id === item.lead_id);
        return {
          id: 'appointment-' + item.id,
          stage: 'Visita',
          client: lead?.name || 'Cliente',
          broker: profiles.get(item.assigned_to)?.full_name || profiles.get(lead?.assigned_to)?.full_name || 'Não definido',
          code: item.feedback_code,
          notes: item.feedback_notes,
          date: item.scheduled_at || item.requested_date || item.created_at,
        };
      }),
      ...propertyProposals.filter((item) => item.feedback_code || item.feedback_notes).map((item) => {
        const lead = propertyLeads.find((leadItem) => leadItem.id === item.lead_id);
        return {
          id: 'proposal-' + item.id,
          stage: 'Proposta',
          client: lead?.name || 'Cliente',
          broker: profiles.get(item.assigned_to)?.full_name || profiles.get(lead?.assigned_to)?.full_name || 'Não definido',
          code: item.feedback_code,
          notes: item.feedback_notes,
          date: item.created_at,
        };
      }),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const feedbackCounts = feedback.reduce((acc, item) => {
      const key = item.code || 'other';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const startedAt = management.get(property.id)?.listing_started_at || property.published_at || property.created_at;

    return {
      ...property,
      management: management.get(property.id) || null,
      report_settings: settings.get(property.id) || null,
      report_history: (historyResult.data || []).filter((item) => item.property_id === property.id),
      days_announced: daysSince(startedAt),
      leads_count: propertyLeads.length,
      visits_count: propertyAppointments.length,
      completed_visits_count: completedVisits.length,
      proposals_count: propertyProposals.length,
      clients: propertyLeads.map((lead) => ({
        ...lead,
        broker_name: profiles.get(lead.assigned_to)?.full_name || 'Não definido',
      })),
      appointments: propertyAppointments.map((item) => ({
        ...item,
        client_name: propertyLeads.find((lead) => lead.id === item.lead_id)?.name || 'Cliente',
        broker_name: profiles.get(item.assigned_to)?.full_name || profiles.get(propertyLeads.find((lead) => lead.id === item.lead_id)?.assigned_to)?.full_name || 'Não definido',
      })),
      proposals: propertyProposals.map((item) => ({
        ...item,
        client_name: propertyLeads.find((lead) => lead.id === item.lead_id)?.name || 'Cliente',
        broker_name: profiles.get(item.assigned_to)?.full_name || profiles.get(propertyLeads.find((lead) => lead.id === item.lead_id)?.assigned_to)?.full_name || 'Não definido',
      })),
      feedback,
      feedback_counts: feedbackCounts,
    };
  });

  return { data: properties, error: null };
}

export async function savePropertyOwnerReportSettings(propertyId, payload) {
  return supabase
    .from('property_owner_report_settings')
    .upsert({ property_id: propertyId, ...payload }, { onConflict: 'property_id' })
    .select()
    .single();
}

export async function saveLeadPropertyFeedback(leadId, code, notes) {
  return supabase.from('leads').update({
    property_feedback_code: code || null,
    property_feedback_notes: notes?.trim() || null,
  }).eq('id', leadId).select().single();
}

export async function saveAppointmentFeedback(appointmentId, code, notes) {
  return supabase.from('appointments').update({
    feedback_code: code || null,
    feedback_notes: notes?.trim() || null,
  }).eq('id', appointmentId).select().single();
}

export async function saveProposalFeedback(proposalId, code, notes) {
  return supabase.from('proposals').update({
    feedback_code: code || null,
    feedback_notes: notes?.trim() || null,
  }).eq('id', proposalId).select().single();
}
