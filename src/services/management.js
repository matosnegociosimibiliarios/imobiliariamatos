import { supabase } from '../lib/supabase';

export async function getManagementMetrics(startDate, endDate) {
  return supabase.rpc('admin_management_period', {
    p_start_date: startDate,
    p_end_date: endDate,
  });
}

export async function getManagementChannels(startDate, endDate) {
  return supabase.rpc('admin_management_channels', {
    p_start_date: startDate,
    p_end_date: endDate,
  });
}

export async function getManagementTrend(months = 6) {
  return supabase.rpc('admin_management_trend', {
    p_months: months,
  });
}

export async function getMonthlyGoal(periodMonth) {
  return supabase
    .from('crm_monthly_goals')
    .select('*')
    .eq('period_month', periodMonth)
    .maybeSingle();
}

export async function saveMonthlyGoal(periodMonth, payload) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;

  const existing = await supabase
    .from('crm_monthly_goals')
    .select('id')
    .eq('period_month', periodMonth)
    .maybeSingle();

  if (existing.error) return existing;

  if (existing.data?.id) {
    return supabase
      .from('crm_monthly_goals')
      .update({
        ...payload,
        updated_by: userId,
      })
      .eq('id', existing.data.id)
      .select()
      .single();
  }

  return supabase
    .from('crm_monthly_goals')
    .insert({
      period_month: periodMonth,
      ...payload,
      updated_by: userId,
      created_by: userId,
    })
    .select()
    .single();
}
