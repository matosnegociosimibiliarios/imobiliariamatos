do $$
declare
  r record;
  signature text;
begin
  -- Trigger/helper functions must not be callable by anonymous users.
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'apply_capture_business_rules',
        'apply_crm_document_rules',
        'apply_deal_business_rules',
        'apply_deal_document_rules',
        'apply_lead_business_rules',
        'apply_property_document_rules',
        'apply_proposal_business_rules',
        'apply_rental_document_rules',
        'apply_rental_payment_rules',
        'ensure_rental_contract_code',
        'prepare_property',
        'touch_updated_at'
      )
  loop
    signature := format('public.%I(%s)', r.proname, r.args);
    execute 'revoke execute on function ' || signature || ' from public, anon';
  end loop;
end $$;

revoke execute on function public.next_deal_code() from public, anon;
revoke execute on function public.next_proposal_code() from public, anon;
revoke execute on function public.role_permissions_json(text) from public, anon;

grant execute on function public.next_deal_code() to authenticated, service_role;
grant execute on function public.next_proposal_code() to authenticated, service_role;
grant execute on function public.role_permissions_json(text) to authenticated, service_role;

-- Public lead capture remains intentionally available to anon.
grant execute on function public.submit_public_lead(uuid,text,text,text,text,text,text,text,text,text,text)
to anon, authenticated, service_role;