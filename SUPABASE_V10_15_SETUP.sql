-- =========================================================
-- MATOS NEGÃ“CIOS IMOBILIÃRIOS
-- VERSÃƒO 10.15 - GESTÃƒO DE LOCAÃ‡Ã•ES
-- Contratos, cobranÃ§as, vistorias, manutenÃ§Ã£o e documentos.
-- Estrutura jÃ¡ vinculada Ã  organizaÃ§Ã£o para futura evoluÃ§Ã£o SaaS.
-- =========================================================

create extension if not exists pgcrypto;

-- 1. NOVAS PERMISSÃ•ES DA ÃREA DE LOCAÃ‡ÃƒO
create or replace function public.role_permissions_json(p_role text)
returns jsonb
language sql
immutable
as $$
  select case p_role
    when 'owner' then jsonb_build_object(
      'dashboard.view', true,
      'management.view', true,
      'management.manage', true,
      'reports.view', true,
      'analytics.view', true,
      'properties.view', true,
      'properties.manage', true,
      'leads.view', true,
      'leads.manage', true,
      'appointments.view', true,
      'appointments.manage', true,
      'captures.view', true,
      'captures.manage', true,
      'proposals.view', true,
      'proposals.manage', true,
      'deals.view', true,
      'deals.manage', true,
      'financial.view', true,
      'documents.view', true,
      'documents.manage', true,
      'messages.view', true,
      'messages.respond', true,
      'rentals.view', true,
      'rentals.manage', true,
      'integrations.manage', true,
      'health.view', true,
      'team.view', true,
      'team.manage', true,
      'settings.manage', true
    )
    when 'admin' then jsonb_build_object(
      'dashboard.view', true,
      'management.view', true,
      'management.manage', true,
      'reports.view', true,
      'analytics.view', true,
      'properties.view', true,
      'properties.manage', true,
      'leads.view', true,
      'leads.manage', true,
      'appointments.view', true,
      'appointments.manage', true,
      'captures.view', true,
      'captures.manage', true,
      'proposals.view', true,
      'proposals.manage', true,
      'deals.view', true,
      'deals.manage', true,
      'financial.view', true,
      'documents.view', true,
      'documents.manage', true,
      'messages.view', true,
      'messages.respond', true,
      'rentals.view', true,
      'rentals.manage', true,
      'integrations.manage', true,
      'health.view', true,
      'team.view', true,
      'team.manage', true,
      'settings.manage', true
    )
    when 'broker' then jsonb_build_object(
      'dashboard.view', true,
      'management.view', true,
      'management.manage', false,
      'reports.view', true,
      'analytics.view', true,
      'properties.view', true,
      'properties.manage', true,
      'leads.view', true,
      'leads.manage', true,
      'appointments.view', true,
      'appointments.manage', true,
      'captures.view', true,
      'captures.manage', true,
      'proposals.view', true,
      'proposals.manage', true,
      'deals.view', true,
      'deals.manage', true,
      'financial.view', false,
      'documents.view', true,
      'documents.manage', true,
      'messages.view', true,
      'messages.respond', true,
      'rentals.view', true,
      'rentals.manage', true,
      'integrations.manage', false,
      'health.view', false,
      'team.view', true,
      'team.manage', false,
      'settings.manage', false
    )
    else jsonb_build_object(
      'dashboard.view', true,
      'management.view', false,
      'management.manage', false,
      'reports.view', false,
      'analytics.view', false,
      'properties.view', true,
      'properties.manage', false,
      'leads.view', true,
      'leads.manage', true,
      'appointments.view', true,
      'appointments.manage', true,
      'captures.view', true,
      'captures.manage', true,
      'proposals.view', true,
      'proposals.manage', false,
      'deals.view', false,
      'deals.manage', false,
      'financial.view', false,
      'documents.view', true,
      'documents.manage', true,
      'messages.view', true,
      'messages.respond', true,
      'rentals.view', true,
      'rentals.manage', true,
      'integrations.manage', false,
      'health.view', false,
      'team.view', true,
      'team.manage', false,
      'settings.manage', false
    )
  end;
$$;

grant execute on function public.role_permissions_json(text) to authenticated;

-- 2. SEQUÃŠNCIA DE CÃ“DIGO DOS CONTRATOS
create sequence if not exists public.rental_contract_code_seq start 1;

-- 3. CONTRATOS DE LOCAÃ‡ÃƒO
create table if not exists public.rental_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  code text not null unique,

  property_id uuid not null references public.properties(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,

  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz,

  status text not null default 'analysis'
    check (status in ('analysis','documents','awaiting_signature','active','ending','ended','cancelled')),

  tenant_name text not null,
  tenant_document text,
  tenant_whatsapp text,
  tenant_email text,
  co_tenants text,

  owner_name text,
  owner_whatsapp text,
  owner_email text,

  start_date date,
  end_date date,
  signed_at timestamptz,
  move_in_at timestamptz,
  move_out_at timestamptz,

  monthly_rent numeric(14,2),
  due_day integer not null default 10 check (due_day between 1 and 28),
  administration_fee_percent numeric(7,4) default 0
    check (administration_fee_percent is null or (administration_fee_percent >= 0 and administration_fee_percent <= 100)),
  placement_fee_value numeric(14,2) default 0,

  condominium_amount numeric(14,2) default 0,
  property_tax_amount numeric(14,2) default 0,
  property_tax_payer text not null default 'tenant'
    check (property_tax_payer in ('tenant','owner','included')),

  guarantee_type text not null default 'none'
    check (guarantee_type in ('none','deposit','guarantor','insurance','capitalization','other')),
  guarantee_value numeric(14,2),
  guarantee_notes text,

  adjustment_index text not null default 'ipca'
    check (adjustment_index in ('ipca','igpm','fixed','none','other')),
  adjustment_percent numeric(8,4),
  next_adjustment_date date,

  utilities_notes text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rental_contract_dates_order
    check (end_date is null or start_date is null or end_date >= start_date),
  constraint rental_contract_positive_values
    check (
      coalesce(monthly_rent, 0) >= 0
      and coalesce(placement_fee_value, 0) >= 0
      and coalesce(condominium_amount, 0) >= 0
      and coalesce(property_tax_amount, 0) >= 0
      and coalesce(guarantee_value, 0) >= 0
    )
);

create index if not exists rental_contracts_org_status_idx
  on public.rental_contracts(organization_id, status, end_date);
create index if not exists rental_contracts_property_idx
  on public.rental_contracts(property_id, status);
create index if not exists rental_contracts_lead_idx
  on public.rental_contracts(lead_id);
create index if not exists rental_contracts_assigned_idx
  on public.rental_contracts(assigned_to, status);

alter table public.rental_contracts enable row level security;

-- Gera cÃ³digo LOC-0001, LOC-0002...
create or replace function public.ensure_rental_contract_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.code is null or trim(new.code) = '' then
    new.code := 'LOC-' || lpad(nextval('public.rental_contract_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists rental_contract_code on public.rental_contracts;
create trigger rental_contract_code
before insert on public.rental_contracts
for each row execute function public.ensure_rental_contract_code();

-- updated_at e responsÃ¡vel

drop trigger if exists rental_contracts_touch_updated_at on public.rental_contracts;
create trigger rental_contracts_touch_updated_at
before update on public.rental_contracts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_rental_contracts_assignment on public.rental_contracts;
create trigger trg_rental_contracts_assignment
before insert or update on public.rental_contracts
for each row execute function public.stamp_assignment();

-- 4. HISTÃ“RICO DE STATUS
create table if not exists public.rental_status_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists rental_status_history_contract_idx
  on public.rental_status_history(contract_id, created_at desc);

alter table public.rental_status_history enable row level security;

create or replace function public.track_rental_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rental_status_history(organization_id, contract_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, null, new.status, auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.rental_status_history(organization_id, contract_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists rental_contracts_status_history on public.rental_contracts;
create trigger rental_contracts_status_history
after insert or update of status on public.rental_contracts
for each row execute function public.track_rental_status_change();

-- Para imÃ³veis exclusivamente de locaÃ§Ã£o, mantÃ©m o anÃºncio sincronizado
-- com o andamento do contrato. ImÃ³veis "venda e aluguel" nÃ£o sÃ£o alterados
-- automaticamente para nÃ£o esconder uma eventual venda com renda.
create or replace function public.sync_rental_property_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purpose text;
begin
  select purpose into v_purpose from public.properties where id = new.property_id;

  if v_purpose = 'rent' then
    if new.status = 'awaiting_signature' then
      update public.properties set status = 'reserved' where id = new.property_id and status <> 'reserved';
    elsif new.status in ('active','ending') then
      update public.properties set status = 'rented' where id = new.property_id and status <> 'rented';
    elsif new.status in ('ended','cancelled') then
      update public.properties set status = 'published' where id = new.property_id and status in ('reserved','rented');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rental_contracts_sync_property_status on public.rental_contracts;
create trigger rental_contracts_sync_property_status
after insert or update of status on public.rental_contracts
for each row execute function public.sync_rental_property_status();

-- 5. COBRANÃ‡AS / ALUGUÃ‰IS MENSAIS
create table if not exists public.rental_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  reference_month date not null,
  due_date date not null,

  rent_amount numeric(14,2) not null default 0,
  condominium_amount numeric(14,2) not null default 0,
  property_tax_amount numeric(14,2) not null default 0,
  other_charges numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_due numeric(14,2) not null default 0,

  paid_amount numeric(14,2) not null default 0,
  paid_at timestamptz,
  payment_method text,
  status text not null default 'pending'
    check (status in ('pending','overdue','partial','paid','waived')),

  management_fee numeric(14,2) not null default 0,
  owner_net_amount numeric(14,2) not null default 0,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(contract_id, reference_month),
  constraint rental_payment_values_nonnegative check (
    rent_amount >= 0
    and condominium_amount >= 0
    and property_tax_amount >= 0
    and other_charges >= 0
    and discount_amount >= 0
    and paid_amount >= 0
  )
);

create index if not exists rental_payments_org_due_idx
  on public.rental_payments(organization_id, due_date, status);
create index if not exists rental_payments_contract_idx
  on public.rental_payments(contract_id, reference_month);

alter table public.rental_payments enable row level security;

create or replace function public.apply_rental_payment_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.total_due := greatest(
    coalesce(new.rent_amount,0)
    + coalesce(new.condominium_amount,0)
    + coalesce(new.property_tax_amount,0)
    + coalesce(new.other_charges,0)
    - coalesce(new.discount_amount,0),
    0
  );

  if new.status <> 'waived' then
    if coalesce(new.paid_amount,0) >= new.total_due and new.total_due > 0 then
      new.status := 'paid';
      new.paid_at := coalesce(new.paid_at, now());
    elsif coalesce(new.paid_amount,0) > 0 then
      new.status := 'partial';
    elsif new.due_date < current_date then
      new.status := 'overdue';
      new.paid_at := null;
    else
      new.status := 'pending';
      new.paid_at := null;
    end if;
  end if;

  if new.status = 'waived' then
    new.owner_net_amount := 0;
  elsif new.status = 'paid' then
    new.owner_net_amount := greatest(coalesce(new.paid_amount,0) - coalesce(new.management_fee,0), 0);
  else
    new.owner_net_amount := greatest(coalesce(new.paid_amount,0) - least(coalesce(new.management_fee,0), coalesce(new.paid_amount,0)), 0);
  end if;

  return new;
end;
$$;

drop trigger if exists rental_payments_business_rules on public.rental_payments;
create trigger rental_payments_business_rules
before insert or update on public.rental_payments
for each row execute function public.apply_rental_payment_rules();

drop trigger if exists rental_payments_touch_updated_at on public.rental_payments;
create trigger rental_payments_touch_updated_at
before update on public.rental_payments
for each row execute function public.touch_updated_at();

-- Gera ou atualiza as cobranÃ§as mensais ainda nÃ£o pagas.
create or replace function public.generate_rental_payment_schedule(p_contract_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.rental_contracts%rowtype;
  m date;
  v_count integer := 0;
  v_tax numeric(14,2);
  v_fee numeric(14,2);
begin
  if not public.has_permission('rentals.manage') then
    raise exception 'Sem permissÃ£o para gerenciar locaÃ§Ãµes.';
  end if;

  select * into c
  from public.rental_contracts
  where id = p_contract_id
    and organization_id = public.current_organization_id();

  if not found then
    raise exception 'Contrato nÃ£o encontrado.';
  end if;

  if c.start_date is null or c.end_date is null or c.monthly_rent is null then
    raise exception 'Informe inÃ­cio, fim e valor mensal antes de gerar cobranÃ§as.';
  end if;

  v_tax := case when c.property_tax_payer = 'tenant' then coalesce(c.property_tax_amount,0) else 0 end;
  v_fee := round(coalesce(c.monthly_rent,0) * coalesce(c.administration_fee_percent,0) / 100.0, 2);

  for m in
    select gs::date
    from generate_series(
      date_trunc('month', c.start_date)::date,
      date_trunc('month', c.end_date)::date,
      interval '1 month'
    ) gs
  loop
    insert into public.rental_payments (
      organization_id,
      contract_id,
      reference_month,
      due_date,
      rent_amount,
      condominium_amount,
      property_tax_amount,
      management_fee
    ) values (
      c.organization_id,
      c.id,
      m,
      least(greatest((m + (c.due_day - 1) * interval '1 day')::date, c.start_date), c.end_date),
      coalesce(c.monthly_rent,0),
      coalesce(c.condominium_amount,0),
      v_tax,
      v_fee
    )
    on conflict (contract_id, reference_month) do update
    set due_date = excluded.due_date,
        rent_amount = excluded.rent_amount,
        condominium_amount = excluded.condominium_amount,
        property_tax_amount = excluded.property_tax_amount,
        management_fee = excluded.management_fee,
        updated_at = now()
    where public.rental_payments.status in ('pending','overdue')
      and coalesce(public.rental_payments.paid_amount,0) = 0;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_rental_payment_schedule(uuid) to authenticated;

create or replace function public.refresh_rental_payment_statuses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.has_permission('rentals.view') then
    return 0;
  end if;

  update public.rental_payments
     set status = case
       when status = 'waived' then 'waived'
       when paid_amount >= total_due and total_due > 0 then 'paid'
       when paid_amount > 0 then 'partial'
       when due_date < current_date then 'overdue'
       else 'pending'
     end,
     updated_at = now()
   where organization_id = public.current_organization_id()
     and status not in ('waived','paid');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.refresh_rental_payment_statuses() to authenticated;

-- 6. VISTORIAS
create table if not exists public.rental_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  inspection_type text not null default 'entry'
    check (inspection_type in ('entry','periodic','exit')),
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rental_inspections_org_schedule_idx
  on public.rental_inspections(organization_id, status, scheduled_at);
create index if not exists rental_inspections_contract_idx
  on public.rental_inspections(contract_id, created_at desc);

alter table public.rental_inspections enable row level security;

drop trigger if exists rental_inspections_touch_updated_at on public.rental_inspections;
create trigger rental_inspections_touch_updated_at
before update on public.rental_inspections
for each row execute function public.touch_updated_at();

-- 7. MANUTENÃ‡Ã•ES
create table if not exists public.rental_maintenance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  responsibility text not null default 'pending'
    check (responsibility in ('pending','owner','tenant','agency','condominium')),
  status text not null default 'open'
    check (status in ('open','in_progress','waiting','completed','cancelled')),
  estimated_cost numeric(14,2),
  actual_cost numeric(14,2),
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_maintenance_costs_nonnegative
    check (coalesce(estimated_cost,0) >= 0 and coalesce(actual_cost,0) >= 0)
);

create index if not exists rental_maintenance_org_status_idx
  on public.rental_maintenance(organization_id, status, due_at);
create index if not exists rental_maintenance_contract_idx
  on public.rental_maintenance(contract_id, created_at desc);

alter table public.rental_maintenance enable row level security;

drop trigger if exists rental_maintenance_touch_updated_at on public.rental_maintenance;
create trigger rental_maintenance_touch_updated_at
before update on public.rental_maintenance
for each row execute function public.touch_updated_at();

-- 8. CHECKLIST DOCUMENTAL DA LOCAÃ‡ÃƒO
create table if not exists public.rental_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  doc_key text not null,
  label text not null,
  party text not null default 'tenant'
    check (party in ('tenant','guarantee','owner','contract','inspection')),
  status text not null default 'pending'
    check (status in ('pending','received','validated','not_applicable')),
  display_order integer not null default 0,
  notes text,
  received_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contract_id, doc_key)
);

create index if not exists rental_documents_contract_idx
  on public.rental_documents(contract_id, party, display_order);

alter table public.rental_documents enable row level security;

drop trigger if exists rental_documents_touch_updated_at on public.rental_documents;
create trigger rental_documents_touch_updated_at
before update on public.rental_documents
for each row execute function public.touch_updated_at();

create or replace function public.apply_rental_document_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('received','validated') and old.status is distinct from new.status then
    new.received_at := coalesce(new.received_at, now());
  end if;
  if new.status = 'validated' and old.status is distinct from 'validated' then
    new.validated_at := coalesce(new.validated_at, now());
  elsif new.status <> 'validated' then
    new.validated_at := null;
  end if;
  if new.status = 'pending' then
    new.received_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_documents_business_rules on public.rental_documents;
create trigger rental_documents_business_rules
before update on public.rental_documents
for each row execute function public.apply_rental_document_rules();

create or replace function public.seed_rental_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rental_documents(organization_id, contract_id, doc_key, label, party, display_order) values
    (new.organization_id, new.id, 'tenant_id', 'Documento de identificaÃ§Ã£o do locatÃ¡rio', 'tenant', 10),
    (new.organization_id, new.id, 'income_proof', 'Comprovante de renda', 'tenant', 20),
    (new.organization_id, new.id, 'residence_proof', 'Comprovante de residÃªncia', 'tenant', 30),
    (new.organization_id, new.id, 'guarantee', 'Documento da garantia locatÃ­cia', 'guarantee', 40),
    (new.organization_id, new.id, 'signed_contract', 'Contrato de locaÃ§Ã£o assinado', 'contract', 50),
    (new.organization_id, new.id, 'entry_inspection', 'Laudo de vistoria de entrada', 'inspection', 60)
  on conflict (contract_id, doc_key) do nothing;
  return new;
end;
$$;

drop trigger if exists rental_contracts_seed_documents on public.rental_contracts;
create trigger rental_contracts_seed_documents
after insert on public.rental_contracts
for each row execute function public.seed_rental_documents();

-- 9. CENTRAL DE DOCUMENTOS: NOVO CONTEXTO LOCAÃ‡ÃƒO
alter table public.crm_documents
  add column if not exists rental_contract_id uuid references public.rental_contracts(id) on delete set null;
alter table public.crm_documents
  add column if not exists rental_document_id uuid references public.rental_documents(id) on delete set null;

create index if not exists crm_documents_rental_idx
  on public.crm_documents(rental_contract_id)
  where rental_contract_id is not null;

alter table public.crm_documents drop constraint if exists crm_documents_single_context;
alter table public.crm_documents add constraint crm_documents_single_context
  check (num_nonnulls(property_id, lead_id, capture_id, proposal_id, deal_id, rental_contract_id) <= 1);

-- Acrescenta categorias sem perder as existentes.
alter table public.crm_documents drop constraint if exists crm_documents_category_check;
alter table public.crm_documents add constraint crm_documents_category_check
  check (category in (
    'property','owner','buyer','seller','proposal','authorization','contract',
    'deed_registry','finance','personal','proof','tenant','rental','inspection','other'
  ));

-- Sincroniza checklist da locaÃ§Ã£o ao anexar/conferir arquivo.
create or replace function public.crm_document_mark_checklist_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.property_document_id is not null then
    update public.property_documents set status = 'received'
    where id = new.property_document_id and status = 'pending';
  end if;
  if new.capture_document_id is not null then
    update public.capture_documents set status = 'received'
    where id = new.capture_document_id and status = 'pending';
  end if;
  if new.deal_document_id is not null then
    update public.deal_documents set status = 'received'
    where id = new.deal_document_id and status = 'pending';
  end if;
  if new.rental_document_id is not null then
    update public.rental_documents set status = 'received'
    where id = new.rental_document_id and status = 'pending';
  end if;
  return new;
end;
$$;

create or replace function public.crm_document_sync_review_to_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    if new.property_document_id is not null then
      update public.property_documents set status = 'validated'
      where id = new.property_document_id and status <> 'not_applicable';
    end if;
    if new.deal_document_id is not null then
      update public.deal_documents set status = 'validated'
      where id = new.deal_document_id and status <> 'not_applicable';
    end if;
    if new.capture_document_id is not null then
      update public.capture_documents set status = 'received'
      where id = new.capture_document_id and status <> 'not_applicable';
    end if;
    if new.rental_document_id is not null then
      update public.rental_documents set status = 'validated'
      where id = new.rental_document_id and status <> 'not_applicable';
    end if;
  elsif new.status = 'rejected' and old.status is distinct from new.status then
    if new.property_document_id is not null then
      update public.property_documents set status = 'received'
      where id = new.property_document_id and status = 'validated';
    end if;
    if new.deal_document_id is not null then
      update public.deal_documents set status = 'received'
      where id = new.deal_document_id and status = 'validated';
    end if;
    if new.rental_document_id is not null then
      update public.rental_documents set status = 'received'
      where id = new.rental_document_id and status = 'validated';
    end if;
  end if;
  return new;
end;
$$;

-- 10. MÃ‰TRICAS DA LOCAÃ‡ÃƒO
create or replace function public.rental_dashboard_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with org as (
    select public.current_organization_id() id
  ), contracts as (
    select * from public.rental_contracts where organization_id = (select id from org)
  ), payments as (
    select * from public.rental_payments where organization_id = (select id from org)
  ), maint as (
    select * from public.rental_maintenance where organization_id = (select id from org)
  )
  select case when public.has_permission('rentals.view') then jsonb_build_object(
    'active_contracts', (select count(*) from contracts where status in ('active','ending')),
    'monthly_rent', (select coalesce(sum(monthly_rent),0) from contracts where status in ('active','ending')),
    'monthly_management_fee', (select coalesce(sum(coalesce(monthly_rent,0) * coalesce(administration_fee_percent,0) / 100.0),0) from contracts where status in ('active','ending')),
    'due_this_month', (select coalesce(sum(total_due),0) from payments where date_trunc('month', reference_month) = date_trunc('month', current_date)),
    'received_this_month', (select coalesce(sum(paid_amount),0) from payments where date_trunc('month', reference_month) = date_trunc('month', current_date)),
    'overdue_count', (select count(*) from payments where status in ('pending','partial','overdue') and due_date < current_date and status <> 'waived'),
    'overdue_value', (select coalesce(sum(greatest(total_due - paid_amount,0)),0) from payments where status in ('pending','partial','overdue') and due_date < current_date),
    'expiring_60_days', (select count(*) from contracts where status in ('active','ending') and end_date between current_date and current_date + 60),
    'open_maintenance', (select count(*) from maint where status in ('open','in_progress','waiting'))
  ) else '{}'::jsonb end;
$$;

grant execute on function public.rental_dashboard_metrics() to authenticated;

-- 11. POLÃTICAS RLS

drop policy if exists rental_contracts_read on public.rental_contracts;
create policy rental_contracts_read on public.rental_contracts for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.view'));

drop policy if exists rental_contracts_manage on public.rental_contracts;
create policy rental_contracts_manage on public.rental_contracts for all to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'))
with check (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'));

drop policy if exists rental_history_read on public.rental_status_history;
create policy rental_history_read on public.rental_status_history for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.view'));

drop policy if exists rental_payments_read on public.rental_payments;
create policy rental_payments_read on public.rental_payments for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.view'));

drop policy if exists rental_payments_manage on public.rental_payments;
create policy rental_payments_manage on public.rental_payments for all to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'))
with check (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'));

drop policy if exists rental_inspections_read on public.rental_inspections;
create policy rental_inspections_read on public.rental_inspections for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.view'));

drop policy if exists rental_inspections_manage on public.rental_inspections;
create policy rental_inspections_manage on public.rental_inspections for all to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'))
with check (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'));

drop policy if exists rental_maintenance_read on public.rental_maintenance;
create policy rental_maintenance_read on public.rental_maintenance for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.view'));

drop policy if exists rental_maintenance_manage on public.rental_maintenance;
create policy rental_maintenance_manage on public.rental_maintenance for all to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'))
with check (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'));

drop policy if exists rental_documents_read on public.rental_documents;
create policy rental_documents_read on public.rental_documents for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.view'));

drop policy if exists rental_documents_manage on public.rental_documents;
create policy rental_documents_manage on public.rental_documents for all to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'))
with check (organization_id = public.current_organization_id() and public.has_permission('rentals.manage'));

-- 12. AUDITORIA DA EQUIPE

do $$
declare
  t text;
begin
  foreach t in array array['rental_contracts','rental_payments','rental_inspections','rental_maintenance','rental_documents'] loop
    execute format('drop trigger if exists trg_%I_activity_log on public.%I', t, t);
    execute format('create trigger trg_%I_activity_log after insert or update or delete on public.%I for each row execute function public.log_team_activity()', t, t);
  end loop;
end $$;

-- 13. PERMISSÃ•ES SQL

grant select, insert, update, delete on
  public.rental_contracts,
  public.rental_status_history,
  public.rental_payments,
  public.rental_inspections,
  public.rental_maintenance,
  public.rental_documents
  to authenticated;

grant usage, select on sequence public.rental_contract_code_seq to authenticated;

-- Atualiza cache de funÃ§Ãµes/polÃ­ticas da API do Supabase.
notify pgrst, 'reload schema';
