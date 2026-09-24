alter table public.valuation_comparables
  add column if not exists transaction_id uuid references public.property_transactions(id) on delete set null;

create index if not exists valuation_comparables_transaction_idx
  on public.valuation_comparables(transaction_id);

create unique index if not exists valuation_comparables_valuation_transaction_uidx
  on public.valuation_comparables(valuation_id, transaction_id)
  where transaction_id is not null;

drop function if exists public.get_property_valuation_candidates(uuid, integer);

create or replace function public.get_property_valuation_candidates(
  p_property_id uuid,
  p_limit integer default 30
)
returns table(
  property_id uuid,
  transaction_id uuid,
  source_type text,
  reference_date date,
  code text,
  title text,
  property_type text,
  purpose text,
  sale_price numeric,
  listed_price numeric,
  proposal_price numeric,
  closed_price numeric,
  reference_value numeric,
  total_area numeric,
  built_area numeric,
  bedrooms integer,
  suites integer,
  bathrooms integer,
  parking_spaces integer,
  city_name text,
  neighborhood_name text,
  location_text text,
  days_on_market integer,
  similarity_index numeric
)
language sql
security invoker
set search_path=''
as $$
with target as (
  select
    p.id,
    p.organization_id,
    p.city_id,
    p.neighborhood_id,
    p.property_type,
    p.purpose,
    p.built_area,
    p.total_area,
    p.bedrooms
  from public.properties p
  where p.id = p_property_id
    and p.organization_id = public.current_organization_id()
    and p.deleted_at is null
),
base_properties as (
  select
    p.id,
    p.code,
    p.title,
    p.property_type,
    p.purpose,
    p.sale_price,
    p.city_id,
    p.neighborhood_id,
    p.total_area,
    p.built_area,
    p.bedrooms,
    p.suites,
    p.bathrooms,
    p.parking_spaces,
    p.public_location_text,
    c.name as city_name,
    n.name as neighborhood_name
  from public.properties p
  left join public.cities c on c.id = p.city_id
  left join public.neighborhoods n on n.id = p.neighborhood_id
  where p.organization_id = public.current_organization_id()
    and p.deleted_at is null
),
active_listings as (
  select
    bp.id as property_id,
    null::uuid as transaction_id,
    'active_listing'::text as source_type,
    current_date as reference_date,
    bp.code,
    bp.title,
    bp.property_type,
    bp.purpose,
    bp.sale_price,
    bp.sale_price as listed_price,
    null::numeric as proposal_price,
    null::numeric as closed_price,
    bp.sale_price as reference_value,
    bp.total_area,
    bp.built_area,
    bp.bedrooms,
    bp.suites,
    bp.bathrooms,
    bp.parking_spaces,
    bp.city_name,
    bp.neighborhood_name,
    bp.public_location_text as location_text,
    null::integer as days_on_market,
    round(
      least(
        100,
        45
        + case when bp.neighborhood_id = t.neighborhood_id then 25 else 0 end
        + case when bp.property_type = t.property_type then 15 else 0 end
        + case
            when coalesce(t.built_area, t.total_area, 0) > 0
            then greatest(
              0,
              10
              - abs(
                  coalesce(bp.built_area, bp.total_area, 0)
                  - coalesce(t.built_area, t.total_area, 0)
                )
                / greatest(coalesce(t.built_area, t.total_area, 1), 1)
                * 10
            )
            else 0
          end
        + case when coalesce(bp.bedrooms, -1) = coalesce(t.bedrooms, -2) then 5 else 0 end
      ),
      2
    ) as similarity_index
  from base_properties bp
  cross join target t
  where bp.id <> p_property_id
    and bp.sale_price is not null
    and bp.sale_price > 0
    and bp.status in ('published', 'reserved')
    and bp.city_id is not distinct from t.city_id
    and (bp.property_type = t.property_type or t.property_type is null)
    and (
      coalesce(bp.built_area, bp.total_area) is null
      or coalesce(t.built_area, t.total_area) is null
      or coalesce(bp.built_area, bp.total_area)
        between coalesce(t.built_area, t.total_area) * 0.60
        and coalesce(t.built_area, t.total_area) * 1.40
    )
),
closed_sales as (
  select
    bp.id as property_id,
    pt.id as transaction_id,
    'closed_sale'::text as source_type,
    pt.closed_at as reference_date,
    bp.code,
    bp.title,
    bp.property_type,
    bp.purpose,
    bp.sale_price,
    pt.listed_price,
    pt.proposal_price,
    pt.closed_price,
    pt.closed_price as reference_value,
    bp.total_area,
    bp.built_area,
    bp.bedrooms,
    bp.suites,
    bp.bathrooms,
    bp.parking_spaces,
    bp.city_name,
    bp.neighborhood_name,
    bp.public_location_text as location_text,
    pt.days_on_market,
    round(
      least(
        100,
        50
        + case when bp.neighborhood_id = t.neighborhood_id then 25 else 0 end
        + case when bp.property_type = t.property_type then 15 else 0 end
        + case
            when coalesce(t.built_area, t.total_area, 0) > 0
            then greatest(
              0,
              10
              - abs(
                  coalesce(bp.built_area, bp.total_area, 0)
                  - coalesce(t.built_area, t.total_area, 0)
                )
                / greatest(coalesce(t.built_area, t.total_area, 1), 1)
                * 10
            )
            else 0
          end
        + case when coalesce(bp.bedrooms, -1) = coalesce(t.bedrooms, -2) then 5 else 0 end
      ),
      2
    ) as similarity_index
  from public.property_transactions pt
  join base_properties bp on bp.id = pt.property_id
  cross join target t
  where pt.organization_id = public.current_organization_id()
    and pt.transaction_type = 'sale'
    and pt.closed_price is not null
    and pt.closed_price > 0
    and pt.closed_at is not null
    and bp.id <> p_property_id
    and bp.city_id is not distinct from t.city_id
    and (bp.property_type = t.property_type or t.property_type is null)
    and (
      coalesce(bp.built_area, bp.total_area) is null
      or coalesce(t.built_area, t.total_area) is null
      or coalesce(bp.built_area, bp.total_area)
        between coalesce(t.built_area, t.total_area) * 0.60
        and coalesce(t.built_area, t.total_area) * 1.40
    )
)
select *
from (
  select * from closed_sales
  union all
  select * from active_listings
) candidates
order by
  case when source_type = 'closed_sale' then 0 else 1 end,
  similarity_index desc,
  reference_date desc nulls last,
  title
limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.get_property_valuation_candidates(uuid, integer) from public;
grant execute on function public.get_property_valuation_candidates(uuid, integer) to authenticated;

revoke all on function public.sync_completed_deal_property_transaction() from public;
