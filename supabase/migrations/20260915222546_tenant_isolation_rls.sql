do $$
declare
  t text;
  tables text[] := array[
    'agency_public_settings','appointments','capture_documents','capture_notes','capture_status_history',
    'crm_documents','crm_monthly_goals','deal_documents','deal_status_history','deals','integration_events',
    'lead_notes','lead_preferences','lead_property_matches','lead_source_history','lead_status_history','leads',
    'owner_captures','properties','property_documents','property_features','property_images','property_management',
    'property_price_history','property_status_history','proposal_status_history','proposals',
    'rental_adjustments','rental_cases','rental_charges','rental_collection_actions','rental_contract_tenants',
    'rental_contracts','rental_documents','rental_guarantees','rental_inspections','rental_maintenance',
    'rental_payments','rental_process_tenants','rental_processes','rental_stage_history','rental_status_history',
    'rental_tenants','rental_transfers','response_templates','site_events','site_visits','social_messages','team_activity_log'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_authenticated on public.%I', t);
    execute format(
      'create policy tenant_isolation_authenticated on public.%I as restrictive for all to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id())',
      t
    );
  end loop;
end $$;;
