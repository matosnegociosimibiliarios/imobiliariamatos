import { supabase } from '../lib/supabase';
export async function getSaasEntitlement(){return supabase.rpc('current_saas_entitlement');}
export async function getSaasPlans(){return supabase.from('saas_plans').select('code,name,description,monthly_price,annual_price,limits,features,is_public,sort_order').eq('is_active',true).order('sort_order');}
export function hasSaasFeature(e,f){if(!e)return false;if(e.plan_code==='internal'||e.features?.all===true)return true;return e.features?.[f]===true;}
export function saasLimit(e,l){const v=Number(e?.limits?.[l]);return Number.isFinite(v)?v:0;}

export async function isPlatformAdmin(){return supabase.rpc('is_platform_admin');}
export async function getPlatformAdminOverview(){return supabase.rpc('platform_admin_overview');}
