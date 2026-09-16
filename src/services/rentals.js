
export async function getRentalHistory(contractId) {
return supabase
    // ============================================================
// INTERESSADOS / INQUILINOS
// ============================================================

export async function getRentalTenants() {
  return supabase
    .from('rental_tenants')
    .select('*')
    .order('created_at', { ascending: false });
}

export async function getRentalTenant(id) {
  return supabase
    .from('rental_tenants')
    .select('*')
    .eq('id', id)
    .single();
}

export async function createRentalTenant(payload) {
  return supabase
    .from('rental_tenants')
    .insert({
      full_name: payload.full_name,
      cpf: payload.cpf || null,
      phone: payload.phone || null,
      email: payload.email || null,
      profession: payload.profession || null,
      monthly_income: payload.monthly_income || null,
      notes: payload.notes || null,
    })
    .select()
    .single();
}

export async function updateRentalTenant(id, payload) {
  return supabase
    .from('rental_tenants')
    .update({
      full_name: payload.full_name,
      cpf: payload.cpf || null,
      phone: payload.phone || null,
      email: payload.email || null,
      profession: payload.profession || null,
      monthly_income: payload.monthly_income || null,
      notes: payload.notes || null,
    })
    .eq('id', id)
    .select()
    .single();
}

export async function findSimilarRentalTenants({ cpf, phone, email }) {
  const filters = [];

  if (cpf) filters.push(`cpf.eq.${cpf}`);
  if (phone) filters.push(`phone.eq.${phone}`);
  if (email) filters.push(`email.eq.${email}`);

  if (filters.length === 0) {
    return { data: [], error: null };
  }

  return supabase
    .from('rental_tenants')
    .select('*')
    .or(filters.join(','))
    .limit(5);
}
.from('rental_status_history')
.select('*')
.eq('contract_id', contractId)
