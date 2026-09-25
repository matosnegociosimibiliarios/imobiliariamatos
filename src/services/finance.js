import { supabase } from '../lib/supabase';

export const FINANCE_STATUS_LABELS = { pending:'Pendente', paid:'Pago', cancelled:'Cancelado' };
export const FINANCE_DIRECTION_LABELS = { income:'Receita', expense:'Despesa' };
export const FINANCE_ACCOUNT_TYPES = { bank:'Banco', cash:'Caixa', card:'Cartão', investment:'Investimento', other:'Outro' };

export async function getFinanceAccounts() { return supabase.from('finance_accounts').select('*').eq('active',true).order('name'); }
export async function getFinanceCategories(direction=null) { let q=supabase.from('finance_categories').select('*').eq('active',true).order('name'); if(direction) q=q.or(`direction.eq.${direction},direction.eq.both`); return q; }
export async function getFinanceEntries({startDate,endDate,status='all'}={}) { let q=supabase.from('finance_entries').select('*,account:finance_accounts(id,name,account_type),category:finance_categories(id,name,direction)').order('due_date',{ascending:false}).order('created_at',{ascending:false}); if(startDate)q=q.gte('due_date',startDate); if(endDate)q=q.lte('due_date',endDate); if(status!=='all')q=q.eq('status',status); return q; }
export async function getFinanceSummary({startDate,endDate}={}) {
 const [e,a]=await Promise.all([getFinanceEntries({startDate,endDate}),getFinanceAccounts()]);
 const entries=e.data||[], company=entries.filter(x=>!x.managed_funds), managed=entries.filter(x=>x.managed_funds), paid=company.filter(x=>x.status==='paid'), pending=company.filter(x=>x.status==='pending');
 const sum=(xs,d)=>xs.filter(x=>x.direction===d).reduce((n,x)=>n+Number(x.amount||0),0);
 return {data:{incomePaid:sum(paid,'income'),expensePaid:sum(paid,'expense'),incomePending:sum(pending,'income'),expensePending:sum(pending,'expense'),balance:sum(paid,'income')-sum(paid,'expense'),managedIncome:sum(managed.filter(x=>x.status==='paid'),'income'),managedExpense:sum(managed.filter(x=>x.status==='paid'),'expense'),entries:company,managedEntries:managed,accounts:a.data||[]},error:e.error||a.error||null};
}
export async function getFinanceDashboardMetrics(startDate,endDate){ return supabase.rpc('finance_dashboard_metrics',{p_start_date:startDate,p_end_date:endDate}); }
export async function createFinanceAccount(name,accountType='bank',openingBalance=0){ return supabase.rpc('create_finance_account',{p_name:name,p_account_type:accountType,p_opening_balance:Number(openingBalance)||0}); }
export async function updateFinanceAccount(id,payload){ return supabase.rpc('update_finance_account',{p_id:id,p_name:payload.name,p_account_type:payload.account_type,p_active:payload.active}); }
export async function createFinanceCategory(name,direction){ return supabase.rpc('create_finance_category',{p_name:name,p_direction:direction}); }
export async function updateFinanceCategory(id,payload){ return supabase.rpc('update_finance_category',{p_id:id,p_name:payload.name,p_direction:payload.direction,p_active:payload.active}); }
export async function createFinanceEntry(payload){ return supabase.rpc('create_finance_entry_secure',{p_description:payload.description,p_direction:payload.direction,p_amount:Number(payload.amount),p_due_date:payload.due_date||null,p_status:payload.status,p_account_id:payload.account_id,p_category_id:payload.category_id||null,p_notes:payload.notes||null,p_paid_at:payload.paid_at||null,p_managed_funds:!!payload.managed_funds,p_property_id:payload.property_id||null,p_deal_id:payload.deal_id||null,p_lead_id:payload.lead_id||null,p_rental_charge_id:payload.rental_charge_id||null,p_rental_payment_id:payload.rental_payment_id||null,p_rental_transfer_id:payload.rental_transfer_id||null}); }
export async function updateFinanceEntry(id,payload){ return supabase.rpc('update_finance_entry_secure',{p_id:id,p_description:payload.description,p_direction:payload.direction,p_amount:Number(payload.amount),p_due_date:payload.due_date||null,p_status:payload.status,p_account_id:payload.account_id,p_category_id:payload.category_id||null,p_notes:payload.notes||null,p_paid_at:payload.paid_at||null}); }
export async function deleteFinanceEntry(id){ return supabase.rpc('delete_finance_entry_secure',{p_id:id}); }
export async function getRecurringFinanceEntries(){ return supabase.from('finance_recurring_entries').select('*,account:finance_accounts(id,name),category:finance_categories(id,name,direction)').order('next_due_date'); }
export async function saveRecurringFinanceEntry(payload,id=null){ let q=id?supabase.from('finance_recurring_entries').update(payload).eq('id',id):supabase.from('finance_recurring_entries').insert(payload); return q.select('*').single(); }
export async function deleteRecurringFinanceEntry(id){ return supabase.from('finance_recurring_entries').delete().eq('id',id); }
export async function generateDueRecurringFinanceEntries(untilDate){ return supabase.rpc('generate_due_recurring_finance_entries',{p_until_date:untilDate}); }
