import { supabase } from '../lib/supabase';

const ACTIVE_PROPERTY_STATUSES = new Set(['draft', 'published', 'reserved']);

function dayDiff(from, to = new Date()) {
  if (!from) return null;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86400000));
}

function normalizeManagement(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function latestDate(values) {
  const dates = values.filter(Boolean).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime()));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
}

function incrementMetric(map, propertyId, createdAt, field) {
  if (!propertyId) return;
  const current = map.get(propertyId) || {
    leads_count: 0,
    visits_count: 0,
    proposals_count: 0,
    deals_count: 0,
    activity_dates: [],
  };
  current[field] += 1;
  if (createdAt) current.activity_dates.push(createdAt);
  map.set(propertyId, current);
}

function buildAlerts(property, management, metrics, now = new Date()) {
  const alerts = [];
  const active = ACTIVE_PROPERTY_STATUSES.has(property.status);
  const daysInactive = dayDiff(metrics.last_activity_at || property.created_at, now) ?? 0;

  if (!management?.owner_name?.trim()) alerts.push('Sem proprietário identificado');
  if (management?.documentation_status !== 'complete') alerts.push('Documentação incompleta');

  if (active && management?.authorization_status === 'pending') {
    alerts.push('Autorização pendente');
  }

  if (management?.authorization_status === 'expired') {
    alerts.push('Autorização vencida');
  }

  if (management?.authorization_expires_at) {
    const expiresAt = new Date(`${management.authorization_expires_at}T23:59:59`);
    const delta = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
    if (delta < 0) alerts.push('Autorização vencida');
    else if (delta <= 15) alerts.push(`Autorização vence em ${delta} dia${delta === 1 ? '' : 's'}`);
  }

  if (management?.exclusivity && management?.exclusivity_until) {
    const exclusivityAt = new Date(`${management.exclusivity_until}T23:59:59`);
    const delta = Math.ceil((exclusivityAt.getTime() - now.getTime()) / 86400000);
    if (delta < 0) alerts.push('Exclusividade vencida');
    else if (delta <= 15) alerts.push(`Exclusividade vence em ${delta} dia${delta === 1 ? '' : 's'}`);
  }

  if (active && daysInactive >= 30) {
    alerts.push(`Sem interação há ${daysInactive} dias`);
  }

  if (management?.next_review_at) {
    const reviewAt = new Date(management.next_review_at);
    if (!Number.isNaN(reviewAt.getTime()) && reviewAt.getTime() < now.getTime()) {
      alerts.push('Revisão do imóvel atrasada');
    }
  }

  return [...new Set(alerts)];
}

export async function getPropertyPortfolio() {
  const [propertiesResult, leadsResult, appointmentsResult, proposalsResult, dealsResult] = await Promise.all([
    supabase
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
        published_at,
        public_location_text,
        management:property_management(
          property_id,
          source_capture_id,
          owner_name,
          owner_whatsapp,
          owner_email,
          listing_started_at,
          authorization_status,
          authorization_signed_at,
          authorization_expires_at,
          exclusivity,
          exclusivity_until,
          commission_percent,
          commission_payer,
          documentation_status,
          next_review_at,
          updated_at
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('leads').select('id,property_id,created_at').not('property_id', 'is', null),
    supabase.from('appointments').select('id,property_id,created_at,status').not('property_id', 'is', null),
    supabase.from('proposals').select('id,property_id,created_at,status').not('property_id', 'is', null),
    supabase.from('deals').select('id,property_id,created_at,status').not('property_id', 'is', null),
  ]);

  const error = propertiesResult.error || leadsResult.error || appointmentsResult.error || proposalsResult.error || dealsResult.error;
  if (error) return { data: [], error };

  const metricsMap = new Map();
  (leadsResult.data || []).forEach((row) => incrementMetric(metricsMap, row.property_id, row.created_at, 'leads_count'));
  (appointmentsResult.data || []).forEach((row) => incrementMetric(metricsMap, row.property_id, row.created_at, 'visits_count'));
  (proposalsResult.data || []).forEach((row) => incrementMetric(metricsMap, row.property_id, row.created_at, 'proposals_count'));
  (dealsResult.data || []).forEach((row) => incrementMetric(metricsMap, row.property_id, row.created_at, 'deals_count'));

  const now = new Date();
  const data = (propertiesResult.data || []).map((property) => {
    const management = normalizeManagement(property.management);
    const rawMetrics = metricsMap.get(property.id) || {
      leads_count: 0,
      visits_count: 0,
      proposals_count: 0,
      deals_count: 0,
      activity_dates: [],
    };
    const lastActivity = latestDate([property.created_at, ...rawMetrics.activity_dates]);
    const metrics = {
      leads_count: rawMetrics.leads_count,
      visits_count: rawMetrics.visits_count,
      proposals_count: rawMetrics.proposals_count,
      deals_count: rawMetrics.deals_count,
      last_activity_at: lastActivity,
      inactive_days: dayDiff(lastActivity || property.created_at, now) ?? 0,
      days_in_portfolio: dayDiff(management?.listing_started_at || property.published_at || property.created_at, now) ?? 0,
    };
    const alerts = buildAlerts(property, management, metrics, now);

    return {
      ...property,
      management,
      metrics,
      alerts,
      alert_count: alerts.length,
    };
  });

  return { data, error: null };
}

export async function getPropertyManagementDetail(propertyId) {
  const [propertyResult, documentsResult, pricesResult, statusHistoryResult, leadsResult, appointmentsResult, proposalsResult, dealsResult] = await Promise.all([
    supabase
      .from('properties')
      .select(`
        *,
        management:property_management(*),
        property_images(id,storage_path,alt_text,display_order,is_cover)
      `)
      .eq('id', propertyId)
      .maybeSingle(),
    supabase
      .from('property_documents')
      .select('*')
      .eq('property_id', propertyId)
      .order('display_order'),
    supabase
      .from('property_price_history')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('property_status_history')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('leads')
      .select('id,name,whatsapp,email,status,source_platform,last_source_platform,created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('appointments')
      .select('id,status,scheduled_at,requested_date,requested_time,created_at,lead:leads(id,name,whatsapp)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('proposals')
      .select('id,code,status,proposal_value,valid_until,created_at,lead:leads(id,name)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('deals')
      .select('id,code,status,sale_value,commission_value,commission_status,created_at,lead:leads(id,name)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false }),
  ]);

  const error = propertyResult.error || documentsResult.error || pricesResult.error || statusHistoryResult.error || leadsResult.error || appointmentsResult.error || proposalsResult.error || dealsResult.error;
  if (error || !propertyResult.data) return { data: null, error: error || new Error('Imóvel não encontrado.') };

  const property = propertyResult.data;
  const management = normalizeManagement(property.management);
  const activities = [
    ...(leadsResult.data || []).map((item) => item.created_at),
    ...(appointmentsResult.data || []).map((item) => item.created_at),
    ...(proposalsResult.data || []).map((item) => item.created_at),
    ...(dealsResult.data || []).map((item) => item.created_at),
  ];
  const lastActivity = latestDate([property.created_at, ...activities]);
  const metrics = {
    leads_count: (leadsResult.data || []).length,
    visits_count: (appointmentsResult.data || []).length,
    proposals_count: (proposalsResult.data || []).length,
    deals_count: (dealsResult.data || []).filter((item) => item.status !== 'cancelled').length,
    last_activity_at: lastActivity,
    inactive_days: dayDiff(lastActivity || property.created_at) ?? 0,
    days_in_portfolio: dayDiff(management?.listing_started_at || property.published_at || property.created_at) ?? 0,
  };

  return {
    data: {
      property: { ...property, management },
      management,
      documents: documentsResult.data || [],
      priceHistory: pricesResult.data || [],
      statusHistory: statusHistoryResult.data || [],
      leads: leadsResult.data || [],
      appointments: appointmentsResult.data || [],
      proposals: proposalsResult.data || [],
      deals: dealsResult.data || [],
      metrics,
      alerts: buildAlerts(property, management, metrics),
    },
    error: null,
  };
}

export async function savePropertyManagement(propertyId, payload) {
  return supabase
    .from('property_management')
    .upsert({ property_id: propertyId, ...payload }, { onConflict: 'property_id' })
    .select()
    .single();
}

export async function updatePropertyDocument(documentId, propertyId, payload) {
  const result = await supabase
    .from('property_documents')
    .update(payload)
    .eq('id', documentId)
    .select()
    .single();

  if (!result.error) {
    await supabase.rpc('refresh_property_documentation_status', { p_property_id: propertyId });
  }

  return result;
}

export function propertyPortfolioSummary(properties = []) {
  const active = properties.filter((item) => ACTIVE_PROPERTY_STATUSES.has(item.status));
  const published = properties.filter((item) => item.status === 'published');
  const soldOrRented = properties.filter((item) => ['sold', 'rented'].includes(item.status));
  const attention = properties.filter((item) => item.alert_count > 0);
  const stale = properties.filter((item) => ACTIVE_PROPERTY_STATUSES.has(item.status) && item.metrics?.inactive_days >= 30);
  const averageDays = active.length
    ? Math.round(active.reduce((sum, item) => sum + Number(item.metrics?.days_in_portfolio || 0), 0) / active.length)
    : 0;

  return {
    total: properties.length,
    active: active.length,
    published: published.length,
    sold_or_rented: soldOrRented.length,
    attention: attention.length,
    stale: stale.length,
    average_days: averageDays,
  };
}
