alter table public.profiles add column if not exists active_organization_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_active_organization_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_active_organization_id_fkey
      foreign key (active_organization_id)
      references public.organizations(id)
      on delete set null;
  end if;
end $$;

create index if not exists profiles_active_organization_id_idx
  on public.profiles(active_organization_id);

update public.profiles p
set active_organization_id = (
  select m.organization_id
  from public.organization_members m
  where m.user_id = p.id
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1
)
where p.active_organization_id is null;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.active_organization_id
      from public.profiles p
      where p.id = auth.uid()
        and p.active_organization_id is not null
        and exists (
          select 1
          from public.organization_members m
          where m.user_id = p.id
            and m.organization_id = p.active_organization_id
            and m.status = 'active'
        )
    ),
    (
      select m.organization_id
      from public.organization_members m
      where m.user_id = auth.uid()
        and m.status = 'active'
      order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
               m.created_at
      limit 1
    )
  );
$$;

create or replace function public.current_team_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.organization_id = public.current_organization_id()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.effective_permissions_json()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when m.role = 'owner' then public.role_permissions_json('owner')
    else coalesce(public.role_permissions_json(m.role), '{}'::jsonb)
         || coalesce(m.permissions, '{}'::jsonb)
  end
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.organization_id = public.current_organization_id()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.current_access_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'organization_id', m.organization_id,
    'organization_name', o.name,
    'organization_slug', o.slug,
    'plan_code', o.plan_code,
    'user_id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'role', m.role,
    'status', m.status,
    'permissions',
      case
        when m.role = 'owner' then public.role_permissions_json('owner')
        else public.role_permissions_json(m.role) || coalesce(m.permissions, '{}'::jsonb)
      end
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid()
    and m.organization_id = public.current_organization_id()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.user_id = auth.uid()
      and m.organization_id = public.current_organization_id()
      and m.status = 'active'
      and m.role in ('owner','admin')
  );
$$;

create or replace function public.can_access_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_organization_id() is not null;
$$;

create or replace function public.set_active_organization(p_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.user_id = auth.uid()
      and m.organization_id = p_organization_id
      and m.status = 'active'
  ) then
    raise exception 'User is not an active member of this organization';
  end if;

  update public.profiles
  set active_organization_id = p_organization_id,
      updated_at = now()
  where id = auth.uid();

  return true;
end;
$$;

revoke all on function public.set_active_organization(uuid) from public, anon;
grant execute on function public.set_active_organization(uuid) to authenticated;

drop policy if exists admins_read_profiles on public.profiles;
drop policy if exists team_read_profiles on public.profiles;
create policy team_read_profiles
on public.profiles
as permissive
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_members m
    where m.user_id = profiles.id
      and m.organization_id = public.current_organization_id()
      and m.status = 'active'
  )
);;
