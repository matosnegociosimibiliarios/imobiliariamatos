grant select on public.app_notifications to authenticated;
grant select, insert on public.app_notification_reads to authenticated;
grant select, insert, update on public.user_notification_preferences to authenticated;

create or replace function public.admin_notification_unread_counts(p_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    ) then jsonb_build_object('instagram',0,'whatsapp',0,'form',0,'total',0)
    else (
      select jsonb_build_object(
        'instagram', count(*) filter (where n.kind = 'instagram'),
        'whatsapp', count(*) filter (where n.kind = 'whatsapp'),
        'form', count(*) filter (where n.kind = 'form'),
        'total', count(*)
      )
      from public.app_notifications n
      where n.organization_id = p_organization_id
        and not exists (
          select 1 from public.app_notification_reads r
          where r.notification_id = n.id
            and r.user_id = auth.uid()
        )
    )
  end;
$$;

revoke all on function public.admin_notification_unread_counts(uuid) from public;
grant execute on function public.admin_notification_unread_counts(uuid) to authenticated;
