create or replace function public.get_public_agency_settings(p_organization_slug text)
returns public.agency_public_settings
language sql
stable
security definer
set search_path = public
as $function$
  select s
  from public.agency_public_settings s
  join public.organizations o on o.id = s.organization_id
  where o.slug = lower(trim(p_organization_slug))
    and o.status in ('trial','active')
  limit 1;
$function$;

revoke execute on function public.get_public_agency_settings(text) from public;
grant execute on function public.get_public_agency_settings(text) to anon, authenticated;
