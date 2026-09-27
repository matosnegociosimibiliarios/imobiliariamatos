CREATE OR REPLACE FUNCTION public.recalculate_property_valuation(p_valuation_id uuid)
 RETURNS property_valuations
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v public.property_valuations;
  target_area numeric;
  avg_value numeric;
  avg_price_m2 numeric;
  total_weight numeric;
  dispersion numeric;
  spread numeric;
  quality numeric;
  accepted_count integer;
  avg_similarity numeric;
  avg_distance numeric;
begin
  select * into v from public.property_valuations
  where id=p_valuation_id and organization_id=public.current_organization_id() for update;
  if v.id is null then raise exception 'Avaliação não encontrada'; end if;

  target_area := coalesce(nullif((v.property_snapshot->>'built_area')::numeric,0),nullif((v.property_snapshot->>'total_area')::numeric,0));

  with comparable_values as (
    select vc.id,
      coalesce(vc.adjusted_value,vc.reference_value,vc.closed_price,vc.listed_price) as value,
      greatest(vc.weight,0.0001) as weight,
      vc.similarity_index,vc.distance_km,
      case when coalesce(vc.area,vc.built_area,0)>0
        then coalesce(vc.adjusted_value,vc.reference_value,vc.closed_price,vc.listed_price)/coalesce(vc.area,vc.built_area)
      end as price_m2
    from public.valuation_comparables vc
    where vc.valuation_id=p_valuation_id and vc.organization_id=v.organization_id and vc.selection_status='accepted'
  ), enriched as (
    select cv.*,coalesce((select sum(va.adjustment_value) from public.valuation_adjustments va
      where va.comparable_id=cv.id and va.organization_id=v.organization_id),0) as adjustment_total
    from comparable_values cv
  ), priced as (
    select *, value+adjustment_total as final_value,
      case when price_m2 is not null and coalesce((select sum(va.adjustment_value) from public.valuation_adjustments va where va.comparable_id=enriched.id and va.organization_id=v.organization_id),0) is not null
        then (value+adjustment_total)/nullif((select area from public.valuation_comparables x where x.id=enriched.id),0)
      end adjusted_price_m2
    from enriched
  )
  select
    coalesce(sum(final_value*weight)/nullif(sum(weight),0),0),
    case when sum(weight) filter(where adjusted_price_m2 is not null)>0
      then sum(adjusted_price_m2*weight) filter(where adjusted_price_m2 is not null)/sum(weight) filter(where adjusted_price_m2 is not null)
    end,
    coalesce(sum(weight),0),count(*)::int,avg(similarity_index),avg(distance_km),stddev_samp(final_value)
  into avg_value,avg_price_m2,total_weight,accepted_count,avg_similarity,avg_distance,dispersion
  from priced;

  if accepted_count=0 or (coalesce(avg_price_m2,0)<=0 and avg_value<=0) then
    update public.property_valuations set minimum_value=null,estimated_value=null,maximum_value=null,
      suggested_asking_value=null,quick_sale_value=null,estimated_price_per_m2=null,sample_quality=0,
      confidence_level='low',updated_at=now() where id=p_valuation_id;
    select * into v from public.property_valuations where id=p_valuation_id; return v;
  end if;

  if target_area is not null and target_area>0 and avg_price_m2>0 then
    avg_value := avg_price_m2*target_area;
  end if;

  spread := greatest(0.05,least(0.15,coalesce(dispersion/nullif(avg_value,0),0.10)));
  quality := least(100,
    least(40,accepted_count*8)
    + least(25,coalesce(avg_similarity,0)*0.25)
    + greatest(0,20-coalesce(avg_distance,20))
    + case when accepted_count>=6 then 15 when accepted_count>=4 then 10 when accepted_count>=2 then 6 else 2 end
    + case when target_area>0 and avg_price_m2>0 then 5 else 0 end);

  update public.property_valuations
  set estimated_value=round(avg_value,2),
      minimum_value=round(avg_value*(1-spread),2),
      maximum_value=round(avg_value*(1+spread),2),
      suggested_asking_value=round(avg_value*(1+greatest(0.03,spread*0.45)),2),
      quick_sale_value=round(avg_value*(1-greatest(0.06,spread*0.65)),2),
      estimated_price_per_m2=case when target_area>0 and avg_price_m2>0 then round(avg_price_m2,2) else null end,
      sample_quality=round(quality,2),
      confidence_level=case when quality>=75 then 'high' when quality>=50 then 'medium' else 'low' end,
      updated_at=now()
  where id=p_valuation_id;

  select * into v from public.property_valuations where id=p_valuation_id; return v;
end;
$function$
