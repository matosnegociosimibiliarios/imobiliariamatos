alter table public.leads alter column organization_id drop default;
alter table public.owner_captures alter column organization_id drop default;
alter table public.appointments alter column organization_id drop default;
alter table public.site_events alter column organization_id drop default;
alter table public.site_visits alter column organization_id drop default;

do $$
declare
  r record;
  signature text;
  core_names text[] := array[
    'current_organization_id','current_team_role','effective_permissions_json','current_access_context',
    'has_permission','is_admin','can_access_admin','set_active_organization'
  ];
begin
  -- Trigger functions stay SECURITY DEFINER, but cannot be invoked directly by API roles.
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and pg_get_function_result(p.oid)='trigger'
  loop
    signature := format('public.%I(%s)', r.proname, r.args);
    execute 'revoke all on function ' || signature || ' from public, anon, authenticated';
  end loop;

  -- User-facing RPCs should run as the signed-in caller so tenant RLS is always enforced.
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and pg_get_function_result(p.oid) <> 'trigger'
      and p.proname <> 'submit_public_lead'
      and not (p.proname = any(core_names))
  loop
    signature := format('public.%I(%s)', r.proname, r.args);
    execute 'alter function ' || signature || ' security invoker';
    execute 'revoke all on function ' || signature || ' from public, anon, authenticated';
    execute 'grant execute on function ' || signature || ' to authenticated';
  end loop;

  -- Core tenant-context helpers must be SECURITY DEFINER to avoid RLS recursion,
  -- but are not callable anonymously.
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(core_names)
  loop
    signature := format('public.%I(%s)', r.proname, r.args);
    execute 'revoke all on function ' || signature || ' from public, anon, authenticated';
    execute 'grant execute on function ' || signature || ' to authenticated';
  end loop;

  -- This is the one deliberate anonymous RPC used by the public website lead form.
  revoke all on function public.submit_public_lead(uuid,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
  grant execute on function public.submit_public_lead(uuid,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;
end $$;;
