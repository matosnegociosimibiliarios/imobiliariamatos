-- Public website access is a paid plan feature.
create or replace function public.organization_public_website_allowed(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='public'
as $$
 select case when coalesce(s.plan_code,o.plan_code)='internal' then true
 when coalesce((p.features->>'all')::boolean,false) then true
 else coalesce((p.features->>'website')::boolean,false) end
 from public.organizations o left join public.saas_subscriptions s on s.organization_id=o.id
 left join public.saas_plans p on p.code=coalesce(s.plan_code,o.plan_code)
 where o.id=p_organization_id and o.status in ('trial','active') limit 1
$$;
revoke execute on function public.organization_public_website_allowed(uuid) from public,anon,authenticated;
-- Production definitions of get_public_agency_settings, get_public_properties and get_public_property_by_slug
-- were updated to require organization_public_website_allowed(o.id).
