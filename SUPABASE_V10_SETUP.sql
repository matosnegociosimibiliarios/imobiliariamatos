-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10 - SEO, AQUISIÇÃO E INTEGRAÇÃO META/INSTAGRAM
-- =========================================================

-- 1. EVENTOS DE AQUISIÇÃO DO SITE
create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  event_type text not null,
  property_id uuid references public.properties(id) on delete set null,
  path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_events_created_at_idx on public.site_events(created_at desc);
create index if not exists site_events_type_idx on public.site_events(event_type);
create index if not exists site_events_property_idx on public.site_events(property_id);

alter table public.site_events enable row level security;

drop policy if exists "public_insert_site_events" on public.site_events;
create policy "public_insert_site_events"
on public.site_events
for insert
to anon, authenticated
with check (
  length(session_id) between 8 and 128
  and length(path) between 1 and 500
);

drop policy if exists "admin_manage_site_events" on public.site_events;
create policy "admin_manage_site_events"
on public.site_events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant insert on public.site_events to anon, authenticated;
grant select, insert, update, delete on public.site_events to authenticated;
grant usage, select on sequence public.site_events_id_seq to anon, authenticated;

-- 2. LEADS EXTERNOS: INSTAGRAM DIRECT E META LEAD ADS
alter table public.leads
  alter column whatsapp drop not null;

alter table public.leads
  add column if not exists source_platform text,
  add column if not exists source_channel text,
  add column if not exists external_contact_id text,
  add column if not exists external_lead_id text,
  add column if not exists campaign_id text,
  add column if not exists campaign_name text,
  add column if not exists adset_id text,
  add column if not exists adset_name text,
  add column if not exists ad_id text,
  add column if not exists ad_name text,
  add column if not exists form_id text,
  add column if not exists last_inbound_message text,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists external_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists leads_external_lead_unique
on public.leads(source_platform, external_lead_id)
where external_lead_id is not null;

create unique index if not exists leads_instagram_contact_unique
on public.leads(source_platform, external_contact_id)
where source_platform = 'instagram'
  and source_channel = 'direct'
  and external_contact_id is not null;

create index if not exists leads_source_platform_idx on public.leads(source_platform);
create index if not exists leads_source_channel_idx on public.leads(source_channel);
create index if not exists leads_last_inbound_at_idx on public.leads(last_inbound_at desc);

-- Mantém formulário público exigindo WhatsApp, embora integrações externas possam não ter telefone.
drop policy if exists "public_insert_leads" on public.leads;
create policy "public_insert_leads"
on public.leads
for insert
to anon, authenticated
with check (
  length(trim(name)) between 2 and 120
  and whatsapp is not null
  and length(regexp_replace(whatsapp, '\\D', '', 'g')) between 10 and 15
);

-- 3. MENSAGENS SOCIAIS RECEBIDAS
create table if not exists public.social_messages (
  id bigint generated always as identity primary key,
  lead_id uuid references public.leads(id) on delete cascade,
  platform text not null,
  channel text not null,
  external_message_id text,
  external_sender_id text,
  direction text not null default 'inbound'
    check (direction in ('inbound','outbound')),
  message_text text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists social_messages_external_message_unique
on public.social_messages(platform, external_message_id);

create index if not exists social_messages_lead_idx
on public.social_messages(lead_id, created_at desc);

alter table public.social_messages enable row level security;

drop policy if exists "admin_manage_social_messages" on public.social_messages;
create policy "admin_manage_social_messages"
on public.social_messages
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.social_messages to authenticated;
grant usage, select on sequence public.social_messages_id_seq to authenticated;

-- 4. LOG DE INTEGRAÇÃO (sem armazenar tokens)
create table if not exists public.integration_events (
  id bigint generated always as identity primary key,
  platform text not null,
  event_type text not null,
  external_event_id text,
  status text not null default 'received',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_events_created_at_idx
on public.integration_events(created_at desc);

alter table public.integration_events enable row level security;

drop policy if exists "admin_read_integration_events" on public.integration_events;
create policy "admin_read_integration_events"
on public.integration_events
for select
to authenticated
using (public.is_admin());

grant select on public.integration_events to authenticated;
grant usage, select on sequence public.integration_events_id_seq to authenticated;

-- 5. MÉTRICAS DE AQUISIÇÃO
create or replace function public.admin_acquisition_metrics(days_back integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at timestamptz;
  whatsapp_clicks bigint;
  lead_submits bigint;
  appointment_submits bigint;
  capture_submits bigint;
  share_clicks bigint;
  search_clicks bigint;
  instagram_direct_leads bigint;
  meta_lead_ads bigint;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*) into whatsapp_clicks from public.site_events
  where created_at >= start_at and event_type = 'whatsapp_click';

  select count(*) into lead_submits from public.site_events
  where created_at >= start_at and event_type = 'lead_submit';

  select count(*) into appointment_submits from public.site_events
  where created_at >= start_at and event_type = 'appointment_submit';

  select count(*) into capture_submits from public.site_events
  where created_at >= start_at and event_type = 'capture_submit';

  select count(*) into share_clicks from public.site_events
  where created_at >= start_at and event_type = 'share_click';

  select count(*) into search_clicks from public.site_events
  where created_at >= start_at and event_type = 'search_click';

  select count(*) into instagram_direct_leads from public.leads
  where created_at >= start_at
    and source_platform = 'instagram'
    and source_channel = 'direct';

  select count(*) into meta_lead_ads from public.leads
  where created_at >= start_at
    and source_channel = 'lead_ads';

  return jsonb_build_object(
    'whatsapp_clicks', whatsapp_clicks,
    'lead_submits', lead_submits,
    'appointment_submits', appointment_submits,
    'capture_submits', capture_submits,
    'share_clicks', share_clicks,
    'search_clicks', search_clicks,
    'instagram_direct_leads', instagram_direct_leads,
    'meta_lead_ads', meta_lead_ads
  );
end;
$$;

grant execute on function public.admin_acquisition_metrics(integer) to authenticated;

-- 6. MÉTRICAS DE INTEGRAÇÃO
create or replace function public.admin_integration_metrics(days_back integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at timestamptz;
  direct_count bigint;
  ads_count bigint;
  messages_count bigint;
  last_event timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*) into direct_count from public.leads
  where created_at >= start_at and source_platform = 'instagram' and source_channel = 'direct';

  select count(*) into ads_count from public.leads
  where created_at >= start_at and source_channel = 'lead_ads';

  select count(*) into messages_count from public.social_messages
  where created_at >= start_at and platform = 'instagram' and direction = 'inbound';

  select max(created_at) into last_event from public.integration_events
  where platform = 'meta';

  return jsonb_build_object(
    'instagram_direct_leads', direct_count,
    'lead_ads_leads', ads_count,
    'instagram_messages', messages_count,
    'last_meta_event_at', last_event
  );
end;
$$;

grant execute on function public.admin_integration_metrics(integer) to authenticated;

-- =========================================================
-- IMPORTANTE
-- Os tokens da Meta e a chave service_role NÃO ficam no banco nem no navegador.
-- Eles serão configurados apenas nas variáveis de ambiente da Vercel.
-- =========================================================
