create table public.lead_notes (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  note text not null,
  created_by uuid,
  created_at timestamptz default now() not null
);

create table public.lead_preferences (
  lead_id uuid not null,
  purpose text default 'sale'::text not null,
  min_price numeric(14,2),
  max_price numeric(14,2),
  property_types text[] default '{}'::text[] not null,
  preferred_cities text[] default '{}'::text[] not null,
  preferred_neighborhoods text[] default '{}'::text[] not null,
  min_bedrooms integer,
  min_bathrooms integer,
  min_parking_spaces integer,
  min_total_area numeric(12,2),
  min_built_area numeric(12,2),
  financing_needed boolean default false not null,
  urgency text default 'research'::text not null,
  must_haves text,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.lead_property_matches (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  property_id uuid not null,
  status text default 'suggested'::text not null,
  score integer,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.lead_source_history (
  id bigint generated always as identity not null,
  lead_id uuid not null,
  platform text not null,
  channel text,
  detail text,
  touch_type text default 'touch'::text not null,
  metadata jsonb default '{}'::jsonb not null,
  occurred_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

create table public.lead_status_history (
  id bigint generated always as identity not null,
  lead_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid,
  created_at timestamptz default now() not null
);

create table public.leads (
  id uuid default gen_random_uuid() not null,
  property_id uuid,
  name text not null,
  whatsapp text,
  email text,
  message text,
  source text default 'site'::text not null,
  source_detail text,
  session_id text,
  landing_path text,
  status text default 'new'::text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  next_action_text text,
  next_action_at timestamptz,
  lost_reason text,
  deal_value numeric(14,2),
  commission_value numeric(14,2),
  closed_at timestamptz,
  source_platform text,
  source_channel text,
  external_contact_id text,
  external_lead_id text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  form_id text,
  last_inbound_message text,
  last_inbound_at timestamptz,
  external_metadata jsonb default '{}'::jsonb not null,
  last_outbound_message text,
  last_outbound_at timestamptz,
  last_message_at timestamptz,
  social_unread_count integer default 0 not null,
  initial_source_platform text,
  initial_source_channel text,
  initial_source_detail text,
  last_source_platform text,
  last_source_channel text,
  last_source_detail text,
  last_source_at timestamptz,
  whatsapp_wa_id text,
  whatsapp_phone_number_id text,
  instagram_unread_count integer default 0 not null,
  whatsapp_unread_count integer default 0 not null,
  assigned_to uuid,
  assigned_by uuid,
  assigned_at timestamptz
);

create table public.neighborhoods (
  id uuid default gen_random_uuid() not null,
  city_id uuid not null,
  name text not null,
  slug text not null,
  active boolean default true not null,
  created_at timestamptz default now() not null
);

create table public.organization_members (
  id uuid default gen_random_uuid() not null,
  organization_id uuid not null,
  user_id uuid not null,
  role text default 'assistant'::text not null,
  status text default 'active'::text not null,
  permissions jsonb default '{}'::jsonb not null,
  invited_by uuid,
  invited_at timestamptz default now() not null,
  joined_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.organizations (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  status text default 'active'::text not null,
  plan_code text default 'internal'::text not null,
  trial_ends_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.owner_captures (
  id uuid default gen_random_uuid() not null,
  owner_name text not null,
  whatsapp text not null,
  email text,
  request_type text default 'listing'::text not null,
  purpose text default 'sale'::text not null,
  property_type text not null,
  city_name text not null,
  state_code varchar(2) default 'MG'::varchar not null,
  neighborhood_name text,
  address_text text,
  asking_value numeric(14,2),
  evaluation_value numeric(14,2),
  commission_percent numeric(6,3),
  description text,
  source text default 'site'::text not null,
  session_id text,
  status text default 'new'::text not null,
  next_action_text text,
  next_action_at timestamptz,
  lost_reason text,
  converted_property_id uuid,
  consent_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  assigned_to uuid,
  assigned_by uuid,
  assigned_at timestamptz
);

create table public.profiles (
  id uuid not null,
  full_name text,
  role text default 'user'::text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  email text,
  last_seen_at timestamptz
);

create table public.properties (
  id uuid default gen_random_uuid() not null,
  code text not null,
  title text not null,
  slug text not null,
  purpose text not null,
  property_type text not null,
  status text default 'draft'::text not null,
  description text,
  sale_price numeric(14,2),
  rent_price numeric(14,2),
  condominium_fee numeric(14,2),
  iptu_value numeric(14,2),
  city_id uuid,
  neighborhood_id uuid,
  public_location_text text,
  total_area numeric(12,2),
  built_area numeric(12,2),
  bedrooms integer,
  suites integer,
  bathrooms integer,
  parking_spaces integer,
  furnished boolean default false not null,
  financing_allowed boolean default false not null,
  exchange_allowed boolean default false not null,
  featured boolean default false not null,
  published_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz,
  assigned_to uuid,
  assigned_by uuid,
  assigned_at timestamptz
);

create table public.property_documents (
  id uuid default gen_random_uuid() not null,
  property_id uuid not null,
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

create table public.property_features (
  property_id uuid not null,
  feature_id uuid not null,
  created_at timestamptz default now() not null
);

create table public.property_images (
  id uuid default gen_random_uuid() not null,
  property_id uuid not null,
  storage_path text not null,
  alt_text text,
  display_order integer default 0 not null,
  is_cover boolean default false not null,
  created_at timestamptz default now() not null
);

create table public.property_management (
  property_id uuid not null,
  source_capture_id uuid,
  owner_name text,
  owner_whatsapp text,
  owner_email text,
  listing_started_at date default current_date not null,
  authorization_status text default 'pending'::text not null,
  authorization_signed_at date,
  authorization_expires_at date,
  exclusivity boolean default false not null,
  exclusivity_until date,
  commission_percent numeric(7,4),
  commission_payer text default 'seller'::text not null,
  documentation_status text default 'pending'::text not null,
  next_review_at timestamptz,
  internal_notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.property_price_history (
  id bigint generated always as identity not null,
  property_id uuid not null,
  price_type text not null,
  old_price numeric(14,2),
  new_price numeric(14,2),
  changed_by uuid,
  created_at timestamptz default now() not null
);

create table public.property_status_history (
  id bigint generated always as identity not null,
  property_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid,
  created_at timestamptz default now() not null
);

create table public.proposal_status_history (
  id bigint generated always as identity not null,
  proposal_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid,
  created_at timestamptz default now() not null
);

create table public.proposals (
  id uuid default gen_random_uuid() not null,
  code text default next_proposal_code() not null,
  lead_id uuid not null,
  property_id uuid,
  status text default 'draft'::text not null,
  proposal_value numeric(14,2),
  payment_terms text,
  conditions text,
  valid_until date,
  next_follow_up_text text,
  next_follow_up_at timestamptz,
  rejection_reason text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  assigned_to uuid,
  assigned_by uuid,
  assigned_at timestamptz
);;
