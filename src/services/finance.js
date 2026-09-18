import { supabase } from '../lib/supabase';

export const FINANCE_STATUS_LABELS = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

export const FINANCE_DIRECTION_LABELS = {
  income: 'Receita',
  expense: 'Despesa',
};

export async function getFinanceAccounts() {
  return supabase
    .from('finance_accounts')
    .select('*')
    .eq('active', true)
    .order('name');
}

export async function getFinanceCategories(direction = null) {
  let query = supabase
    .from('finance_categories')
    .select('*')
    .eq('active', true)
    .order('name');
  if (direction) query = query.or(`direction.eq.${direction},direction.eq.both`);
  return query;
}

export async function getFinanceEntries({ startDate, endDate, status = 'all' } = {}) {
  let query = supabase
    .from('finance_entries')
    .select(`
      *,
      account:finance_accounts(id,name,account_type),
      category:finance_categories(id,name,direction)
    `)
    .order('due_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('due_date', startDate);
  if (endDate) query = query.lte('due_date', endDate);
  if (status !== 'all') query = query.eq('status', status);
  return query;
}

export async function getFinanceSummary({ startDate, endDate } = {}) {
  const [entriesResult, accountsResult] = await Promise.all([
    getFinanceEntries({ startDate, endDate, status: 'all' }),
    getFinanceAccounts(),
  ]);

  const entries = entriesResult.data || [];
  const companyEntries = entries.filter((entry) => !entry.managed_funds);
  const managedEntries = entries.filter((entry) => entry.managed_funds);
  const paid = companyEntries.filter((entry) => entry.status === 'paid');
  const pending = companyEntries.filter((entry) => entry.status === 'pending');
  const sum = (items, direction) => items.filter((entry) => entry.direction === direction)
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const managedSum = (direction) => managedEntries.filter((entry) => entry.status === 'paid' && entry.direction === direction)
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);

  return {
    data: {
      incomePaid: sum(paid, 'income'), expensePaid: sum(paid, 'expense'),
      incomePending: sum(pending, 'income'), expensePending: sum(pending, 'expense'),
      balance: sum(paid, 'income') - sum(paid, 'expense'),
      managedIncome: managedSum('income'), managedExpense: managedSum('expense'),
      entries: companyEntries, managedEntries, accounts: accountsResult.data || [],
    },
    error: entriesResult.error || accountsResult.error || null,
  };
}

export async function getFinanceManagedEntries({ startDate, endDate } = {}) {
  let query = supabase.from('finance_entries').select(`*, account:finance_accounts(id,name,account_type), category:finance_categories(id,name,direction)`)
    .eq('managed_funds', true).order('due_date', { ascending: false });
  if (startDate) query = query.gte('due_date', startDate);
  if (endDate) query = query.lte('due_date', endDate);
  return query;
}

export async function createFinanceEntry(payload) {
  const { data: organizationId, error: organizationError } = await supabase.rpc('current_organization_id');
  if (organizationError || !organizationId) {
    return { data: null, error: organizationError || new Error('Organização ativa não encontrada.') };
  }

  const { data: userData } = await supabase.auth.getUser();
  return supabase
    .from('finance_entries')
    .insert({
      ...payload,
      organization_id: organizationId,
      created_by: userData?.user?.id || null,
    })
    .select(`
      *,
      account:finance_accounts(id,name,account_type),
      category:finance_categories(id,name,direction)
    `)
    .single();
}

export async function updateFinanceEntry(id, payload) {
  return supabase
    .from('finance_entries')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      account:finance_accounts(id,name,account_type),
      category:finance_categories(id,name,direction)
    `)
    .single();
}

export async function deleteFinanceEntry(id) {
  return supabase.from('finance_entries').delete().eq('id', id);
}
