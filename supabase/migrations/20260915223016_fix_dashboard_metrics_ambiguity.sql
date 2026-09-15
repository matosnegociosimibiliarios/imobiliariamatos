create or replace function public.admin_dashboard_metrics(days_back integer default 30)
returns jsonb
language plpgsql
security invoker
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
  commission_total numeric;
begin
  if not public.has_permission('dashboard.view') then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back,1));

  select count(*) into visits_count
  from public.site_visits sv where sv.created_at >= start_at;

  select count(distinct sv.session_id) into unique_visitors_count
  from public.site_visits sv where sv.created_at >= start_at;

  select count(*) into leads_count
  from public.leads l where l.created_at >= start_at;

  select count(*) into appointments_count
  from public.appointments a where a.created_at >= start_at;

  select count(*) into proposal_count
  from public.leads l where l.created_at >= start_at and l.status='proposal';

  select count(*) into won_count
  from public.leads l where l.created_at >= start_at and l.status='won';

  select count(*) into captures_count
  from public.owner_captures c where c.created_at >= start_at;

  select count(*) into capture_new_count
  from public.owner_captures c where c.created_at >= start_at and c.status='new';

  select count(*) into capture_authorized_count
  from public.owner_captures c where c.created_at >= start_at and c.status='authorized';

  select count(*) into capture_published_count
  from public.owner_captures c where c.created_at >= start_at and c.status='published';

  select coalesce(sum(l.deal_value),0) into won_value
  from public.leads l where l.created_at >= start_at and l.status='won';

  select coalesce(sum(l.commission_value),0) into commission_total
  from public.leads l where l.created_at >= start_at and l.status='won';

  visitor_to_lead_rate := case when unique_visitors_count=0 then 0 else round((leads_count::numeric/unique_visitors_count::numeric)*100,2) end;
  lead_to_appointment_rate := case when leads_count=0 then 0 else round((appointments_count::numeric/leads_count::numeric)*100,2) end;
  lead_to_won_rate := case when leads_count=0 then 0 else round((won_count::numeric/leads_count::numeric)*100,2) end;

  return jsonb_build_object(
    'visits',visits_count,
    'unique_visitors',unique_visitors_count,
    'leads',leads_count,
    'appointments',appointments_count,
    'proposals',proposal_count,
    'won',won_count,
    'visitor_to_lead_rate',visitor_to_lead_rate,
    'lead_to_appointment_rate',lead_to_appointment_rate,
    'lead_to_won_rate',lead_to_won_rate,
    'won_value',won_value,
    'commission_value',commission_total,
    'captures',captures_count,
    'capture_new',capture_new_count,
    'capture_authorized',capture_authorized_count,
    'capture_published',capture_published_count
  );
end;
$$;

revoke all on function public.admin_dashboard_metrics(integer) from public, anon, authenticated;
grant execute on function public.admin_dashboard_metrics(integer) to authenticated;;
