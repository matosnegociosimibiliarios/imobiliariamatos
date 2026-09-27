-- Security hardening prepared on 2026-09-27.
-- This migration intentionally does NOT alter the two anonymous public endpoints:
--   get_public_agency_settings(text)
--   submit_public_lead(...)
-- They are part of the public website surface and require functional testing before any privilege change.
--
-- Trigger functions are not callable by authenticated/anon roles in normal application flow.
-- Remove direct EXECUTE grants while preserving trigger execution.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_trigger t on t.tgfoid = p.oid
    where n.nspname = 'public'
      and p.prosecdef
      and not t.tgisinternal
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
  end loop;
end $$;
