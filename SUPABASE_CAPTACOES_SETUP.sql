-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 9 - CAPTAÇÃO DE IMÓVEIS E PROPRIETÁRIOS
-- =========================================================

-- 1. CAPTAÇÕES
create table if not exists public.owner_captures (
  id uuid primary key default gen_random_uuid(),

  owner_name text not null,
  whatsapp text not null,
  email text,

  request_type text not null default 'listing'
    check (request_type in ('listing', 'valuation')),

  purpose text not null default 'sale'
    check (purpose in ('sale', 'rent', 'sale_and_rent')),

  property_type text not null,
  city_name text not null,
  state_code varchar(2) not null default 'MG',
  neighborhood_name text,
  address_text text,

  asking_value numeric(14,2),
  evaluation_value numeric(14,2),
  commission_percent numeric(6,3),

  description text,

  source text not null default 'site',
  session_id text,

  status text not null default 'new'
    check (
      status in (
        'new',
        'evaluation',
        'documents',
        'authorized',
        'published',
        'lost'
      )
    ),

  next_action_text text,
  next_action_at timestamptz,
  lost_reason text,

  converted_property_id uuid references public.properties(id) on delete set null,

  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_captures_status_idx
on public.owner_captures(status);

create index if not exists owner_captures_created_at_idx
on public.owner_captures(created_at desc);

create index if not exists owner_captures_next_action_idx
on public.owner_captures(next_action_at);

create index if not exists owner_captures_property_idx
on public.owner_captures(converted_property_id);

alter table public.owner_captures enable row level security;


-- 2. ANOTAÇÕES DA CAPTAÇÃO
create table if not exists public.capture_notes (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.owner_captures(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists capture_notes_capture_idx
on public.capture_notes(capture_id, created_at desc);

alter table public.capture_notes enable row level security;


-- 3. CONTROLE DE DOCUMENTOS
create table if not exists public.capture_documents (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.owner_captures(id) on delete cascade,
  document_type text not null,
  label text not null,
  status text not null default 'pending'
    check (status in ('pending', 'received', 'not_applicable')),
  notes text,
  updated_at timestamptz not null default now(),
  unique (capture_id, document_type)
);

create index if not exists capture_documents_capture_idx
on public.capture_documents(capture_id);

alter table public.capture_documents enable row level security;


-- 4. HISTÓRICO DE ETAPAS
create table if not exists public.capture_status_history (
  id bigint generated always as identity primary key,
  capture_id uuid not null references public.owner_captures(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists capture_status_history_capture_idx
on public.capture_status_history(capture_id, created_at desc);

alter table public.capture_status_history enable row level security;


-- 5. UPDATED_AT
drop trigger if exists owner_captures_touch_updated_at on public.owner_captures;
create trigger owner_captures_touch_updated_at
before update on public.owner_captures
for each row
execute function public.touch_updated_at();


-- 6. REGRAS DA CAPTAÇÃO
create or replace function public.apply_capture_business_rules()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('published', 'lost') then
    new.next_action_at := null;
    new.next_action_text := null;
  end if;

  return new;
end;
$$;

drop trigger if exists owner_captures_business_rules on public.owner_captures;

create trigger owner_captures_business_rules
before update on public.owner_captures
for each row
execute function public.apply_capture_business_rules();


-- 7. HISTÓRICO AUTOMÁTICO
create or replace function public.log_capture_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.capture_status_history (
      capture_id,
      from_status,
      to_status,
      changed_by
    )
    values (
      new.id,
      old.status,
      new.status,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists owner_captures_status_history_trigger
on public.owner_captures;

create trigger owner_captures_status_history_trigger
after update of status on public.owner_captures
for each row
execute function public.log_capture_status_change();


-- 8. PÚBLICO: PODE ENVIAR CAPTAÇÃO, MAS NÃO LER A BASE
drop policy if exists "public_insert_owner_captures"
on public.owner_captures;

create policy "public_insert_owner_captures"
on public.owner_captures
for insert
to anon, authenticated
with check (
  length(trim(owner_name)) between 2 and 120
  and length(regexp_replace(whatsapp, '\D', '', 'g')) between 10 and 15
  and length(trim(city_name)) between 2 and 120
  and length(trim(property_type)) between 2 and 80
);


-- 9. ADMIN: ACESSO COMPLETO ÀS CAPTAÇÕES
drop policy if exists "admin_manage_owner_captures"
on public.owner_captures;

create policy "admin_manage_owner_captures"
on public.owner_captures
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 10. ADMIN: ANOTAÇÕES
drop policy if exists "admin_manage_capture_notes"
on public.capture_notes;

create policy "admin_manage_capture_notes"
on public.capture_notes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 11. ADMIN: DOCUMENTOS
drop policy if exists "admin_manage_capture_documents"
on public.capture_documents;

create policy "admin_manage_capture_documents"
on public.capture_documents
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 12. ADMIN: HISTÓRICO
drop policy if exists "admin_read_capture_status_history"
on public.capture_status_history;

create policy "admin_read_capture_status_history"
on public.capture_status_history
for select
to authenticated
using (public.is_admin());


-- 13. PERMISSÕES
grant insert on public.owner_captures to anon, authenticated;

grant select, insert, update, delete
on public.owner_captures,
   public.capture_notes,
   public.capture_documents
to authenticated;

grant select
on public.capture_status_history
to authenticated;

grant usage, select
on sequence public.capture_status_history_id_seq
to authenticated;


-- 14. MÉTRICAS GERAIS ATUALIZADAS
create or replace function public.admin_dashboard_metrics(days_back integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at timestamptz;

  visits_count bigint;
  unique_visitors_count bigint;
  leads_count bigint;
  appointments_count bigint;
  proposal_count bigint;
  won_count bigint;

  captures_count bigint;
  capture_new_count bigint;
  capture_authorized_count bigint;
  capture_published_count bigint;

  visitor_to_lead_rate numeric;
  lead_to_appointment_rate numeric;
  lead_to_won_rate numeric;

  won_value numeric;
  commission_value numeric;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*)
  into visits_count
  from public.site_visits
  where created_at >= start_at;

  select count(distinct session_id)
  into unique_visitors_count
  from public.site_visits
  where created_at >= start_at;

  select count(*)
  into leads_count
  from public.leads
  where created_at >= start_at;

  select count(*)
  into appointments_count
  from public.appointments
  where created_at >= start_at;

  select count(*)
  into proposal_count
  from public.leads
  where created_at >= start_at
    and status = 'proposal';

  select count(*)
  into won_count
  from public.leads
  where created_at >= start_at
    and status = 'won';

  select count(*)
  into captures_count
  from public.owner_captures
  where created_at >= start_at;

  select count(*)
  into capture_new_count
  from public.owner_captures
  where created_at >= start_at
    and status = 'new';

  select count(*)
  into capture_authorized_count
  from public.owner_captures
  where created_at >= start_at
    and status = 'authorized';

  select count(*)
  into capture_published_count
  from public.owner_captures
  where created_at >= start_at
    and status = 'published';

  select coalesce(sum(deal_value), 0)
  into won_value
  from public.leads
  where created_at >= start_at
    and status = 'won';

  select coalesce(sum(commission_value), 0)
  into commission_value
  from public.leads
  where created_at >= start_at
    and status = 'won';

  visitor_to_lead_rate :=
    case
      when unique_visitors_count = 0 then 0
      else round((leads_count::numeric / unique_visitors_count::numeric) * 100, 2)
    end;

  lead_to_appointment_rate :=
    case
      when leads_count = 0 then 0
      else round((appointments_count::numeric / leads_count::numeric) * 100, 2)
    end;

  lead_to_won_rate :=
    case
      when leads_count = 0 then 0
      else round((won_count::numeric / leads_count::numeric) * 100, 2)
    end;

  return jsonb_build_object(
    'visits', visits_count,
    'unique_visitors', unique_visitors_count,
    'leads', leads_count,
    'appointments', appointments_count,
    'proposals', proposal_count,
    'won', won_count,
    'visitor_to_lead_rate', visitor_to_lead_rate,
    'lead_to_appointment_rate', lead_to_appointment_rate,
    'lead_to_won_rate', lead_to_won_rate,
    'won_value', won_value,
    'commission_value', commission_value,
    'captures', captures_count,
    'capture_new', capture_new_count,
    'capture_authorized', capture_authorized_count,
    'capture_published', capture_published_count
  );
end;
$$;

grant execute on function public.admin_dashboard_metrics(integer)
to authenticated;

-- =========================================================
-- FIM
-- =========================================================
