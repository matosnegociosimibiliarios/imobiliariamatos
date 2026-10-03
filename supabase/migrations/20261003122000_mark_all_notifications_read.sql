create or replace function public.mark_all_app_notifications_read(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  ) then
    raise exception 'Acesso negado';
  end if;

  insert into public.app_notification_reads (notification_id, user_id)
  select n.id, auth.uid()
  from public.app_notifications n
  where n.organization_id = p_organization_id
  on conflict (notification_id, user_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_app_notifications_read(uuid) from public;
grant execute on function public.mark_all_app_notifications_read(uuid) to authenticated;
