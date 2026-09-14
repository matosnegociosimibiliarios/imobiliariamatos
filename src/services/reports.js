import { supabase } from '../lib/supabase';

async function safeQuery(table, select = '*') {
  const result = await supabase.from(table).select(select);
  if (result.error) throw result.error;
  return result.data || [];
}

export async function getReportsDataset() {
  try {
    const [
      properties,
      management,
      leads,
      appointments,
      captures,
      proposals,
      deals,
      crmDocuments,
      propertyDocuments,
      captureDocuments,
      dealDocuments,
    ] = await Promise.all([
      safeQuery('properties', 'id,code,title,purpose,property_type,status,sale_price,rent_price,created_at,published_at,deleted_at,city:cities(name,state_code),neighborhood:neighborhoods(name)'),
      safeQuery('property_management', 'property_id,owner_name,listing_started_at,authorization_status,authorization_expires_at,exclusivity,exclusivity_until,commission_percent,documentation_status'),
      safeQuery('leads', 'id,property_id,name,whatsapp,email,status,source,source_detail,initial_source_platform,initial_source_channel,last_source_platform,last_source_channel,deal_value,commission_value,closed_at,created_at'),
      safeQuery('appointments', 'id,lead_id,property_id,requested_date,scheduled_at,status,notes,created_at'),
      safeQuery('owner_captures', 'id,owner_name,whatsapp,email,request_type,purpose,property_type,city_name,state_code,neighborhood_name,asking_value,evaluation_value,commission_percent,source,status,converted_property_id,created_at'),
      safeQuery('proposals', 'id,code,lead_id,property_id,status,proposal_value,payment_terms,valid_until,sent_at,accepted_at,rejected_at,created_at'),
      safeQuery('deals', 'id,code,lead_id,proposal_id,property_id,status,sale_value,commission_percent,commission_value,commission_received_amount,commission_status,commission_due_date,commission_received_at,created_at,completed_at'),
      safeQuery('crm_documents', 'id,title,category,status,expires_at,property_id,lead_id,capture_id,proposal_id,deal_id,created_at'),
      safeQuery('property_documents', 'id,property_id,label,status,updated_at'),
      safeQuery('capture_documents', 'id,capture_id,label,status,updated_at'),
      safeQuery('deal_documents', 'id,deal_id,party,label,status,updated_at'),
    ]);

    return {
      data: {
        properties: properties.filter((item) => !item.deleted_at),
        management,
        leads,
        appointments,
        captures,
        proposals,
        deals,
        crmDocuments,
        propertyDocuments,
        captureDocuments,
        dealDocuments,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}
