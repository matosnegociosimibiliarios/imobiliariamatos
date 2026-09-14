-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.10 - PAINEL GERENCIAL E METAS
-- =========================================================

-- 1. METAS MENSAIS
create table if not exists public.crm_monthly_goals (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,
  leads_goal integer not null default 0 check (leads_goal >= 0),
  visits_goal integer not null default 0 check (visits_goal >= 0),
  captures_goal integer not null default 0 check (captures_goal >= 0),
  proposals_goal integer not null default 0 check (proposals_goal >= 0),
  deals_goal integer not null default 0 check (deals_goal >= 0),
  sales_value_goal numeric(14,2) not null default 0 check (sales_value_goal >= 0),
  commission_goal numeric(14,2) not null default 0 check (commission_goal >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_monthly_goals_first_day check (period_month = date_trunc('month', period_month)::date)
);

create index if not exists crm_monthly_goals_period_idx
on public.crm_monthly_goals(period_month desc);

alter table public.crm_monthly_goals enable row level security;

drop trigger if exists crm_monthly_goals_touch_updated_at on public.crm_monthly_goals;
create trigger crm_monthly_goals_touch_updated_at
before update on public.crm_monthly_goals
for each row execute function public.touch_updated_at();

-- 2. POLÍTICAS PARA ADMINISTRADORES
drop policy if exists "admin_manage_crm_monthly_goals" on public.crm_monthly_goals;
create policy "admin_manage_crm_monthly_goals"
on public.crm_monthly_goals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 3. MÉTRICAS GERENCIAIS DE UM PERÍODO
create or replace function public.admin_management_period(
  p_start_date date,
  p_end_date date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      p_start_date::timestamptz as start_at,
      (p_end_date + 1)::timestamptz as end_at
  ),
  lead_stats as (
    select count(*)::bigint as total
    from public.leads l, bounds b
    where l.created_at >= b.start_at and l.created_at < b.end_at
  ),
  visitor_stats as (
    select count(distinct s.session_id)::bigint as total
    from public.site_visits s, bounds b
    where s.created_at >= b.start_at and s.created_at < b.end_at
  ),
  appointment_stats as (
    select
      count(*)::bigint as total,
      count(*) filter (where a.status = 'completed')::bigint as completed,
      count(distinct a.lead_id) filter (where a.status = 'completed')::bigint as completed_leads
    from public.appointments a, bounds b
    where coalesce(a.scheduled_at, a.created_at) >= b.start_at
      and coalesce(a.scheduled_at, a.created_at) < b.end_at
  ),
  capture_stats as (
    select count(*)::bigint as total
    from public.owner_captures c, bounds b
    where c.created_at >= b.start_at and c.created_at < b.end_at
  ),
  proposal_stats as (
    select
      count(*)::bigint as total,
      count(*) filter (where p.status = 'accepted')::bigint as accepted,
      count(distinct p.lead_id)::bigint as leads_with_proposal
    from public.proposals p, bounds b
    where p.created_at >= b.start_at and p.created_at < b.end_at
  ),
  deal_stats as (
    select
      count(*) filter (where d.status <> 'cancelled')::bigint as total,
      coalesce(sum(d.sale_value) filter (where d.status <> 'cancelled'), 0)::numeric as sales_value,
      coalesce(sum(d.commission_value) filter (where d.status <> 'cancelled'), 0)::numeric as commission_generated
    from public.deals d, bounds b
    where d.created_at >= b.start_at and d.created_at < b.end_at
  ),
  commission_stats as (
    select
      coalesce(sum(d.commission_received_amount) filter (where d.commission_status = 'received'), 0)::numeric as received
    from public.deals d, bounds b
    where d.commission_received_at >= b.start_at and d.commission_received_at < b.end_at
  ),
  property_stats as (
    select
      count(*) filter (where p.status = 'published')::bigint as published,
      count(*) filter (where p.status in ('published','draft'))::bigint as active_portfolio
    from public.properties p
    where p.deleted_at is null
  )
  select jsonb_build_object(
    'unique_visitors', coalesce(v.total, 0),
    'leads', coalesce(l.total, 0),
    'appointments', coalesce(a.total, 0),
    'visits_completed', coalesce(a.completed, 0),
    'visited_leads', coalesce(a.completed_leads, 0),
    'captures', coalesce(c.total, 0),
    'proposals', coalesce(p.total, 0),
    'proposals_accepted', coalesce(p.accepted, 0),
    'proposal_leads', coalesce(p.leads_with_proposal, 0),
    'deals', coalesce(d.total, 0),
    'sales_value', coalesce(d.sales_value, 0),
    'commission_generated', coalesce(d.commission_generated, 0),
    'commission_received', coalesce(cr.received, 0),
    'published_properties', coalesce(ps.published, 0),
    'active_portfolio', coalesce(ps.active_portfolio, 0),
    'lead_to_visit_rate', case when coalesce(l.total,0) > 0 then least(100, round((coalesce(a.completed_leads,0)::numeric / l.total::numeric) * 100, 1)) else 0 end,
    'visit_to_proposal_rate', case when coalesce(a.completed_leads,0) > 0 then least(100, round((coalesce(p.leads_with_proposal,0)::numeric / a.completed_leads::numeric) * 100, 1)) else 0 end,
    'proposal_to_deal_rate', case when coalesce(p.total,0) > 0 then least(100, round((coalesce(d.total,0)::numeric / p.total::numeric) * 100, 1)) else 0 end,
    'lead_to_deal_rate', case when coalesce(l.total,0) > 0 then least(100, round((coalesce(d.total,0)::numeric / l.total::numeric) * 100, 1)) else 0 end
  )
  from lead_stats l
  cross join visitor_stats v
  cross join appointment_stats a
  cross join capture_stats c
  cross join proposal_stats p
  cross join deal_stats d
  cross join commission_stats cr
  cross join property_stats ps
  where public.is_admin();
$$;

grant execute on function public.admin_management_period(date,date)
to authenticated;

-- 4. DESEMPENHO POR CANAL NO PERÍODO
create or replace function public.admin_management_channels(
  p_start_date date,
  p_end_date date
)
returns table (
  platform text,
  channel text,
  leads bigint,
  visits bigint,
  proposals bigint,
  deals bigint,
  sales_value numeric,
  commission_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select p_start_date::timestamptz as start_at, (p_end_date + 1)::timestamptz as end_at
  ),
  lead_metrics as (
    select
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      count(*)::bigint as leads
    from public.leads l, bounds b
    where l.created_at >= b.start_at and l.created_at < b.end_at
    group by 1,2
  ),
  visit_metrics as (
    select
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      count(distinct a.lead_id)::bigint as visits
    from public.appointments a
    join public.leads l on l.id = a.lead_id
    cross join bounds b
    where a.status = 'completed'
      and coalesce(a.scheduled_at, a.created_at) >= b.start_at
      and coalesce(a.scheduled_at, a.created_at) < b.end_at
    group by 1,2
  ),
  proposal_metrics as (
    select
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      count(*)::bigint as proposals
    from public.proposals p
    join public.leads l on l.id = p.lead_id
    cross join bounds b
    where p.created_at >= b.start_at and p.created_at < b.end_at
    group by 1,2
  ),
  deal_metrics as (
    select
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      count(*) filter (where d.status <> 'cancelled')::bigint as deals,
      coalesce(sum(d.sale_value) filter (where d.status <> 'cancelled'), 0)::numeric as sales_value,
      coalesce(sum(d.commission_value) filter (where d.status <> 'cancelled'), 0)::numeric as commission_value
    from public.deals d
    join public.leads l on l.id = d.lead_id
    cross join bounds b
    where d.created_at >= b.start_at and d.created_at < b.end_at
    group by 1,2
  ),
  keys as (
    select platform, channel from lead_metrics
    union
    select platform, channel from visit_metrics
    union
    select platform, channel from proposal_metrics
    union
    select platform, channel from deal_metrics
  )
  select
    k.platform,
    k.channel,
    coalesce(lm.leads,0)::bigint,
    coalesce(vm.visits,0)::bigint,
    coalesce(pm.proposals,0)::bigint,
    coalesce(dm.deals,0)::bigint,
    coalesce(dm.sales_value,0)::numeric,
    coalesce(dm.commission_value,0)::numeric
  from keys k
  left join lead_metrics lm using (platform,channel)
  left join visit_metrics vm using (platform,channel)
  left join proposal_metrics pm using (platform,channel)
  left join deal_metrics dm using (platform,channel)
  where public.is_admin()
  order by deals desc, leads desc, platform, channel;
$$;

grant execute on function public.admin_management_channels(date,date)
to authenticated;

-- 5. EVOLUÇÃO DOS ÚLTIMOS MESES
create or replace function public.admin_management_trend(p_months integer default 6)
returns table (
  month_start date,
  leads bigint,
  visits bigint,
  proposals bigint,
  deals bigint,
  sales_value numeric,
  commission_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with months as (
    select generate_series(
      date_trunc('month', current_date) - make_interval(months => greatest(p_months,1) - 1),
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  )
  select
    m.month_start,
    (
      select count(*)::bigint from public.leads l
      where l.created_at >= m.month_start::timestamptz
        and l.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as leads,
    (
      select count(distinct a.lead_id)::bigint from public.appointments a
      where a.status = 'completed'
        and coalesce(a.scheduled_at,a.created_at) >= m.month_start::timestamptz
        and coalesce(a.scheduled_at,a.created_at) < (m.month_start + interval '1 month')::timestamptz
    ) as visits,
    (
      select count(*)::bigint from public.proposals p
      where p.created_at >= m.month_start::timestamptz
        and p.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as proposals,
    (
      select count(*)::bigint from public.deals d
      where d.status <> 'cancelled'
        and d.created_at >= m.month_start::timestamptz
        and d.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as deals,
    (
      select coalesce(sum(d.sale_value),0)::numeric from public.deals d
      where d.status <> 'cancelled'
        and d.created_at >= m.month_start::timestamptz
        and d.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as sales_value,
    (
      select coalesce(sum(d.commission_value),0)::numeric from public.deals d
      where d.status <> 'cancelled'
        and d.created_at >= m.month_start::timestamptz
        and d.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as commission_value
  from months m
  where public.is_admin()
  order by m.month_start;
$$;

grant execute on function public.admin_management_trend(integer)
to authenticated;

-- =========================================================
-- FIM DA VERSÃO 10.10
-- =========================================================
