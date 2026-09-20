create or replace function public.create_organization(
  p_name text,
  p_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_name text := nullif(trim(p_name), '');
  v_slug text := nullif(trim(lower(coalesce(p_slug, ''))), '');
  v_org public.organizations%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Organization name must contain between 2 and 120 characters';
  end if;

  if v_slug is null then
    v_slug := regexp_replace(lower(unaccent(v_name)), '[^a-z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
  else
    v_slug := regexp_replace(lower(unaccent(v_slug)), '[^a-z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
  end if;

  if v_slug is null or length(v_slug) < 2 or length(v_slug) > 80 then
    raise exception 'Invalid organization slug';
  end if;

  if exists (select 1 from public.organizations where slug = v_slug) then
    raise exception 'Organization slug already exists';
  end if;

  insert into public.organizations (name, slug, status, plan_code, trial_ends_at)
  values (v_name, v_slug, 'trial', 'starter', now() + interval '14 days')
  returning * into v_org;

  insert into public.organization_members (
    organization_id, user_id, role, status, permissions, joined_at
  )
  values (
    v_org.id, v_user, 'owner', 'active', '{}'::jsonb, now()
  );

  update public.profiles
  set active_organization_id = v_org.id,
      updated_at = now()
  where id = v_user;

  return jsonb_build_object(
    'id', v_org.id,
    'name', v_org.name,
    'slug', v_org.slug,
    'status', v_org.status,
    'plan_code', v_org.plan_code,
    'trial_ends_at', v_org.trial_ends_at,
    'role', 'owner'
  );
exception
  when unique_violation then
    raise exception 'Organization slug already exists';
end;
$function$;

create or replace function public.list_user_organizations()
returns table (
  id uuid,
  name text,
  slug text,
  status text,
  plan_code text,
  trial_ends_at timestamptz,
  role text,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    o.id,
    o.name,
    o.slug,
    o.status,
    o.plan_code,
    o.trial_ends_at,
    m.role,
    o.id = public.current_organization_id() as is_active
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and o.status in ('trial', 'active')
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end, o.name;
$function$;

revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

revoke execute on function public.list_user_organizations() from public, anon;
grant execute on function public.list_user_organizations() to authenticated;
