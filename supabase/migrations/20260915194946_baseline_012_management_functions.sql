CREATE OR REPLACE FUNCTION public.admin_management_channels(p_start_date date, p_end_date date)
 RETURNS TABLE(platform text, channel text, leads bigint, visits bigint, proposals bigint, deals bigint, sales_value numeric, commission_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with bounds as (select p_start_date::timestamptz as start_at, (p_end_date + 1)::timestamptz as end_at),
  lead_metrics as (
    select coalesce(l.initial_source_platform,l.source_platform,'site') as platform, coalesce(l.initial_source_channel,l.source_channel,'form') as channel, count(*)::bigint as leads
    from public.leads l,bounds b where l.created_at>=b.start_at and l.created_at<b.end_at group by 1,2
  ),
  visit_metrics as (
    select coalesce(l.initial_source_platform,l.source_platform,'site') as platform, coalesce(l.initial_source_channel,l.source_channel,'form') as channel, count(distinct a.lead_id)::bigint as visits
    from public.appointments a join public.leads l on l.id=a.lead_id cross join bounds b
    where a.status='completed' and coalesce(a.scheduled_at,a.created_at)>=b.start_at and coalesce(a.scheduled_at,a.created_at)<b.end_at group by 1,2
  ),
  proposal_metrics as (
    select coalesce(l.initial_source_platform,l.source_platform,'site') as platform, coalesce(l.initial_source_channel,l.source_channel,'form') as channel, count(*)::bigint as proposals
    from public.proposals p join public.leads l on l.id=p.lead_id cross join bounds b where p.created_at>=b.start_at and p.created_at<b.end_at group by 1,2
  ),
  deal_metrics as (
    select coalesce(l.initial_source_platform,l.source_platform,'site') as platform, coalesce(l.initial_source_channel,l.source_channel,'form') as channel,
      count(*) filter(where d.status<>'cancelled')::bigint as deals,
      coalesce(sum(d.sale_value) filter(where d.status<>'cancelled'),0)::numeric as sales_value,
      coalesce(sum(d.commission_value) filter(where d.status<>'cancelled'),0)::numeric as commission_value
    from public.deals d join public.leads l on l.id=d.lead_id cross join bounds b where d.created_at>=b.start_at and d.created_at<b.end_at group by 1,2
  ),
  keys as (select platform,channel from lead_metrics union select platform,channel from visit_metrics union select platform,channel from proposal_metrics union select platform,channel from deal_metrics)
  select k.platform,k.channel,coalesce(lm.leads,0)::bigint,coalesce(vm.visits,0)::bigint,coalesce(pm.proposals,0)::bigint,coalesce(dm.deals,0)::bigint,coalesce(dm.sales_value,0)::numeric,coalesce(dm.commission_value,0)::numeric
  from keys k left join lead_metrics lm using(platform,channel) left join visit_metrics vm using(platform,channel) left join proposal_metrics pm using(platform,channel) left join deal_metrics dm using(platform,channel)
  where public.has_permission('management.view') order by deals desc,leads desc,platform,channel;
$function$;

CREATE OR REPLACE FUNCTION public.admin_management_period(p_start_date date, p_end_date date)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with bounds as (select p_start_date::timestamptz as start_at,(p_end_date+1)::timestamptz as end_at),
  lead_stats as (select count(*)::bigint total from public.leads l,bounds b where l.created_at>=b.start_at and l.created_at<b.end_at),
  visitor_stats as (select count(distinct s.session_id)::bigint total from public.site_visits s,bounds b where s.created_at>=b.start_at and s.created_at<b.end_at),
  appointment_stats as (select count(*)::bigint total,count(*) filter(where a.status='completed')::bigint completed,count(distinct a.lead_id) filter(where a.status='completed')::bigint completed_leads from public.appointments a,bounds b where coalesce(a.scheduled_at,a.created_at)>=b.start_at and coalesce(a.scheduled_at,a.created_at)<b.end_at),
  capture_stats as (select count(*)::bigint total from public.owner_captures c,bounds b where c.created_at>=b.start_at and c.created_at<b.end_at),
  proposal_stats as (select count(*)::bigint total,count(*) filter(where p.status='accepted')::bigint accepted,count(distinct p.lead_id)::bigint leads_with_proposal from public.proposals p,bounds b where p.created_at>=b.start_at and p.created_at<b.end_at),
  deal_stats as (select count(*) filter(where d.status<>'cancelled')::bigint total,coalesce(sum(d.sale_value) filter(where d.status<>'cancelled'),0)::numeric sales_value,coalesce(sum(d.commission_value) filter(where d.status<>'cancelled'),0)::numeric commission_generated from public.deals d,bounds b where d.created_at>=b.start_at and d.created_at<b.end_at),
  commission_stats as (select coalesce(sum(d.commission_received_amount) filter(where d.commission_status='received'),0)::numeric received from public.deals d,bounds b where d.commission_received_at>=b.start_at and d.commission_received_at<b.end_at),
  property_stats as (select count(*) filter(where p.status='published')::bigint published,count(*) filter(where p.status in('published','draft'))::bigint active_portfolio from public.properties p where p.deleted_at is null)
  select jsonb_build_object('unique_visitors',coalesce(v.total,0),'leads',coalesce(l.total,0),'appointments',coalesce(a.total,0),'visits_completed',coalesce(a.completed,0),'visited_leads',coalesce(a.completed_leads,0),'captures',coalesce(c.total,0),'proposals',coalesce(p.total,0),'proposals_accepted',coalesce(p.accepted,0),'proposal_leads',coalesce(p.leads_with_proposal,0),'deals',coalesce(d.total,0),'sales_value',coalesce(d.sales_value,0),'commission_generated',coalesce(d.commission_generated,0),'commission_received',coalesce(cr.received,0),'published_properties',coalesce(ps.published,0),'active_portfolio',coalesce(ps.active_portfolio,0),'lead_to_visit_rate',case when coalesce(l.total,0)>0 then least(100,round((coalesce(a.completed_leads,0)::numeric/l.total::numeric)*100,1)) else 0 end,'visit_to_proposal_rate',case when coalesce(a.completed_leads,0)>0 then least(100,round((coalesce(p.leads_with_proposal,0)::numeric/a.completed_leads::numeric)*100,1)) else 0 end,'proposal_to_deal_rate',case when coalesce(p.total,0)>0 then least(100,round((coalesce(d.total,0)::numeric/p.total::numeric)*100,1)) else 0 end,'lead_to_deal_rate',case when coalesce(l.total,0)>0 then least(100,round((coalesce(d.total,0)::numeric/l.total::numeric)*100,1)) else 0 end)
  from lead_stats l cross join visitor_stats v cross join appointment_stats a cross join capture_stats c cross join proposal_stats p cross join deal_stats d cross join commission_stats cr cross join property_stats ps
  where public.has_permission('management.view');
$function$;

CREATE OR REPLACE FUNCTION public.admin_management_trend(p_months integer DEFAULT 6)
 RETURNS TABLE(month_start date, leads bigint, visits bigint, proposals bigint, deals bigint, sales_value numeric, commission_value numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with months as (select generate_series(date_trunc('month',current_date)-make_interval(months=>greatest(p_months,1)-1),date_trunc('month',current_date),interval '1 month')::date as month_start)
  select m.month_start,
    (select count(*)::bigint from public.leads l where l.created_at>=m.month_start::timestamptz and l.created_at<(m.month_start+interval '1 month')::timestamptz),
    (select count(distinct a.lead_id)::bigint from public.appointments a where a.status='completed' and coalesce(a.scheduled_at,a.created_at)>=m.month_start::timestamptz and coalesce(a.scheduled_at,a.created_at)<(m.month_start+interval '1 month')::timestamptz),
    (select count(*)::bigint from public.proposals p where p.created_at>=m.month_start::timestamptz and p.created_at<(m.month_start+interval '1 month')::timestamptz),
    (select count(*)::bigint from public.deals d where d.status<>'cancelled' and d.created_at>=m.month_start::timestamptz and d.created_at<(m.month_start+interval '1 month')::timestamptz),
    (select coalesce(sum(d.sale_value),0)::numeric from public.deals d where d.status<>'cancelled' and d.created_at>=m.month_start::timestamptz and d.created_at<(m.month_start+interval '1 month')::timestamptz),
    (select coalesce(sum(d.commission_value),0)::numeric from public.deals d where d.status<>'cancelled' and d.created_at>=m.month_start::timestamptz and d.created_at<(m.month_start+interval '1 month')::timestamptz)
  from months m where public.has_permission('management.view') order by m.month_start;
$function$;;
