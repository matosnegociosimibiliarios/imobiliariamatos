CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.role_permissions_json(p_role text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_role
    when 'owner' then jsonb_build_object(
      'dashboard.view', true,'management.view', true,'management.manage', true,'reports.view', true,'analytics.view', true,'properties.view', true,'properties.manage', true,'leads.view', true,'leads.manage', true,'appointments.view', true,'appointments.manage', true,'captures.view', true,'captures.manage', true,'proposals.view', true,'proposals.manage', true,'deals.view', true,'deals.manage', true,'financial.view', true,'documents.view', true,'documents.manage', true,'messages.view', true,'messages.respond', true,'integrations.manage', true,'health.view', true,'team.view', true,'team.manage', true,'settings.manage', true,'rentals.view', true,'rentals.manage', true,'rentals.financial', true)
    when 'admin' then jsonb_build_object(
      'dashboard.view', true,'management.view', true,'management.manage', true,'reports.view', true,'analytics.view', true,'properties.view', true,'properties.manage', true,'leads.view', true,'leads.manage', true,'appointments.view', true,'appointments.manage', true,'captures.view', true,'captures.manage', true,'proposals.view', true,'proposals.manage', true,'deals.view', true,'deals.manage', true,'financial.view', true,'documents.view', true,'documents.manage', true,'messages.view', true,'messages.respond', true,'integrations.manage', true,'health.view', true,'team.view', true,'team.manage', true,'settings.manage', true,'rentals.view', true,'rentals.manage', true,'rentals.financial', true)
    when 'broker' then jsonb_build_object(
      'dashboard.view', true,'management.view', true,'management.manage', false,'reports.view', true,'analytics.view', true,'properties.view', true,'properties.manage', true,'leads.view', true,'leads.manage', true,'appointments.view', true,'appointments.manage', true,'captures.view', true,'captures.manage', true,'proposals.view', true,'proposals.manage', true,'deals.view', true,'deals.manage', true,'financial.view', false,'documents.view', true,'documents.manage', true,'messages.view', true,'messages.respond', true,'integrations.manage', false,'health.view', false,'team.view', true,'team.manage', false,'settings.manage', false,'rentals.view', true,'rentals.manage', true,'rentals.financial', false)
    else jsonb_build_object(
      'dashboard.view', true,'management.view', false,'management.manage', false,'reports.view', false,'analytics.view', false,'properties.view', true,'properties.manage', false,'leads.view', true,'leads.manage', true,'appointments.view', true,'appointments.manage', true,'captures.view', true,'captures.manage', true,'proposals.view', true,'proposals.manage', false,'deals.view', false,'deals.manage', false,'financial.view', false,'documents.view', true,'documents.manage', true,'messages.view', true,'messages.respond', true,'integrations.manage', false,'health.view', false,'team.view', true,'team.manage', false,'settings.manage', false,'rentals.view', true,'rentals.manage', true,'rentals.financial', false)
  end;
$function$;

CREATE OR REPLACE FUNCTION public.current_organization_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.organization_id
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_team_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.role
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.effective_permissions_json()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when m.role = 'owner' then public.role_permissions_json('owner')
    else coalesce(public.role_permissions_json(m.role), '{}'::jsonb)
         || coalesce(m.permissions, '{}'::jsonb)
  end
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end, m.created_at
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((public.effective_permissions_json()->>p_permission)::boolean, false)
      or public.is_admin();
$function$;

CREATE OR REPLACE FUNCTION public.can_access_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin()
      or exists (
        select 1 from public.organization_members m
        where m.user_id = auth.uid() and m.status = 'active'
      );
$function$;

CREATE OR REPLACE FUNCTION public.current_access_context()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'organization_id', m.organization_id,'organization_name', o.name,'organization_slug', o.slug,'plan_code', o.plan_code,'user_id', p.id,'full_name', p.full_name,'email', p.email,'role', m.role,'status', m.status,
    'permissions', case when m.role = 'owner' then public.role_permissions_json('owner') else public.role_permissions_json(m.role) || coalesce(m.permissions, '{}'::jsonb) end
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid() and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end, m.created_at
  limit 1;
$function$;;
