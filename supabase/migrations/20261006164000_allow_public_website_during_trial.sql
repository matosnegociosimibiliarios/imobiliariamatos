create or replace function public.organization_public_website_allowed(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
 select case
  when coalesce(s.plan_code,o.plan_code)='internal' then true
  when s.status='trialing' and coalesce(s.trial_ends_at,o.trial_ends_at)>now() then true
  when coalesce((p.features->>'all')::boolean,false) then true
  else coalesce((p.features->>'website')::boolean,false)
 end
 from public.organizations o
 left join public.saas_subscriptions s on s.organization_id=o.id
 left join public.saas_plans p on p.code=coalesce(s.plan_code,o.plan_code)
 where o.id=p_organization_id and o.status in ('trial','active')
 limit 1
$function$;
