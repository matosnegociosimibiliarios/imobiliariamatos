-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 8 - CRM DE ATENDIMENTO E CONVERSÃO
-- =========================================================

-- 1. NOVOS CAMPOS NO LEAD
alter table public.leads
  add column if not exists next_action_text text,
  add column if not exists next_action_at timestamptz,
  add column if not exists lost_reason text,
  add column if not exists deal_value numeric(14,2),
  add column if not exists commission_value numeric(14,2),
  add column if not exists closed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_deal_value_nonnegative'
  ) then
    alter table public.leads
      add constraint leads_deal_value_nonnegative
      check (deal_value is null or deal_value >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_commission_value_nonnegative'
  ) then
    alter table public.leads
      add constraint leads_commission_value_nonnegative
      check (commission_value is null or commission_value >= 0);
  end if;
end $$;

create index if not exists leads_next_action_at_idx
on public.leads(next_action_at);

create index if not exists leads_closed_at_idx
on public.leads(closed_at);


-- 2. ANOTAÇÕES DO ATENDIMENTO
create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_notes_lead_created_idx
on public.lead_notes(lead_id, created_at desc);

alter table public.lead_notes enable row level security;


-- 3. HISTÓRICO AUTOMÁTICO DE MUDANÇAS DE ETAPA
create table if not exists public.lead_status_history (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_status_history_lead_created_idx
on public.lead_status_history(lead_id, created_at desc);

alter table public.lead_status_history enable row level security;


-- 4. REGRAS AUTOMÁTICAS DO NEGÓCIO
create or replace function public.apply_lead_business_rules()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'won' and old.status is distinct from 'won' then
    new.closed_at := coalesce(new.closed_at, now());
    new.next_action_at := null;
    new.next_action_text := null;
  elsif new.status <> 'won' and old.status = 'won' then
    new.closed_at := null;
  end if;

  if new.status = 'lost' then
    new.next_action_at := null;
    new.next_action_text := null;
  end if;

  return new;
end;
$$;

drop trigger if exists leads_business_rules on public.leads;

create trigger leads_business_rules
before update on public.leads
for each row
execute function public.apply_lead_business_rules();


-- 5. REGISTRAR MUDANÇA DE STATUS NO HISTÓRICO
create or replace function public.log_lead_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.lead_status_history (
      lead_id,
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

drop trigger if exists leads_status_history_trigger on public.leads;

create trigger leads_status_history_trigger
after update of status on public.leads
for each row
execute function public.log_lead_status_change();


-- 6. POLÍTICAS - ANOTAÇÕES
drop policy if exists "admin_manage_lead_notes" on public.lead_notes;

create policy "admin_manage_lead_notes"
on public.lead_notes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 7. POLÍTICAS - HISTÓRICO
drop policy if exists "admin_read_lead_status_history" on public.lead_status_history;

create policy "admin_read_lead_status_history"
on public.lead_status_history
for select
to authenticated
using (public.is_admin());


-- 8. PERMISSÕES
grant select, insert, update, delete
on public.lead_notes
to authenticated;

grant select
on public.lead_status_history
to authenticated;

grant usage, select
on sequence public.lead_status_history_id_seq
to authenticated;


-- 9. MÉTRICAS DO PAINEL - ATUALIZADAS
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
    'commission_value', commission_value
  );
end;
$$;

grant execute on function public.admin_dashboard_metrics(integer)
to authenticated;


-- 10. MOTIVOS DE PERDA
create or replace function public.admin_lost_reasons(days_back integer default 90)
returns table (
  reason text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(lost_reason), ''), 'Não informado') as reason,
    count(*)::bigint as total
  from public.leads
  where created_at >= now() - make_interval(days => greatest(days_back, 1))
    and status = 'lost'
    and public.is_admin()
  group by 1
  order by 2 desc;
$$;

grant execute on function public.admin_lost_reasons(integer)
to authenticated;


-- =========================================================
-- FIM
-- =========================================================
