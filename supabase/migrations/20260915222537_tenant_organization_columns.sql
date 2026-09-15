create or replace function public.assign_tenant_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_count integer;
begin
  if new.organization_id is not null then
    return new;
  end if;

  v_org := public.current_organization_id();

  if v_org is null then
    select count(*) into v_count
    from public.organizations
    where status = 'active';

    if v_count <> 1 then
      raise exception 'Organization context is required';
    end if;

    select id into v_org
    from public.organizations
    where status = 'active'
    limit 1;
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

revoke all on function public.assign_tenant_organization_id() from public, anon, authenticated;

do $$
declare
  t text;
  v_org uuid;
  v_count integer;
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
  select count(*) into v_count
  from public.organizations
  where status = 'active';

  if v_count <> 1 then
    raise exception 'This migration requires exactly one active organization for safe backfill; found %', v_count;
  end if;

  select id into v_org
  from public.organizations
  where status = 'active'
  limit 1;

  foreach t in array tables loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema='public' and table_name=t and column_name='organization_id'
    ) then
      execute format('alter table public.%I add column organization_id uuid', t);
    end if;

    execute format('update public.%I set organization_id = $1 where organization_id is null', t) using v_org;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = format('public.%I', t)::regclass
        and conname = t || '_organization_id_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (organization_id) references public.organizations(id) on delete restrict',
        t, t || '_organization_id_fkey'
      );
    end if;

    execute format('alter table public.%I alter column organization_id set default public.current_organization_id()', t);
    execute format('alter table public.%I alter column organization_id set not null', t);
    execute format('create index if not exists %I on public.%I (organization_id)', t || '_organization_id_idx', t);

    execute format('drop trigger if exists trg_assign_tenant_organization_id on public.%I', t);
    execute format(
      'create trigger trg_assign_tenant_organization_id before insert on public.%I for each row execute function public.assign_tenant_organization_id()',
      t
    );
  end loop;
end $$;;
