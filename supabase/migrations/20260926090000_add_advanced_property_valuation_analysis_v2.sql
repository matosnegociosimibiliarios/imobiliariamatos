create or replace function public.property_valuation_advanced_analysis_v2(p_valuation_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v public.property_valuations;
  v_org uuid := public.current_organization_id();
  v_area numeric;
  v_count integer := 0; v_closed_count integer := 0; v_listing_count integer := 0;
  v_mean numeric; v_weighted numeric; v_median numeric; v_p25 numeric; v_p75 numeric;
  v_min numeric; v_max numeric; v_stddev numeric; v_cv numeric; v_iqr numeric;
  v_lower numeric; v_upper numeric; v_outliers integer := 0;
  v_avg_similarity numeric; v_avg_distance numeric; v_quality numeric;
begin
  if not public.has_permission('properties.view') then raise exception 'not authorized'; end if;
  select * into v from public.property_valuations where id=p_valuation_id and organization_id=v_org;
  if v.id is null then raise exception 'Avaliação não encontrada'; end if;
  v_area := coalesce(nullif((v.property_snapshot->>'built_area')::numeric,0),nullif((v.property_snapshot->>'total_area')::numeric,0));
  with accepted as (
    select vc.*,coalesce(vc.adjusted_value,vc.reference_value,vc.closed_price,vc.listed_price) final_value,
      case when coalesce(vc.area,vc.built_area,0)>0 then coalesce(vc.adjusted_value,vc.reference_value,vc.closed_price,vc.listed_price)/coalesce(vc.area,vc.built_area) end price_m2
    from public.valuation_comparables vc where vc.valuation_id=v.id and vc.organization_id=v_org and vc.selection_status='accepted'
  ), stats as (
    select count(*) filter(where price_m2 is not null)::integer cnt,
      count(*) filter(where price_m2 is not null and source_type='closed_sale')::integer closed_cnt,
      count(*) filter(where price_m2 is not null and source_type='active_listing')::integer listing_cnt,
      avg(price_m2) mean_m2,
      case when sum(greatest(coalesce(weight,1),0)) filter(where price_m2 is not null)>0
        then sum(price_m2*greatest(coalesce(weight,1),0)) filter(where price_m2 is not null)/sum(greatest(coalesce(weight,1),0)) filter(where price_m2 is not null) end weighted_m2,
      percentile_cont(0.25) within group(order by price_m2) filter(where price_m2 is not null) p25,
      percentile_cont(0.5) within group(order by price_m2) filter(where price_m2 is not null) median_m2,
      percentile_cont(0.75) within group(order by price_m2) filter(where price_m2 is not null) p75,
      min(price_m2) min_m2,max(price_m2) max_m2,stddev_samp(price_m2) stddev_m2,
      avg(similarity_index) filter(where price_m2 is not null) avg_similarity,
      avg(distance_km) filter(where price_m2 is not null) avg_distance
    from accepted
  )
  select cnt,closed_cnt,listing_cnt,mean_m2,weighted_m2,p25,median_m2,p75,min_m2,max_m2,stddev_m2,avg_similarity,avg_distance
  into v_count,v_closed_count,v_listing_count,v_mean,v_weighted,v_p25,v_median,v_p75,v_min,v_max,v_stddev,v_avg_similarity,v_avg_distance from stats;
  v_cv:=case when coalesce(v_mean,0)>0 then coalesce(v_stddev,0)/v_mean*100 end;
  v_iqr:=case when v_p25 is not null and v_p75 is not null then v_p75-v_p25 end;
  v_lower:=case when v_iqr is not null then greatest(0,v_p25-1.5*v_iqr) end;
  v_upper:=case when v_iqr is not null then v_p75+1.5*v_iqr end;
  if v_lower is not null then
    with accepted as (
      select coalesce(vc.adjusted_value,vc.reference_value,vc.closed_price,vc.listed_price)/nullif(coalesce(vc.area,vc.built_area),0) price_m2
      from public.valuation_comparables vc where vc.valuation_id=v.id and vc.organization_id=v_org and vc.selection_status='accepted'
    ) select count(*) filter(where price_m2<v_lower or price_m2>v_upper) into v_outliers from accepted where price_m2 is not null;
  end if;
  v_quality:=least(100,greatest(0,least(35,v_count*7)+least(30,coalesce(v_avg_similarity,0)*0.30)+case when v_cv is null then 0 when v_cv<=10 then 25 when v_cv<=20 then 18 when v_cv<=30 then 10 else 0 end+least(10,v_closed_count*2)));
  return jsonb_build_object(
    'sample',jsonb_build_object('count',coalesce(v_count,0),'closed_sales',coalesce(v_closed_count,0),'active_listings',coalesce(v_listing_count,0),'closed_share_pct',case when v_count>0 then round(v_closed_count::numeric/v_count*100,1) end,'avg_similarity',case when v_avg_similarity is null then null else round(v_avg_similarity,2) end,'avg_distance_km',case when v_avg_distance is null then null else round(v_avg_distance,2) end),
    'price_per_m2',jsonb_build_object('mean',case when v_mean is null then null else round(v_mean,2) end,'weighted_mean',case when v_weighted is null then null else round(v_weighted,2) end,'p25',case when v_p25 is null then null else round(v_p25,2) end,'median',case when v_median is null then null else round(v_median,2) end,'p75',case when v_p75 is null then null else round(v_p75,2) end,'minimum',case when v_min is null then null else round(v_min,2) end,'maximum',case when v_max is null then null else round(v_max,2) end,'stddev',case when v_stddev is null then null else round(v_stddev,2) end,'coefficient_variation_pct',case when v_cv is null then null else round(v_cv,2) end,'iqr',case when v_iqr is null then null else round(v_iqr,2) end),
    'outliers',jsonb_build_object('count',coalesce(v_outliers,0),'lower_bound',case when v_lower is null then null else round(v_lower,2) end,'upper_bound',case when v_upper is null then null else round(v_upper,2) end),
    'scenarios',jsonb_build_object('conservative_value',case when v_area>0 and v_p25 is not null then round(v_area*v_p25,2) end,'central_value',case when v_area>0 and v_median is not null then round(v_area*v_median,2) end,'upper_market_value',case when v_area>0 and v_p75 is not null then round(v_area*v_p75,2) end,'estimated_value',v.estimated_value,'suggested_asking_value',v.suggested_asking_value,'quick_sale_value',v.quick_sale_value),
    'quality',jsonb_build_object('score',round(v_quality,1),'outliers',coalesce(v_outliers,0)),
    'interpretation',jsonb_build_object('sample_strength',case when v_count>=6 then 'forte' when v_count>=3 then 'moderada' else 'fraca' end,'dispersion',case when v_cv is null then 'indisponível' when v_cv<=10 then 'baixa' when v_cv<=20 then 'moderada' else 'alta' end,'market_signal',case when v.estimated_value is null or v_median is null or v_area is null or v_area<=0 then 'insuficiente' when v.estimated_value/(v_median*v_area)-1>0.10 then 'acima_da_mediana' when v.estimated_value/(v_median*v_area)-1< -0.10 then 'abaixo_da_mediana' else 'proximo_da_mediana' end)
  );
end;
$$;
revoke all on function public.property_valuation_advanced_analysis_v2(uuid) from public;
revoke execute on function public.property_valuation_advanced_analysis_v2(uuid) from anon;
grant execute on function public.property_valuation_advanced_analysis_v2(uuid) to authenticated;
