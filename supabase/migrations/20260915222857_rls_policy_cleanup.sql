drop policy if exists users_read_own_profile on public.profiles;
create policy users_read_own_profile
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists team_read_profiles on public.profiles;
create policy team_read_profiles
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members m
    where m.user_id = profiles.id
      and m.organization_id = public.current_organization_id()
      and m.status = 'active'
  )
);

drop index if exists public.crm_documents_rental_idx;;
