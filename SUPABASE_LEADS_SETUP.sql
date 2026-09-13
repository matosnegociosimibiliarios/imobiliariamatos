-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 7 - VISITANTES, LEADS E AGENDAMENTOS
-- =========================================================

-- 1. VISITAS / PAGE VIEWS
create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  session_id text not null,
  path text not null,
  page_type text,
  property_id uuid references public.properties(id) on delete set null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create index if not exists site_visits_created_at_idx
on public.site_visits(created_at desc);

create index if not exists site_visits_session_idx
on public.site_visits(session_id);

create index if not exists site_visits_property_idx
on public.site_visits(property_id);

alter table public.site_visits enable row level security;


-- 2. LEADS
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),

  property_id uuid references public.properties(id) on delete set null,

  name text not null,
  whatsapp text not null,
  email text,

  message text,

  source text not null default 'site',
  source_detail text,

  session_id text,
  landing_path text,

  status text not null default 'new'
    check (
      status in (
        'new',
        'contacted',
        'qualified',
        'visit_scheduled',
        'proposal',
        'won',
        'lost'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx
on public.leads(created_at desc);

create index if not exists leads_property_idx
on public.leads(property_id);

create index if not exists leads_status_idx
on public.leads(status);

alter table public.leads enable row level security;


-- 3. AGENDAMENTOS
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),

  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,

  requested_date date,
  requested_time time,

  scheduled_at timestamptz,

  status text not null default 'requested'
    check (
      status in (
        'requested',
        'confirmed',
        'completed',
        'cancelled',
        'no_show'
      )
    ),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_created_at_idx
on public.appointments(created_at desc);

create index if not exists appointments_lead_idx
on public.appointments(lead_id);

create index if not exists appointments_property_idx
on public.appointments(property_id);

create index if not exists appointments_status_idx
on public.appointments(status);

alter table public.appointments enable row level security;


-- 4. FUNÇÃO PARA ATUALIZAR updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at
before update on public.leads
for each row execute function public.touch_updated_at();

drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at
before update on public.appointments
for each row execute function public.touch_updated_at();


-- 5. VISITANTES: PODEM SOMENTE INSERIR VISITAS
drop policy if exists "public_insert_site_visits" on public.site_visits;

create policy "public_insert_site_visits"
on public.site_visits
for insert
to anon, authenticated
with check (
  length(session_id) between 8 and 128
  and length(path) between 1 and 500
);


-- 6. VISITANTES: PODEM ENVIAR LEADS, MAS NÃO LER
drop policy if exists "public_insert_leads" on public.leads;

create policy "public_insert_leads"
on public.leads
for insert
to anon, authenticated
with check (
  length(trim(name)) between 2 and 120
  and length(regexp_replace(whatsapp, '\D', '', 'g')) between 10 and 15
);


-- 7. VISITANTES: PODEM PEDIR AGENDAMENTO
drop policy if exists "public_insert_appointments" on public.appointments;

create policy "public_insert_appointments"
on public.appointments
for insert
to anon, authenticated
with check (
  lead_id is not null
);


-- 8. ADMIN: ACESSO COMPLETO
drop policy if exists "admin_manage_site_visits" on public.site_visits;
create policy "admin_manage_site_visits"
on public.site_visits
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_manage_leads" on public.leads;
create policy "admin_manage_leads"
on public.leads
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_manage_appointments" on public.appointments;
create policy "admin_manage_appointments"
on public.appointments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 9. PERMISSÕES SQL
grant insert on public.site_visits to anon, authenticated;
grant insert on public.leads to anon, authenticated;
grant insert on public.appointments to anon, authenticated;

grant select, insert, update, delete
on public.site_visits,
   public.leads,
   public.appointments
to authenticated;

grant usage, select on sequence public.site_visits_id_seq to anon, authenticated;


-- 10. RPC ADMIN PARA MÉTRICAS DOS ÚLTIMOS 30 DIAS
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
  won_count bigint;
  leads_from_visitors numeric;
  appointments_from_leads numeric;
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
  into won_count
  from public.leads
  where created_at >= start_at
    and status = 'won';

  leads_from_visitors :=
    case
      when unique_visitors_count = 0 then 0
      else round((leads_count::numeric / unique_visitors_count::numeric) * 100, 2)
    end;

  appointments_from_leads :=
    case
      when leads_count = 0 then 0
      else round((appointments_count::numeric / leads_count::numeric) * 100, 2)
    end;

  return jsonb_build_object(
    'visits', visits_count,
    'unique_visitors', unique_visitors_count,
    'leads', leads_count,
    'appointments', appointments_count,
    'won', won_count,
    'visitor_to_lead_rate', leads_from_visitors,
    'lead_to_appointment_rate', appointments_from_leads
  );
end;
$$;

grant execute on function public.admin_dashboard_metrics(integer) to authenticated;


-- 11. RPC ADMIN PARA ORIGENS DE LEADS
create or replace function public.admin_lead_sources(days_back integer default 30)
returns table (
  source text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(source), ''), 'site') as source,
    count(*)::bigint as total
  from public.leads
  where created_at >= now() - make_interval(days => greatest(days_back, 1))
    and public.is_admin()
  group by 1
  order by 2 desc;
$$;

grant execute on function public.admin_lead_sources(integer) to authenticated;


-- 12. RPC ADMIN PARA IMÓVEIS QUE MAIS GERAM LEADS
create or replace function public.admin_top_lead_properties(days_back integer default 30)
returns table (
  property_id uuid,
  code text,
  title text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.code,
    p.title,
    count(l.id)::bigint
  from public.leads l
  join public.properties p on p.id = l.property_id
  where l.created_at >= now() - make_interval(days => greatest(days_back, 1))
    and public.is_admin()
  group by p.id, p.code, p.title
  order by count(l.id) desc
  limit 10;
$$;

grant execute on function public.admin_top_lead_properties(integer) to authenticated;

-- =========================================================
-- FIM
-- =========================================================
