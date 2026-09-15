create table public.agency_public_settings (
  id smallint default 1 not null,
  agency_name text,
  creci text,
  phone text,
  whatsapp text,
  public_email text,
  public_address text,
  instagram text,
  facebook text,
  tiktok text,
  youtube text,
  logo_url text,
  updated_at timestamptz default now() not null
);

create table public.appointments (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  property_id uuid,
  requested_date date,
  requested_time time,
  scheduled_at timestamptz,
  status text default 'requested'::text not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  assigned_to uuid,
  assigned_by uuid,
  assigned_at timestamptz
);

create table public.capture_documents (
  id uuid default gen_random_uuid() not null,
  capture_id uuid not null,
  document_type text not null,
  label text not null,
  status text default 'pending'::text not null,
  notes text,
  updated_at timestamptz default now() not null
);

create table public.capture_notes (
  id uuid default gen_random_uuid() not null,
  capture_id uuid not null,
  note text not null,
  created_by uuid,
  created_at timestamptz default now() not null
);

create table public.capture_status_history (
  id bigint generated always as identity not null,
  capture_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid,
  created_at timestamptz default now() not null
);

create table public.cities (
  id uuid default gen_random_uuid() not null,
  name text not null,
  state text,
  state_code varchar(2),
  slug text not null,
  active boolean default true not null,
  created_at timestamptz default now() not null
);

create table public.crm_documents (
  id uuid default gen_random_uuid() not null,
  title text not null,
  category text default 'other'::text not null,
  status text default 'pending_review'::text not null,
  notes text,
  original_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  issued_at date,
  expires_at date,
  property_id uuid,
  lead_id uuid,
  capture_id uuid,
  proposal_id uuid,
  deal_id uuid,
  property_document_id uuid,
  capture_document_id uuid,
  deal_document_id uuid,
  uploaded_by uuid default auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  rental_contract_id uuid,
  rental_document_id uuid,
  rental_tenant_id uuid
);

create table public.crm_monthly_goals (
  id uuid default gen_random_uuid() not null,
  period_month date not null,
  leads_goal integer default 0 not null,
  visits_goal integer default 0 not null,
  captures_goal integer default 0 not null,
  proposals_goal integer default 0 not null,
  deals_goal integer default 0 not null,
  sales_value_goal numeric(14,2) default 0 not null,
  commission_goal numeric(14,2) default 0 not null,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.deal_documents (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  party text not null,
  doc_key text not null,
  label text not null,
  status text default 'pending'::text not null,
  notes text,
  display_order integer default 0 not null,
  received_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.deal_status_history (
  id bigint generated always as identity not null,
  deal_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid,
  created_at timestamptz default now() not null
);

create table public.deals (
  id uuid default gen_random_uuid() not null,
  code text default next_deal_code() not null,
  lead_id uuid not null,
  proposal_id uuid,
  property_id uuid,
  status text default 'documents'::text not null,
  sale_value numeric(14,2),
  commission_percent numeric(7,4),
  commission_value numeric(14,2),
  commission_payer text,
  commission_status text default 'pending'::text not null,
  commission_received_amount numeric(14,2) default 0 not null,
  commission_due_date date,
  commission_received_at timestamptz,
  financing_required boolean default false not null,
  financing_status text default 'not_applicable'::text not null,
  contract_status text default 'pending'::text not null,
  deed_status text default 'pending'::text not null,
  registry_status text default 'pending'::text not null,
  pending_issues text,
  notes text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  assigned_to uuid,
  assigned_by uuid,
  assigned_at timestamptz
);

create table public.features (
  id uuid default gen_random_uuid() not null,
  key text not null,
  label text not null,
  active boolean default true not null,
  created_at timestamptz default now() not null
);

create table public.integration_events (
  id bigint generated always as identity not null,
  platform text not null,
  event_type text not null,
  external_event_id text,
  status text default 'received'::text not null,
  error_message text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);;
