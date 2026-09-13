-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.4 - WHATSAPP BUSINESS + CRM
-- =========================================================

-- 1. IDENTIDADE DO WHATSAPP NO LEAD
alter table public.leads
  add column if not exists whatsapp_wa_id text,
  add column if not exists whatsapp_phone_number_id text,
  add column if not exists instagram_unread_count integer not null default 0,
  add column if not exists whatsapp_unread_count integer not null default 0;

create unique index if not exists leads_whatsapp_wa_id_unique
on public.leads(whatsapp_wa_id)
where whatsapp_wa_id is not null;

create index if not exists leads_whatsapp_phone_number_id_idx
on public.leads(whatsapp_phone_number_id)
where whatsapp_phone_number_id is not null;

-- 2. STATUS DE ENTREGA MAIS COMPLETOS
alter table public.social_messages
  drop constraint if exists social_messages_delivery_status_check;

alter table public.social_messages
  add constraint social_messages_delivery_status_check
  check (delivery_status in ('received','sent','delivered','read','failed'));

create index if not exists social_messages_platform_lead_idx
on public.social_messages(platform, lead_id, created_at desc);

-- 3. CONTADORES POR CANAL
create or replace function public.sync_social_message_to_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message_at timestamptz;
begin
  message_at := coalesce(new.sent_at, new.created_at, now());

  if new.direction = 'inbound' then
    update public.leads
    set last_inbound_message = new.message_text,
        last_inbound_at = message_at,
        last_message_at = message_at,
        social_unread_count = social_unread_count + 1,
        instagram_unread_count = instagram_unread_count + case when new.platform = 'instagram' then 1 else 0 end,
        whatsapp_unread_count = whatsapp_unread_count + case when new.platform = 'whatsapp' then 1 else 0 end,
        updated_at = now()
    where id = new.lead_id;
  else
    update public.leads
    set last_outbound_message = new.message_text,
        last_outbound_at = message_at,
        last_message_at = message_at,
        updated_at = now()
    where id = new.lead_id;
  end if;

  return new;
end;
$$;

drop trigger if exists social_message_sync_lead on public.social_messages;
create trigger social_message_sync_lead
after insert on public.social_messages
for each row
execute function public.sync_social_message_to_lead();

-- Recalcula os contadores atuais com base nas mensagens ainda não lidas.
update public.leads l
set
  instagram_unread_count = coalesce(x.instagram_unread, 0),
  whatsapp_unread_count = coalesce(x.whatsapp_unread, 0),
  social_unread_count = coalesce(x.total_unread, 0)
from (
  select
    lead_id,
    count(*) filter (where platform = 'instagram' and direction = 'inbound' and read_at is null)::integer as instagram_unread,
    count(*) filter (where platform = 'whatsapp' and direction = 'inbound' and read_at is null)::integer as whatsapp_unread,
    count(*) filter (where direction = 'inbound' and read_at is null)::integer as total_unread
  from public.social_messages
  group by lead_id
) x
where l.id = x.lead_id;

update public.leads l
set instagram_unread_count = 0,
    whatsapp_unread_count = 0,
    social_unread_count = 0
where not exists (
  select 1
  from public.social_messages m
  where m.lead_id = l.id
    and m.direction = 'inbound'
    and m.read_at is null
);

-- 4. MARCAR UMA CONVERSA ESPECÍFICA COMO LIDA
create or replace function public.mark_channel_messages_read(
  p_lead_id uuid,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instagram integer;
  v_whatsapp integer;
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.social_messages
  set read_at = now()
  where lead_id = p_lead_id
    and platform = p_platform
    and direction = 'inbound'
    and read_at is null;

  select
    count(*) filter (where platform = 'instagram' and direction = 'inbound' and read_at is null)::integer,
    count(*) filter (where platform = 'whatsapp' and direction = 'inbound' and read_at is null)::integer,
    count(*) filter (where direction = 'inbound' and read_at is null)::integer
  into v_instagram, v_whatsapp, v_total
  from public.social_messages
  where lead_id = p_lead_id;

  update public.leads
  set instagram_unread_count = coalesce(v_instagram, 0),
      whatsapp_unread_count = coalesce(v_whatsapp, 0),
      social_unread_count = coalesce(v_total, 0),
      updated_at = now()
  where id = p_lead_id;
end;
$$;

grant execute on function public.mark_channel_messages_read(uuid, text)
to authenticated;

-- 5. MARCAR UMA CONVERSA ESPECÍFICA COMO NÃO LIDA
create or replace function public.mark_channel_conversation_unread(
  p_lead_id uuid,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instagram integer;
  v_whatsapp integer;
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.social_messages
  set read_at = null
  where id = (
    select id
    from public.social_messages
    where lead_id = p_lead_id
      and platform = p_platform
      and direction = 'inbound'
    order by coalesce(sent_at, created_at) desc
    limit 1
  );

  select
    count(*) filter (where platform = 'instagram' and direction = 'inbound' and read_at is null)::integer,
    count(*) filter (where platform = 'whatsapp' and direction = 'inbound' and read_at is null)::integer,
    count(*) filter (where direction = 'inbound' and read_at is null)::integer
  into v_instagram, v_whatsapp, v_total
  from public.social_messages
  where lead_id = p_lead_id;

  update public.leads
  set instagram_unread_count = coalesce(v_instagram, 0),
      whatsapp_unread_count = coalesce(v_whatsapp, 0),
      social_unread_count = coalesce(v_total, 0),
      updated_at = now()
  where id = p_lead_id;
end;
$$;

grant execute on function public.mark_channel_conversation_unread(uuid, text)
to authenticated;

-- 6. CONTADOR DO MENU POR PLATAFORMA
create or replace function public.admin_unread_social_count_by_platform(p_platform text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_admin() then 0::bigint
    when p_platform = 'instagram' then coalesce(sum(instagram_unread_count), 0)::bigint
    when p_platform = 'whatsapp' then coalesce(sum(whatsapp_unread_count), 0)::bigint
    else coalesce(sum(social_unread_count), 0)::bigint
  end
  from public.leads;
$$;

grant execute on function public.admin_unread_social_count_by_platform(text)
to authenticated;

-- 7. MÉTRICAS DA INTEGRAÇÃO: INSTAGRAM + WHATSAPP
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
  instagram_inbound bigint;
  instagram_outbound bigint;
  instagram_unread bigint;
  whatsapp_leads bigint;
  whatsapp_inbound bigint;
  whatsapp_outbound bigint;
  whatsapp_unread bigint;
  last_event timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*) into direct_count
  from public.leads
  where created_at >= start_at
    and source_platform = 'instagram'
    and source_channel = 'direct';

  select count(*) into ads_count
  from public.leads
  where created_at >= start_at
    and source_channel = 'lead_ads';

  select count(*) into instagram_inbound
  from public.social_messages
  where created_at >= start_at
    and platform = 'instagram'
    and direction = 'inbound';

  select count(*) into instagram_outbound
  from public.social_messages
  where created_at >= start_at
    and platform = 'instagram'
    and direction = 'outbound';

  select coalesce(sum(instagram_unread_count), 0)::bigint
  into instagram_unread
  from public.leads;

  select count(*) into whatsapp_leads
  from public.leads
  where created_at >= start_at
    and whatsapp_wa_id is not null;

  select count(*) into whatsapp_inbound
  from public.social_messages
  where created_at >= start_at
    and platform = 'whatsapp'
    and direction = 'inbound';

  select count(*) into whatsapp_outbound
  from public.social_messages
  where created_at >= start_at
    and platform = 'whatsapp'
    and direction = 'outbound';

  select coalesce(sum(whatsapp_unread_count), 0)::bigint
  into whatsapp_unread
  from public.leads;

  select max(created_at) into last_event
  from public.integration_events
  where platform = 'meta';

  return jsonb_build_object(
    'instagram_direct_leads', direct_count,
    'lead_ads_leads', ads_count,
    'instagram_messages', instagram_inbound,
    'instagram_sent_messages', instagram_outbound,
    'instagram_unread_messages', instagram_unread,
    'whatsapp_leads', whatsapp_leads,
    'whatsapp_messages', whatsapp_inbound,
    'whatsapp_sent_messages', whatsapp_outbound,
    'whatsapp_unread_messages', whatsapp_unread,
    'last_meta_event_at', last_event
  );
end;
$$;

grant execute on function public.admin_integration_metrics(integer)
to authenticated;

-- =========================================================
-- FIM
-- =========================================================
