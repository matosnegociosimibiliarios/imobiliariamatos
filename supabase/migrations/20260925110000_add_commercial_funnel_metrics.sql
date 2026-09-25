create or replace function public.commercial_funnel_metrics(p_days_back integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_start timestamptz := now() - make_interval(days => greatest(coalesce(p_days_back, 30), 1));
  v_leads bigint;
  v_active bigint;
  v_won bigint;
  v_lost bigint;
  v_overdue_actions bigint;
  v_stale bigint;
  v_upcoming_appointments bigint;
  v_open_proposals bigint := 0;
  v_open_proposal_value numeric := 0;
  v_won_value numeric := 0;
  v_commission_value numeric := 0;
  v_can_proposals boolean := public.has_permission('proposals.view');
  v_can_deals boolean := public.has_permission('deals.view');
begin
  if not public.has_permission('leads.view') then
    raise exception 'not authorized';
  end if;

  select count(*) into v_leads
  from public.leads l
  where l.organization_id = v_org and l.created_at >= v_start;

  select count(*) into v_active
  from public.leads l
  where l.organization_id = v_org and l.status not in ('won','lost');

  select count(*) into v_won
  from public.leads l
  where l.organization_id = v_org and l.created_at >= v_start and l.status = 'won';

  select count(*) into v_lost
  from public.leads l
  where l.organization_id = v_org and l.created_at >= v_start and l.status = 'lost';

  select count(*) into v_overdue_actions
  from public.leads l
  where l.organization_id = v_org and l.status not in ('won','lost')
    and l.next_action_at is not null and l.next_action_at < now();

  select count(*) into v_stale
  from public.leads l
  where l.organization_id = v_org and l.status not in ('won','lost')
    and l.updated_at < now() - interval '7 days';

  select count(*) into v_upcoming_appointments
  from public.appointments a
  where a.organization_id = v_org
    and coalesce(a.scheduled_at, (a.requested_date + coalesce(a.requested_time, time '09:00'))) >= now()
    and coalesce(a.scheduled_at, (a.requested_date + coalesce(a.requested_time, time '09:00'))) < now() + interval '7 days'
    and a.status not in ('cancelled','completed');

  if v_can_proposals then
    select count(*), coalesce(sum(p.proposal_value),0)
      into v_open_proposals, v_open_proposal_value
    from public.proposals p
    where p.organization_id = v_org and p.status in ('draft','sent','negotiation');
  end if;

  if v_can_deals then
    select coalesce(sum(d.sale_value),0), coalesce(sum(d.commission_value),0)
      into v_won_value, v_commission_value
    from public.deals d
    where d.organization_id = v_org and d.created_at >= v_start and d.status <> 'cancelled';
  end if;

  return jsonb_build_object(
    'period_days', greatest(coalesce(p_days_back,30),1),
    'summary', jsonb_build_object(
      'leads', v_leads, 'active', v_active, 'won', v_won, 'lost', v_lost,
      'overdue_actions', v_overdue_actions, 'stale_leads', v_stale,
      'upcoming_appointments', v_upcoming_appointments,
      'open_proposals', v_open_proposals, 'open_proposal_value', v_open_proposal_value,
      'won_value', v_won_value, 'commission_value', v_commission_value,
      'proposals_access', v_can_proposals, 'deals_access', v_can_deals
    ),
    'stages', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'value', s.value, 'label', s.label, 'count', coalesce(x.total,0),
        'stale', coalesce(x.stale,0), 'overdue_actions', coalesce(x.overdue_actions,0)
      ) order by s.sort_order), '[]'::jsonb)
      from (values
        ('new','Novo',1), ('contacted','Contatado',2), ('qualified','Qualificado',3),
        ('visit_scheduled','Visita',4), ('proposal','Proposta',5),
        ('won','Fechado',6), ('lost','Perdido',7)
      ) as s(value,label,sort_order)
      left join (
        select l.status, count(*) total,
          count(*) filter (where l.status not in ('won','lost') and l.updated_at < now() - interval '7 days') stale,
          count(*) filter (where l.status not in ('won','lost') and l.next_action_at is not null and l.next_action_at < now()) overdue_actions
        from public.leads l where l.organization_id = v_org group by l.status
      ) x on x.status = s.value
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source', source_name, 'count', total
      ) order by total desc), '[]'::jsonb)
      from (
        select coalesce(nullif(trim(l.initial_source_platform),''), nullif(trim(l.source_platform),''), nullif(trim(l.source),''), 'não informado') source_name,
               count(*) total
        from public.leads l
        where l.organization_id = v_org and l.created_at >= v_start
        group by 1
      ) source_rows
    )
  );
end;
$$;

revoke all on function public.commercial_funnel_metrics(integer) from public;
grant execute on function public.commercial_funnel_metrics(integer) to authenticated;
