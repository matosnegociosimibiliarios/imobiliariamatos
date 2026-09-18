import { supabase } from '../lib/supabase';

export const RENTAL_STATUS_LABELS = {
  analysis: 'Em análise',
  documents: 'Documentação',
  awaiting_signature: 'Aguardando assinatura',
  active: 'Ativo',
  ending: 'Próximo do fim',
  ended: 'Encerrado',
  cancelled: 'Cancelado',
};

export const RENTAL_PAYMENT_STATUS_LABELS = {
  pending: 'Pendente',
  overdue: 'Atrasado',
  partial: 'Parcial',
  paid: 'Pago',
  waived: 'Dispensado',
};

export const RENTAL_GUARANTEE_LABELS = {
  none: 'Sem garantia',
  deposit: 'Caução',
  guarantor: 'Fiador',
  insurance: 'Seguro-fiança',
  capitalization: 'Título de capitalização',
  other: 'Outra',
};

export const RENTAL_INSPECTION_LABELS = {
  entry: 'Entrada',
  periodic: 'Periódica',
  exit: 'Saída',
};

export const RENTAL_MAINTENANCE_STATUS_LABELS = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  waiting: 'Aguardando',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function getRentalMetrics() {
  return supabase.rpc('rental_dashboard_metrics');
}

export async function getRentalContracts() {
  return supabase
    .from('rental_contracts')
    .select(`
      *,
      property:properties(id,code,title,public_location_text,rent_price,purpose,status),
      lead:leads(id,name,whatsapp,email)
    `)
    .order('created_at', { ascending: false });
}

export async function getRentalContract(id) {
  return supabase
    .from('rental_contracts')
    .select(`
      *,
      property:properties(id,code,title,public_location_text,rent_price,purpose,status),
      lead:leads(id,name,whatsapp,email)
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function getRentalFormOptions() {
  const [properties, leads] = await Promise.all([
    supabase
      .from('properties')
      .select('id,code,title,public_location_text,rent_price,purpose,status')
      .is('deleted_at', null)
      .in('purpose', ['rent', 'sale_and_rent'])
      .order('created_at', { ascending: false }),
    supabase
      .from('leads')
      .select('id,name,whatsapp,email,status')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  return {
    data: {
      properties: properties.data || [],
      leads: leads.data || [],
    },
    error: properties.error || leads.error || null,
  };
}

export async function saveRentalContract(payload, id = null) {
  if (id) {
    return supabase
      .from('rental_contracts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
  }

  return supabase
    .from('rental_contracts')
    .insert(payload)
    .select()
    .single();
}

export async function deleteRentalContract(id) {
  return supabase.from('rental_contracts').delete().eq('id', id);
}

export async function generateRentalPayments(contractId) {
  return supabase.rpc('generate_rental_payment_schedule', { p_contract_id: contractId });
}

export async function refreshRentalPaymentStatuses() {
  return supabase.rpc('refresh_rental_payment_statuses');
}

export async function getRentalPayments(contractId) {
  return supabase
    .from('rental_payments')
    .select('*')
    .eq('contract_id', contractId)
    .order('reference_month');
}

export async function registerRentalPayment(paymentId, payload) {
  return supabase.rpc('register_rental_payment', {
    p_payment_id: paymentId,
    p_paid_amount: Number(payload.paid_amount || 0),
    p_paid_at: payload.paid_at || new Date().toISOString(),
    p_payment_method: payload.payment_method || null,
    p_account_id: payload.account_id || null,
    p_notes: payload.notes || null,
  });
}

export async function getRentalTransfers(contractId) {
  return supabase.from('rental_transfers').select('*').eq('contract_id', contractId).order('due_date', { ascending: false });
}

export async function createRentalTransferForPayment(paymentId, accountId = null, dueDate = null) {
  return supabase.rpc('create_rental_transfer_for_payment', {
    p_payment_id: paymentId,
    p_account_id: accountId,
    p_due_date: dueDate,
  });
}

export async function updateRentalPayment(id, payload) {
  return supabase.from('rental_payments').update(payload).eq('id', id).select().single();
}

export async function getRentalInspections(contractId) {
  return supabase
    .from('rental_inspections')
    .select('*')
    .eq('contract_id', contractId)
    .order('scheduled_at', { ascending: false, nullsFirst: false });
}

export async function createRentalInspection(payload) {
  return supabase.from('rental_inspections').insert(payload).select().single();
}

export async function updateRentalInspection(id, payload) {
  return supabase.from('rental_inspections').update(payload).eq('id', id).select().single();
}

export async function getRentalMaintenance(contractId) {
  return supabase
    .from('rental_maintenance')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });
}

export async function createRentalMaintenance(payload) {
  return supabase.from('rental_maintenance').insert(payload).select().single();
}

export async function updateRentalMaintenance(id, payload) {
  return supabase.from('rental_maintenance').update(payload).eq('id', id).select().single();
}

export async function getRentalChecklist(contractId) {
  return supabase
    .from('rental_documents')
    .select('*')
    .eq('contract_id', contractId)
    .order('display_order');
}

export async function updateRentalChecklistItem(id, payload) {
  return supabase.from('rental_documents').update(payload).eq('id', id).select().single();
}

export async function getRentalHistory(contractId) {
  return supabase
    .from('rental_status_history')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });
}
