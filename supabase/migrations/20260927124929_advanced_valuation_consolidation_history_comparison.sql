create table if not exists public.property_valuation_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id),
  valuation_id uuid not null references public.property_valuations(id) on delete cascade,
  version integer not null,
  event_type text not null,
  changed_fields jsonb not null default '{}'::jsonb,
  valuation_snapshot jsonb not null default '{}'::jsonb,
  actor_id uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint property_valuation_history_event_ck check (event_type in ('created','updated','recalculated','status_changed'))
);

create index if not exists property_valuation_history_org_val_idx on public.property_valuation_history (organization_id, valuation_id, version desc);
create index if not exists property_valuation_history_actor_idx on public.property_valuation_history (actor_id, created_at desc);

alter table public.property_valuation_history enable row level security;
drop policy if exists team_read_property_valuation_history on public.property_valuation_history;
drop policy if exists team_manage_property_valuation_history on public.property_valuation_history;
create policy team_read_property_valuation_history on public.property_valuation_history for select to authenticated
using ((organization_id = public.current_organization_id()) and (select public.has_permission('properties.view')));
create policy team_manage_property_valuation_history on public.property_valuation_history for insert to authenticated
with check ((organization_id = public.current_organization_id()) and ((select public.is_admin()) or (select public.has_permission('properties.manage'))));

create or replace function public.capture_property_valuation_history()
returns trigger language plpgsql set search_path = ''
as $$
declare v_version integer; v_event text; v_changed jsonb := '{}'::jsonb; v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then v_event := 'created'; v_version := 1;
  else
    select coalesce(max(version),0)+1 into v_version from public.property_valuation_history where valuation_id=new.id and organization_id=new.organization_id;
    if old.status is distinct from new.status then v_event := 'status_changed';
    elsif old.estimated_value is distinct from new.estimated_value or old.minimum_value is distinct from new.minimum_value or old.maximum_value is distinct from new.maximum_value or old.suggested_asking_value is distinct from new.suggested_asking_value or old.quick_sale_value is distinct from new.quick_sale_value or old.estimated_price_per_m2 is distinct from new.estimated_price_per_m2 or old.sample_quality is distinct from new.sample_quality then v_event := 'recalculated';
    else v_event := 'updated'; end if;
    v_changed := jsonb_build_object(
      'valuation_date',case when old.valuation_date is distinct from new.valuation_date then jsonb_build_array(to_jsonb(old.valuation_date),to_jsonb(new.valuation_date)) else null end,
      'status',case when old.status is distinct from new.status then jsonb_build_array(to_jsonb(old.status),to_jsonb(new.status)) else null end,
      'minimum_value',case when old.minimum_value is distinct from new.minimum_value then jsonb_build_array(to_jsonb(old.minimum_value),to_jsonb(new.minimum_value)) else null end,
      'estimated_value',case when old.estimated_value is distinct from new.estimated_value then jsonb_build_array(to_jsonb(old.estimated_value),to_jsonb(new.estimated_value)) else null end,
      'maximum_value',case when old.maximum_value is distinct from new.maximum_value then jsonb_build_array(to_jsonb(old.maximum_value),to_jsonb(new.maximum_value)) else null end,
      'suggested_asking_value',case when old.suggested_asking_value is distinct from new.suggested_asking_value then jsonb_build_array(to_jsonb(old.suggested_asking_value),to_jsonb(new.suggested_asking_value)) else null end,
      'quick_sale_value',case when old.quick_sale_value is distinct from new.quick_sale_value then jsonb_build_array(to_jsonb(old.quick_sale_value),to_jsonb(new.quick_sale_value)) else null end,
      'estimated_price_per_m2',case when old.estimated_price_per_m2 is distinct from new.estimated_price_per_m2 then jsonb_build_array(to_jsonb(old.estimated_price_per_m2),to_jsonb(new.estimated_price_per_m2)) else null end,
      'sample_quality',case when old.sample_quality is distinct from new.sample_quality then jsonb_build_array(to_jsonb(old.sample_quality),to_jsonb(new.sample_quality)) else null end,
      'confidence_level',case when old.confidence_level is distinct from new.confidence_level then jsonb_build_array(to_jsonb(old.confidence_level),to_jsonb(new.confidence_level)) else null end);
  end if;
  insert into public.property_valuation_history(organization_id,valuation_id,version,event_type,changed_fields,valuation_snapshot,actor_id)
  values(new.organization_id,new.id,v_version,v_event,coalesce(v_changed,'{}'::jsonb),to_jsonb(new),v_actor);
  return new;
end; $$;

drop trigger if exists trg_property_valuation_history on public.property_valuations;
create trigger trg_property_valuation_history after insert or update on public.property_valuations for each row execute function public.capture_property_valuation_history();

create or replace function public.consolidate_property_valuation_comparables(p_valuation_id uuid,p_limit integer default 30)
returns integer language plpgsql set search_path = ''
as $$
declare v_org uuid := public.current_organization_id(); v_property uuid; v_count integer := 0; v_inserted integer;
r record;
begin
  if not public.has_permission('properties.manage') then raise exception 'not authorized'; end if;
  select property_id into v_property from public.property_valuations where id=p_valuation_id and organization_id=v_org;
  if v_property is null then raise exception 'Avaliação não encontrada'; end if;
  for r in select * from public.get_property_valuation_candidates(v_property,greatest(1,least(coalesce(p_limit,30),100))) loop
    insert into public.valuation_comparables(
      organization_id,valuation_id,comparable_property_id,transaction_id,source_type,selection_status,reference_date,source_label,listed_price,closed_price,reference_value,area,built_area,bedrooms,suites,bathrooms,parking_spaces,property_type,purpose,location_text,similarity_index,weight,notes,property_snapshot)
    values(v_org,p_valuation_id,r.property_id,r.transaction_id,r.source_type,'accepted',r.reference_date,'CRM',r.listed_price,r.closed_price,r.reference_value,r.total_area,r.built_area,r.bedrooms,r.suites,r.bathrooms,r.parking_spaces,r.property_type,r.purpose,r.location_text,r.similarity_index,greatest(0.1,coalesce(r.similarity_index,50)/100.0),'Consolidado automaticamente a partir da amostra de mercado',jsonb_build_object('property_id',r.property_id,'code',r.code,'title',r.title,'city_name',r.city_name,'neighborhood_name',r.neighborhood_name,'source_type',r.source_type,'reference_date',r.reference_date,'listed_price',r.listed_price,'closed_price',r.closed_price,'area',r.total_area,'built_area',r.built_area,'bedrooms',r.bedrooms,'suites',r.suites,'bathrooms',r.bathrooms,'parking_spaces',r.parking_spaces))
    on conflict do nothing;
    get diagnostics v_inserted = row_count; v_count := v_count + v_inserted;
  end loop;
  perform public.recalculate_property_valuation(p_valuation_id);
  return v_count;
end; $$;

revoke all on function public.consolidate_property_valuation_comparables(uuid,integer) from public;
revoke execute on function public.consolidate_property_valuation_comparables(uuid,integer) from anon;
grant execute on function public.consolidate_property_valuation_comparables(uuid,integer) to authenticated;

create or replace function public.property_valuations_comparison(p_property_id uuid)
returns jsonb language sql set search_path = ''
as $$
with v as (
 select pv.id,pv.valuation_date,pv.status,pv.purpose,pv.minimum_value,pv.estimated_value,pv.maximum_value,pv.suggested_asking_value,pv.quick_sale_value,pv.estimated_price_per_m2,pv.sample_quality,pv.confidence_level,pv.created_at,pv.updated_at
 from public.property_valuations pv where pv.property_id=p_property_id and pv.organization_id=public.current_organization_id() and public.has_permission('properties.view'))
select jsonb_build_object('property_id',p_property_id,'count',count(*),'valuations',coalesce(jsonb_agg(to_jsonb(v) order by valuation_date desc,created_at desc),'[]'::jsonb),'latest',(select to_jsonb(v2) from v v2 order by valuation_date desc,created_at desc limit 1)) from v;
$$;

revoke all on function public.property_valuations_comparison(uuid) from public;
revoke execute on function public.property_valuations_comparison(uuid) from anon;
grant execute on function public.property_valuations_comparison(uuid) to authenticated;

create or replace function public.property_valuation_executive_summary(p_valuation_id uuid)
returns jsonb language plpgsql set search_path = ''
as $$
declare v public.property_valuations; a jsonb;
begin
 if not public.has_permission('properties.view') then raise exception 'not authorized'; end if;
 select * into v from public.property_valuations where id=p_valuation_id and organization_id=public.current_organization_id();
 if v.id is null then raise exception 'Avaliação não encontrada'; end if;
 a := public.property_valuation_advanced_analysis_v2(p_valuation_id);
 return jsonb_build_object('valuation',jsonb_build_object('id',v.id,'property_id',v.property_id,'valuation_date',v.valuation_date,'status',v.status,'estimated_value',v.estimated_value,'minimum_value',v.minimum_value,'maximum_value',v.maximum_value,'suggested_asking_value',v.suggested_asking_value,'quick_sale_value',v.quick_sale_value,'estimated_price_per_m2',v.estimated_price_per_m2,'sample_quality',v.sample_quality,'confidence_level',v.confidence_level),'analysis',a,'history_count',(select count(*) from public.property_valuation_history h where h.valuation_id=v.id and h.organization_id=v.organization_id));
end; $$;

revoke all on function public.property_valuation_executive_summary(uuid) from public;
revoke execute on function public.property_valuation_executive_summary(uuid) from anon;
grant execute on function public.property_valuation_executive_summary(uuid) to authenticated;
