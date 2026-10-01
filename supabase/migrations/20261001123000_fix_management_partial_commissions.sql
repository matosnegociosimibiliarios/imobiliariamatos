do $$
declare ddl text;
begin
  select pg_get_functiondef(p.oid) into ddl
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='admin_management_period'
  limit 1;
  ddl := replace(ddl,
    'coalesce(sum(d.commission_received_amount) filter (where d.commission_status = ''received''), 0)::numeric as received',
    'coalesce(sum(d.commission_received_amount), 0)::numeric as received');
  execute ddl;
end $$;