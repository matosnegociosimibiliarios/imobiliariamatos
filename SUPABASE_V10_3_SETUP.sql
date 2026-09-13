-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.3 - ORIGEM, DEDUPLICAÇÃO E OPERAÇÃO MULTICANAL
-- =========================================================

-- 1. ORIGEM INICIAL E ÚLTIMA ORIGEM DO LEAD
alter table public.leads
  add column if not exists initial_source_platform text,
  add column if not exists initial_source_channel text,
  add column if not exists initial_source_detail text,
  add column if not exists last_source_platform text,
  add column if not exists last_source_channel text,
  add column if not exists last_source_detail text,
  add column if not exists last_source_at timestamptz;

update public.leads
set
  initial_source_platform = coalesce(
    initial_source_platform,
    source_platform,
    case
      when source in ('instagram','facebook','whatsapp','meta') then source
      else 'site'
    end
  ),
  initial_source_channel = coalesce(
    initial_source_channel,
    source_channel,
    case when source = 'imovel' then 'property_form' else 'form' end
  ),
  initial_source_detail = coalesce(initial_source_detail, source_detail),
  last_source_platform = coalesce(
    last_source_platform,
    source_platform,
    case
      when source in ('instagram','facebook','whatsapp','meta') then source
      else 'site'
    end
  ),
  last_source_channel = coalesce(
    last_source_channel,
    source_channel,
    case when source = 'imovel' then 'property_form' else 'form' end
  ),
  last_source_detail = coalesce(last_source_detail, source_detail),
  last_source_at = coalesce(last_source_at, last_inbound_at, created_at);

create index if not exists leads_initial_source_platform_idx
on public.leads(initial_source_platform);

create index if not exists leads_last_source_platform_idx
on public.leads(last_source_platform);

-- 2. HISTÓRICO DE ORIGENS / PONTOS DE CONTATO
create table if not exists public.lead_source_history (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  platform text not null,
  channel text,
  detail text,
  touch_type text not null default 'touch'
    check (touch_type in ('initial','touch')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists lead_source_history_lead_idx
on public.lead_source_history(lead_id, occurred_at desc);

alter table public.lead_source_history enable row level security;

drop policy if exists "admin_read_lead_source_history" on public.lead_source_history;
create policy "admin_read_lead_source_history"
on public.lead_source_history
for select
to authenticated
using (public.is_admin());

grant select on public.lead_source_history to authenticated;
grant usage, select on sequence public.lead_source_history_id_seq to authenticated;

-- Backfill de uma origem inicial para leads existentes.
insert into public.lead_source_history (
  lead_id, platform, channel, detail, touch_type, occurred_at
)
select
  l.id,
  coalesce(l.initial_source_platform, 'site'),
  l.initial_source_channel,
  l.initial_source_detail,
  'initial',
  l.created_at
from public.leads l
where not exists (
  select 1
  from public.lead_source_history h
  where h.lead_id = l.id
    and h.touch_type = 'initial'
);

-- 3. REGISTRAR MUDANÇAS DE ORIGEM SEM DUPLICAR O MESMO CANAL
create or replace function public.track_lead_source_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.initial_source_platform is not null then
      insert into public.lead_source_history (
        lead_id, platform, channel, detail, touch_type, occurred_at
      ) values (
        new.id,
        new.initial_source_platform,
        new.initial_source_channel,
        new.initial_source_detail,
        'initial',
        coalesce(new.created_at, now())
      );
    end if;

  elsif
    old.last_source_platform is distinct from new.last_source_platform
    or old.last_source_channel is distinct from new.last_source_channel
    or old.last_source_detail is distinct from new.last_source_detail
  then
    if new.last_source_platform is not null then
      insert into public.lead_source_history (
        lead_id, platform, channel, detail, touch_type, occurred_at
      ) values (
        new.id,
        new.last_source_platform,
        new.last_source_channel,
        new.last_source_detail,
        'touch',
        coalesce(new.last_source_at, now())
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists leads_track_source_change on public.leads;
create trigger leads_track_source_change
after insert or update
on public.leads
for each row
execute function public.track_lead_source_change();

-- 4. FORMULÁRIO PÚBLICO COM PREVENÇÃO DE DUPLICADOS
--    Telefone tem prioridade; e-mail é usado como segunda chave.
create or replace function public.submit_public_lead(
  p_property_id uuid,
  p_name text,
  p_whatsapp text,
  p_email text default null,
  p_message text default null,
  p_source text default 'site',
  p_source_detail text default null,
  p_session_id text default null,
  p_landing_path text default null,
  p_source_platform text default 'site',
  p_source_channel text default 'form'
)
returns table(id uuid, reused boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_phone text;
  v_email text;
  v_existing boolean := false;
begin
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Nome inválido';
  end if;

  v_phone := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  if length(v_phone) < 10 or length(v_phone) > 15 then
    raise exception 'WhatsApp inválido';
  end if;

  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  select l.id
  into v_id
  from public.leads l
  where regexp_replace(coalesce(l.whatsapp, ''), '[^0-9]', '', 'g') = v_phone
     or (v_email is not null and lower(trim(coalesce(l.email, ''))) = v_email)
  order by
    case when regexp_replace(coalesce(l.whatsapp, ''), '[^0-9]', '', 'g') = v_phone then 0 else 1 end,
    l.created_at asc
  limit 1;

  if v_id is not null then
    v_existing := true;

    update public.leads
    set
      name = case
        when name like 'Contato Instagram %' then trim(p_name)
        else name
      end,
      whatsapp = coalesce(nullif(trim(whatsapp), ''), trim(p_whatsapp)),
      email = coalesce(nullif(trim(email), ''), v_email),
      property_id = coalesce(property_id, p_property_id),
      message = coalesce(nullif(trim(message), ''), nullif(trim(p_message), '')),
      session_id = coalesce(session_id, p_session_id),
      landing_path = coalesce(landing_path, p_landing_path),
      last_source_platform = coalesce(nullif(trim(p_source_platform), ''), 'site'),
      last_source_channel = coalesce(nullif(trim(p_source_channel), ''), 'form'),
      last_source_detail = nullif(trim(p_source_detail), ''),
      last_source_at = now(),
      updated_at = now()
    where public.leads.id = v_id;
  else
    insert into public.leads (
      property_id,
      name,
      whatsapp,
      email,
      message,
      source,
      source_detail,
      session_id,
      landing_path,
      source_platform,
      source_channel,
      initial_source_platform,
      initial_source_channel,
      initial_source_detail,
      last_source_platform,
      last_source_channel,
      last_source_detail,
      last_source_at,
      status
    ) values (
      p_property_id,
      trim(p_name),
      trim(p_whatsapp),
      v_email,
      nullif(trim(p_message), ''),
      p_source,
      p_source_detail,
      p_session_id,
      p_landing_path,
      coalesce(nullif(trim(p_source_platform), ''), 'site'),
      coalesce(nullif(trim(p_source_channel), ''), 'form'),
      coalesce(nullif(trim(p_source_platform), ''), 'site'),
      coalesce(nullif(trim(p_source_channel), ''), 'form'),
      nullif(trim(p_source_detail), ''),
      coalesce(nullif(trim(p_source_platform), ''), 'site'),
      coalesce(nullif(trim(p_source_channel), ''), 'form'),
      nullif(trim(p_source_detail), ''),
      now(),
      'new'
    )
    returning public.leads.id into v_id;
  end if;

  return query select v_id, v_existing;
end;
$$;

grant execute on function public.submit_public_lead(
  uuid, text, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- 5. RESPOSTAS RÁPIDAS
create table if not exists public.response_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  channel text not null default 'all'
    check (channel in ('all','instagram','whatsapp','facebook')),
  content text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.response_templates enable row level security;

drop policy if exists "admin_manage_response_templates" on public.response_templates;
create policy "admin_manage_response_templates"
on public.response_templates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.response_templates to authenticated;

insert into public.response_templates (name, channel, content, sort_order)
values
  ('Saudação inicial', 'all', 'Olá! Obrigado pelo contato com a Matos Negócios Imobiliários. Como posso ajudar você?', 10),
  ('Entender necessidade', 'all', 'Para eu buscar as melhores opções, me diga: qual cidade ou bairro você procura, faixa de valor e quantos quartos precisa?', 20),
  ('Agendar visita', 'all', 'Podemos agendar uma visita ao imóvel. Qual dia e horário ficam melhores para você?', 30),
  ('Enviar mais informações', 'all', 'Posso te enviar mais detalhes, fotos e informações desse imóvel. Há alguma dúvida específica que você queira tirar primeiro?', 40),
  ('Retorno de atendimento', 'all', 'Olá! Estou retomando nosso atendimento para saber se você ainda tem interesse e se posso ajudar em alguma etapa.', 50)
on conflict (name) do update
set content = excluded.content,
    channel = excluded.channel,
    sort_order = excluded.sort_order,
    active = true,
    updated_at = now();

-- 6. MARCAR CONVERSA COMO NÃO LIDA (opcional para organização manual)
create or replace function public.mark_social_conversation_unread(p_lead_id uuid)
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
  set read_at = null
  where id = (
    select id
    from public.social_messages
    where lead_id = p_lead_id
      and direction = 'inbound'
    order by coalesce(sent_at, created_at) desc
    limit 1
  );

  update public.leads
  set social_unread_count = case
      when exists (
        select 1 from public.social_messages
        where lead_id = p_lead_id
          and direction = 'inbound'
      ) then 1 else 0 end,
      updated_at = now()
  where id = p_lead_id;
end;
$$;

grant execute on function public.mark_social_conversation_unread(uuid)
to authenticated;

-- 7. CONTADOR DE NÃO LIDAS PARA O MENU
create or replace function public.admin_unread_social_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then
      coalesce(sum(social_unread_count), 0)::bigint
    else 0::bigint
  end
  from public.leads
  where source_platform = 'instagram'
    and source_channel = 'direct';
$$;

grant execute on function public.admin_unread_social_count()
to authenticated;

-- 8. DESEMPENHO POR CANAL DE ORIGEM
create or replace function public.admin_channel_performance(days_back integer default 30)
returns table (
  platform text,
  channel text,
  leads bigint,
  appointments bigint,
  won bigint,
  deal_value numeric,
  commission_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      l.id,
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      l.status,
      coalesce(l.deal_value, 0) as deal_value,
      coalesce(l.commission_value, 0) as commission_value
    from public.leads l
    where l.created_at >= now() - make_interval(days => greatest(days_back, 1))
      and public.is_admin()
  ),
  appts as (
    select a.lead_id, count(*)::bigint as total
    from public.appointments a
    where a.created_at >= now() - make_interval(days => greatest(days_back, 1))
    group by a.lead_id
  )
  select
    b.platform,
    b.channel,
    count(*)::bigint as leads,
    coalesce(sum(a.total), 0)::bigint as appointments,
    count(*) filter (where b.status = 'won')::bigint as won,
    coalesce(sum(b.deal_value) filter (where b.status = 'won'), 0)::numeric as deal_value,
    coalesce(sum(b.commission_value) filter (where b.status = 'won'), 0)::numeric as commission_value
  from base b
  left join appts a on a.lead_id = b.id
  group by b.platform, b.channel
  order by leads desc, won desc;
$$;

grant execute on function public.admin_channel_performance(integer)
to authenticated;

-- =========================================================
-- FIM
-- =========================================================
