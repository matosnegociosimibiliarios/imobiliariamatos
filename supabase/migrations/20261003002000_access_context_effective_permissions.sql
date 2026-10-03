create or replace function public.current_access_context()
returns jsonb
language sql
stable
security definer
set search_path='public'
as $function$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'organization_id', o.id,
    'organization_name', o.name,
    'organization_slug', o.slug,
    'organization_status', o.status,
    'plan_code', o.plan_code,
    'trial_ends_at', o.trial_ends_at,
    'primary_color', s.primary_color,
    'secondary_color', s.secondary_color,
    'profile_name', p.full_name,
    'profile_email', p.email,
    'role', m.role,
    'member_status', m.status,
    'permissions', coalesce(public.effective_permissions_json(),'{}'::jsonb)
  )
  from public.profiles p
  join public.organization_members m on m.user_id=p.id and m.organization_id=p.active_organization_id and m.status='active'
  join public.organizations o on o.id=m.organization_id
  left join public.agency_public_settings s on s.organization_id=o.id
  where p.id=auth.uid()
  limit 1
$function$;
