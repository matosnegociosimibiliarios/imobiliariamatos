create or replace function public.saas_feature_allowed(p_feature text)
returns boolean language sql stable security definer set search_path='public' as $$
  select case
    when coalesce(s.plan_code,o.plan_code)='internal' then true
    when coalesce((p.features->>'all')::boolean,false) then true
    else coalesce((p.features->>p_feature)::boolean,false)
  end
  from public.organizations o
  left join public.saas_subscriptions s on s.organization_id=o.id
  left join public.saas_plans p on p.code=coalesce(s.plan_code,o.plan_code)
  where o.id=public.current_organization_id()
    and (
      coalesce(s.plan_code,o.plan_code)='internal'
      or (s.status='active' and s.current_period_end>now())
      or (s.status='trialing' and coalesce(s.trial_ends_at,o.trial_ends_at)>now())
      or (s.status='past_due' and s.grace_period_ends_at>now())
      or (s.status='cancelled' and s.current_period_end>now())
    )
  limit 1
$$;
revoke execute on function public.saas_feature_allowed(text) from public,anon;
grant execute on function public.saas_feature_allowed(text) to authenticated,service_role;

do $$
declare t text;
begin
  foreach t in array array['finance_accounts','finance_categories','finance_entries','finance_recurring_entries'] loop
    execute format('drop policy if exists saas_finance_feature_gate on public.%I',t);
    execute format('create policy saas_finance_feature_gate on public.%I as restrictive for all to authenticated using (public.saas_feature_allowed(''finance'')) with check (public.saas_feature_allowed(''finance''))',t);
  end loop;
  foreach t in array array['rental_adjustments','rental_cases','rental_charges','rental_collection_actions','rental_contract_tenants','rental_contracts','rental_documents','rental_guarantees','rental_inspections','rental_maintenance','rental_payments','rental_process_tenants','rental_processes','rental_stage_history','rental_status_history','rental_tenants','rental_transfers'] loop
    execute format('drop policy if exists saas_rentals_feature_gate on public.%I',t);
    execute format('create policy saas_rentals_feature_gate on public.%I as restrictive for all to authenticated using (public.saas_feature_allowed(''rentals'')) with check (public.saas_feature_allowed(''rentals''))',t);
  end loop;
  foreach t in array array['integration_events','social_messages'] loop
    execute format('drop policy if exists saas_integrations_feature_gate on public.%I',t);
    execute format('create policy saas_integrations_feature_gate on public.%I as restrictive for all to authenticated using (public.saas_feature_allowed(''integrations'')) with check (public.saas_feature_allowed(''integrations''))',t);
  end loop;
end $$;
