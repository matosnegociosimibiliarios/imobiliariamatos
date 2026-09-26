create or replace function public.property_valuation_advanced_analysis(p_valuation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.property_valuations;
  v_org uuid := public.current_organization_id();
  v_area numeric;
  v_rent numeric;
  v_estimated numeric;
  v_mean_m2 numeric;
  v_weighted_m2 numeric;
  v_median_m2 numeric;
  v_min_m2 numeric;
  v_max_m2 numeric;
  v_stddev_m2 numeric;
  v_cv numeric;
  v_count integer := 0;
  v_closed_count integer := 0;
  v_listing_count integer := 0;
  v_avg_similarity numeric;
  v_avg_distance numeric;
  v_avg_dom numeric;
  v_median_dom numeric;
  v_avg_discount numeric;
  v_gross_yield numeric;
  v_market_position numeric;
  v_quality_score numeric;
  v_confidence text;
begin
  if not public.has_permission('properties.view') then raise exception 'not authorized'; end if;
  select * into v from public.property_valuations where id = p_valuation_id and organization_id = v_org;
  if v.id is null then raise exception 'Avaliação não encontrada'; end if;

  v_area := coalesce(nullif((v.property_snapshot->>'built_area')::numeric, 0), nullif((v.property_snapshot->>'total_area')::numeric, 0));
  v_rent := coalesce(nullif((v.property_snapshot->>'rent_price')::numeric, 0), nullif((v.property_snapshot->>'rent_value')::numeric, 0));
  v_estimated := v.estimated_value;

  with accepted as (
    select vc.*, pt.days_on_market as transaction_days_on_market,
      coalesce(vc.adjusted_value, vc.reference_value, vc.closed_price, vc.listed_price) as final_value,
      case when coalesce(vc.area, vc.built_area, 0) > 0
        then coalesce(vc.adjusted_value, vc.reference_value, vc.closed_price, vc.listed_price) / coalesce(vc.area, vc.built_area)
        else null end as price_m2
    from public.valuation_comparables vc
    left join public.property_transactions pt on pt.id = vc.transaction_id and pt.organization_id = v_org
    where vc.valuation_id = v.id and vc.organization_id = v_org and vc.selection_status = 'accepted'
  ), stats as (
    select count(*)::integer count,
      count(*) filter (where source_type = 'closed_sale')::integer closed_count,
      count(*) filter (where source_type = 'active_listing')::integer listing_count,
      avg(price_m2) mean_m2,
      case when sum(greatest(coalesce(weight, 1), 0)) > 0 then sum(price_m2 * greatest(coalesce(weight, 1), 0)) / sum(greatest(coalesce(weight, 1), 0)) else null end weighted_m2,
      percentile_cont(0.5) within group (order by price_m2) median_m2,
      min(price_m2) min_m2, max(price_m2) max_m2, stddev_samp(price_m2) stddev_m2,
      avg(similarity_index) avg_similarity, avg(distance_km) avg_distance,
      avg(coalesce(transaction_days_on_market, nullif((property_snapshot->>'days_on_market')::numeric, null))) filter (where source_type = 'closed_sale') avg_dom,
      percentile_cont(0.5) within group (order by coalesce(transaction_days_on_market, nullif((property_snapshot->>'days_on_market')::numeric, null)))
        filter (where source_type = 'closed_sale' and coalesce(transaction_days_on_market, nullif((property_snapshot->>'days_on_market')::numeric, null)) is not null) median_dom,
      avg(case when source_type = 'closed_sale' and listed_price > 0 and closed_price is not null then (closed_price / listed_price - 1) * 100 end) avg_discount
    from accepted where price_m2 is not null
  )
  select count, closed_count, listing_count, mean_m2, weighted_m2, median_m2, min_m2, max_m2, stddev_m2, avg_similarity, avg_distance, avg_dom, median_dom, avg_discount
  into v_count, v_closed_count, v_listing_count, v_mean_m2, v_weighted_m2, v_median_m2, v_min_m2, v_max_m2, v_stddev_m2, v_avg_similarity, v_avg_distance, v_avg_dom, v_median_dom, v_avg_discount
  from stats;

  v_cv := case when coalesce(v_mean_m2, 0) > 0 then (coalesce(v_stddev_m2, 0) / v_mean_m2) * 100 else null end;
  v_gross_yield := case when coalesce(v_rent, 0) > 0 and coalesce(v_estimated, 0) > 0 then ((v_rent * 12) / v_estimated) * 100 else null end;
  v_market_position := case when coalesce(v_estimated, 0) > 0 and coalesce(v_median_m2, 0) > 0 and coalesce(v_area, 0) > 0 then ((v_estimated / (v_median_m2 * v_area)) - 1) * 100 else null end;
  v_quality_score := least(100, greatest(0,
    (least(v_count, 10) / 10.0) * 35
    + least(coalesce(v_avg_similarity, 0), 100) * 0.35
    + case when v_cv is null then 0 when v_cv <= 10 then 30 when v_cv <= 20 then 20 when v_cv <= 30 then 10 else 0 end
  ));
  v_confidence := case
    when v_count >= 5 and coalesce(v_avg_similarity, 0) >= 75 and coalesce(v_cv, 999) <= 20 then 'high'
    when v_count >= 3 and coalesce(v_avg_similarity, 0) >= 60 and coalesce(v_cv, 999) <= 30 then 'medium'
    else 'low'
  end;

  return jsonb_build_object(
    'sample', jsonb_build_object('count', coalesce(v_count, 0), 'closed_sales', coalesce(v_closed_count, 0), 'active_listings', coalesce(v_listing_count, 0), 'avg_similarity', case when v_avg_similarity is null then null else round(v_avg_similarity, 2) end, 'avg_distance_km', case when v_avg_distance is null then null else round(v_avg_distance, 2) end),
    'price_per_m2', jsonb_build_object('mean', case when v_mean_m2 is null then null else round(v_mean_m2, 2) end, 'weighted_mean', case when v_weighted_m2 is null then null else round(v_weighted_m2, 2) end, 'median', case when v_median_m2 is null then null else round(v_median_m2, 2) end, 'minimum', case when v_min_m2 is null then null else round(v_min_m2, 2) end, 'maximum', case when v_max_m2 is null then null else round(v_max_m2, 2) end, 'stddev', case when v_stddev_m2 is null then null else round(v_stddev_m2, 2) end, 'coefficient_variation_pct', case when v_cv is null then null else round(v_cv, 2) end),
    'liquidity', jsonb_build_object('avg_days_on_market', case when v_avg_dom is null then null else round(v_avg_dom, 1) end, 'median_days_on_market', case when v_median_dom is null then null else round(v_median_dom, 1) end, 'avg_closed_discount_pct', case when v_avg_discount is null then null else round(v_avg_discount, 2) end),
    'investment', jsonb_build_object('monthly_rent', v_rent, 'gross_yield_pct', case when v_gross_yield is null then null else round(v_gross_yield, 2) end),
    'quality', jsonb_build_object('score', round(v_quality_score, 1), 'confidence', v_confidence),
    'positioning', jsonb_build_object('estimated_vs_median_market_pct', case when v_market_position is null then null else round(v_market_position, 2) end, 'estimated_value', v_estimated, 'quick_sale_value', v.quick_sale_value, 'suggested_asking_value', v.suggested_asking_value, 'minimum_value', v.minimum_value, 'maximum_value', v.maximum_value)
  );
end;
$$;

revoke all on function public.property_valuation_advanced_analysis(uuid) from public;
grant execute on function public.property_valuation_advanced_analysis(uuid) to authenticated;