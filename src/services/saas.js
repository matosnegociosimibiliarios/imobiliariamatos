import { supabase } from '../lib/supabase';
export async function getSaasEntitlement(){return supabase.rpc('current_saas_entitlement');}
export async function getSaasPlans(){return supabase.from('saas_plans').select('code,name,description,monthly_price,annual_price,limits,features,is_public,sort_order').eq('is_active',true).order('sort_order');}
export function isActiveTrial(e){
  if(!e||e.subscription_status!=='trialing'||!e.trial_ends_at)return false;
  return new Date(e.trial_ends_at).getTime()>Date.now();
}
export function hasSaasFeature(e,f){
  if(!e)return false;
  if(e.plan_code==='internal'||e.features?.all===true||isActiveTrial(e))return true;
  return e.features?.[f]===true;
}
export function saasLimit(e,l){
  if(isActiveTrial(e)) return -1;
  const v=Number(e?.limits?.[l]);return Number.isFinite(v)?v:0;
}

export async function isPlatformAdmin(){return supabase.rpc('is_platform_admin');}
export async function getPlatformAdminOverview(){return supabase.rpc('platform_admin_overview');}
