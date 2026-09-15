create or replace function public.sync_profile_active_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_next_org uuid;
begin
  v_user := coalesce(new.user_id, old.user_id);

  select m.organization_id into v_next_org
  from public.organization_members m
  where m.user_id = v_user
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1;

  update public.profiles p
  set active_organization_id = case
        when p.active_organization_id is not null
         and exists (
           select 1
           from public.organization_members m2
           where m2.user_id = v_user
             and m2.organization_id = p.active_organization_id
             and m2.status = 'active'
         )
        then p.active_organization_id
        else v_next_org
      end,
      updated_at = now()
  where p.id = v_user;

  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_profile_active_organization() from public, anon, authenticated;

drop trigger if exists trg_sync_profile_active_organization on public.organization_members;
create trigger trg_sync_profile_active_organization
after insert or update or delete on public.organization_members
for each row execute function public.sync_profile_active_organization();

-- Repair any stale active organization pointers now.
update public.profiles p
set active_organization_id = (
  select m.organization_id
  from public.organization_members m
  where m.user_id=p.id and m.status='active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1
), updated_at=now()
where p.active_organization_id is null
   or not exists (
      select 1 from public.organization_members m
      where m.user_id=p.id
        and m.organization_id=p.active_organization_id
        and m.status='active'
   );;
