-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.2 - CAIXA DE ATENDIMENTO DO INSTAGRAM
-- =========================================================

-- 1. CAMPOS DE CONTROLE NO LEAD
alter table public.leads
  add column if not exists last_outbound_message text,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists last_message_at timestamptz,
  add column if not exists social_unread_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_social_unread_count_nonnegative'
  ) then
    alter table public.leads
      add constraint leads_social_unread_count_nonnegative
      check (social_unread_count >= 0);
  end if;
end $$;

create index if not exists leads_last_message_at_idx
on public.leads(last_message_at desc);

-- 2. CAMPOS DE CONTROLE DAS MENSAGENS
alter table public.social_messages
  add column if not exists external_recipient_id text,
  add column if not exists read_at timestamptz,
  add column if not exists delivery_status text not null default 'received',
  add column if not exists error_message text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_messages_delivery_status_check'
  ) then
    alter table public.social_messages
      add constraint social_messages_delivery_status_check
      check (delivery_status in ('received','sent','failed'));
  end if;
end $$;

create index if not exists social_messages_unread_idx
on public.social_messages(lead_id, read_at)
where direction = 'inbound';

-- Mensagens antigas são consideradas já vistas para não gerar falsos alertas.
update public.social_messages
set read_at = coalesce(sent_at, created_at)
where direction = 'inbound'
  and read_at is null;

update public.social_messages
set delivery_status = 'sent'
where direction = 'outbound'
  and delivery_status = 'received';

-- 3. SINCRONIZAR A ÚLTIMA MENSAGEM NO LEAD
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

-- 4. BACKFILL DA DATA DA ÚLTIMA MENSAGEM
update public.leads l
set last_message_at = x.last_message_at
from (
  select lead_id, max(coalesce(sent_at, created_at)) as last_message_at
  from public.social_messages
  group by lead_id
) x
where l.id = x.lead_id
  and l.last_message_at is null;

-- 5. MARCAR CONVERSA COMO LIDA
create or replace function public.mark_social_messages_read(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.social_messages
  set read_at = now()
  where lead_id = p_lead_id
    and direction = 'inbound'
    and read_at is null;

  update public.leads
  set social_unread_count = 0,
      updated_at = now()
  where id = p_lead_id;
end;
$$;

grant execute on function public.mark_social_messages_read(uuid)
to authenticated;

-- 6. MÉTRICAS DA INTEGRAÇÃO ATUALIZADAS
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
  inbound_count bigint;
  outbound_count bigint;
  unread_count bigint;
  last_event timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*) into direct_count from public.leads
  where created_at >= start_at
    and source_platform = 'instagram'
    and source_channel = 'direct';

  select count(*) into ads_count from public.leads
  where created_at >= start_at
    and source_channel = 'lead_ads';

  select count(*) into inbound_count from public.social_messages
  where created_at >= start_at
    and platform = 'instagram'
    and direction = 'inbound';

  select count(*) into outbound_count from public.social_messages
  where created_at >= start_at
    and platform = 'instagram'
    and direction = 'outbound';

  select coalesce(sum(social_unread_count), 0)::bigint into unread_count
  from public.leads
  where source_platform = 'instagram'
    and source_channel = 'direct';

  select max(created_at) into last_event from public.integration_events
  where platform = 'meta';

  return jsonb_build_object(
    'instagram_direct_leads', direct_count,
    'lead_ads_leads', ads_count,
    'instagram_messages', inbound_count,
    'instagram_sent_messages', outbound_count,
    'instagram_unread_messages', unread_count,
    'last_meta_event_at', last_event
  );
end;
$$;

grant execute on function public.admin_integration_metrics(integer)
to authenticated;

-- =========================================================
-- FIM
-- =========================================================
