create table if not exists public.property_valuations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default current_organization_id() references public.organizations(id),
  property_id uuid not null references public.properties(id) on delete cascade,
  evaluator_id uuid null references public.profiles(id),
  valuation_date date not null default current_date,
  valuation_type text not null default 'market_comparison' check (valuation_type in ('manual','market_comparison','income','cost','hybrid')),
  status text not null default 'draft' check (status in ('draft','final','archived')),
  purpose text,
  minimum_value numeric(14,2) check (minimum_value is null or minimum_value >= 0),
  estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  maximum_value numeric(14,2) check (maximum_value is null or maximum_value >= 0),
  suggested_asking_value numeric(14,2) check (suggested_asking_value is null or suggested_asking_value >= 0),
  quick_sale_value numeric(14,2) check (quick_sale_value is null or quick_sale_value >= 0),
  estimated_price_per_m2 numeric(14,2) check (estimated_price_per_m2 is null or estimated_price_per_m2 >= 0),
  sample_quality numeric(5,2) check (sample_quality is null or sample_quality between 0 and 100),
  confidence_level text check (confidence_level is null or confidence_level in ('low','medium','high')),
  methodology_notes text,
  observations text,
  property_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.valuation_comparables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default current_organization_id() references public.organizations(id),
  valuation_id uuid not null references public.property_valuations(id) on delete cascade,
  comparable_property_id uuid references public.properties(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual','active_listing','closed_sale','withdrawn')),
  selection_status text not null default 'accepted' check (selection_status in ('pending','accepted','rejected')),
  reference_date date,
  source_label text,
  external_reference text,
  listed_price numeric(14,2) check (listed_price is null or listed_price >= 0),
  closed_price numeric(14,2) check (closed_price is null or closed_price >= 0),
  reference_value numeric(14,2) check (reference_value is null or reference_value >= 0),
  area numeric(14,2) check (area is null or area > 0),
  built_area numeric(14,2) check (built_area is null or built_area > 0),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  suites integer check (suites is null or suites >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  parking_spaces integer check (parking_spaces is null or parking_spaces >= 0),
  property_type text,
  purpose text,
  city_id uuid references public.cities(id),
  neighborhood_id uuid references public.neighborhoods(id),
  location_text text,
  distance_km numeric(10,3) check (distance_km is null or distance_km >= 0),
  similarity_index numeric(5,2) check (similarity_index is null or similarity_index between 0 and 100),
  weight numeric(10,4) not null default 1 check (weight > 0),
  adjusted_price_per_m2 numeric(14,2),
  adjusted_value numeric(14,2),
  notes text,
  property_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.valuation_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default current_organization_id() references public.organizations(id),
  comparable_id uuid not null references public.valuation_comparables(id) on delete cascade,
  adjustment_type text not null,
  percentage numeric(8,4) not null default 0 check (percentage between -100 and 100),
  adjustment_value numeric(14,2) not null default 0,
  justification text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default current_organization_id() references public.organizations(id),
  property_id uuid not null references public.properties(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  transaction_type text not null default 'sale' check (transaction_type in ('sale','rent','other')),
  listed_price numeric(14,2),
  proposal_price numeric(14,2),
  closed_price numeric(14,2),
  listed_at date,
  closed_at date,
  days_on_market integer check (days_on_market is null or days_on_market >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.property_valuations enable row level security;
alter table public.valuation_comparables enable row level security;
alter table public.valuation_adjustments enable row level security;
alter table public.property_transactions enable row level security;

grant select,insert,update,delete on public.property_valuations,public.valuation_comparables,public.valuation_adjustments,public.property_transactions to authenticated;

create index if not exists property_valuations_org_property_idx on public.property_valuations(organization_id,property_id,valuation_date desc);
create index if not exists property_valuations_property_status_idx on public.property_valuations(property_id,status);
create index if not exists valuation_comparables_valuation_idx on public.valuation_comparables(valuation_id,selection_status);
create index if not exists valuation_comparables_property_idx on public.valuation_comparables(comparable_property_id);
create index if not exists valuation_comparables_org_idx on public.valuation_comparables(organization_id);
create index if not exists valuation_adjustments_comparable_idx on public.valuation_adjustments(comparable_id,sort_order);
create index if not exists property_transactions_org_property_idx on public.property_transactions(organization_id,property_id,closed_at desc);

create policy "team_read_property_valuations" on public.property_valuations for select to authenticated using ((organization_id=current_organization_id()) and (select has_permission('properties.view')));
create policy "team_manage_property_valuations" on public.property_valuations for all to authenticated using ((organization_id=current_organization_id()) and ((select is_admin()) or (select has_permission('properties.manage')))) with check ((organization_id=current_organization_id()) and ((select is_admin()) or (select has_permission('properties.manage'))));
create policy "team_read_valuation_comparables" on public.valuation_comparables for select to authenticated using ((organization_id=current_organization_id()) and (select has_permission('properties.view')));
create policy "team_manage_valuation_comparables" on public.valuation_comparables for all to authenticated using ((organization_id=current_organization_id()) and ((select is_admin()) or (select has_permission('properties.manage')))) with check ((organization_id=current_organization_id()) and ((select is_admin()) or (select has_permission('properties.manage'))));
create policy "team_read_valuation_adjustments" on public.valuation_adjustments for select to authenticated using ((organization_id=current_organization_id()) and (select has_permission('properties.view')));
create policy "team_manage_valuation_adjustments" on public.valuation_adjustments for all to authenticated using ((organization_id=current_organization_id()) and ((select is_admin()) or (select has_permission('properties.manage')))) with check ((organization_id=current_organization_id()) and ((select is_admin()) or (select has_permission('properties.manage'))));
create policy "team_read_property_transactions" on public.property_transactions for select to authenticated using ((organization_id=current_organization_id()) and (select has_permission('properties.view')));
create policy "team_manage_property_transactions" on public.property_transactions for all to authenticated using ((organization_id=current_organization_id()) and ((select is_admin()) or (select has_permission('properties.manage')))) with check ((organization_id=current_organization_id()) and ((select is_admin()) or (select has_permission('properties.manage'))));

create or replace function public.snapshot_property_for_valuation() returns trigger language plpgsql security invoker set search_path=''
as $$
declare p record;
begin
  select pr.id,pr.code,pr.title,pr.purpose,pr.property_type,pr.sale_price,pr.rent_price,pr.total_area,pr.built_area,pr.bedrooms,pr.suites,pr.bathrooms,pr.parking_spaces,pr.furnished,pr.public_location_text,pr.city_id,pr.neighborhood_id,c.name city_name,c.state_code,n.name neighborhood_name
  into p from public.properties pr left join public.cities c on c.id=pr.city_id left join public.neighborhoods n on n.id=pr.neighborhood_id
  where pr.id=new.property_id and pr.organization_id=new.organization_id;
  if p.id is null then raise exception 'Imóvel não encontrado na organização ativa'; end if;
  if new.property_snapshot='{}'::jsonb then
    new.property_snapshot=jsonb_build_object('id',p.id,'code',p.code,'title',p.title,'purpose',p.purpose,'property_type',p.property_type,'sale_price',p.sale_price,'rent_price',p.rent_price,'total_area',p.total_area,'built_area',p.built_area,'bedrooms',p.bedrooms,'suites',p.suites,'bathrooms',p.bathrooms,'parking_spaces',p.parking_spaces,'furnished',p.furnished,'public_location_text',p.public_location_text,'city_id',p.city_id,'city_name',p.city_name,'state_code',p.state_code,'neighborhood_id',p.neighborhood_id,'neighborhood_name',p.neighborhood_name);
  end if;
  if new.evaluator_id is null then new.evaluator_id=auth.uid(); end if;
  return new;
end $$;

create trigger property_valuations_snapshot before insert on public.property_valuations for each row execute function public.snapshot_property_for_valuation();

create or replace function public.sync_valuation_adjustment_value() returns trigger language plpgsql security invoker set search_path=''
as $$
declare base_value numeric;
begin
  select coalesce(vc.reference_value,vc.closed_price,vc.listed_price,0) into base_value from public.valuation_comparables vc where vc.id=new.comparable_id and vc.organization_id=new.organization_id;
  new.adjustment_value=round(base_value*(new.percentage/100.0),2);
  return new;
end $$;

create trigger valuation_adjustments_calculate_value before insert or update of comparable_id,percentage on public.valuation_adjustments for each row execute function public.sync_valuation_adjustment_value();

create or replace function public.recalculate_property_valuation(p_valuation_id uuid) returns public.property_valuations language plpgsql security invoker set search_path=''
as $$
declare v public.property_valuations; target_area numeric; avg_value numeric; total_weight numeric; dispersion numeric; spread numeric; quality numeric; accepted_count integer; avg_similarity numeric; avg_distance numeric;
begin
  select * into v from public.property_valuations where id=p_valuation_id and organization_id=public.current_organization_id() for update;
  if v.id is null then raise exception 'Avaliação não encontrada'; end if;
  target_area=coalesce(nullif((v.property_snapshot->>'built_area')::numeric,0),nullif((v.property_snapshot->>'total_area')::numeric,0));
  with comparable_values as (
    select vc.id,coalesce(vc.adjusted_value,vc.reference_value,vc.closed_price,vc.listed_price) value,greatest(vc.weight,0.0001) weight,vc.similarity_index,vc.distance_km
    from public.valuation_comparables vc where vc.valuation_id=p_valuation_id and vc.organization_id=v.organization_id and vc.selection_status='accepted'
  ), enriched as (
    select cv.*,coalesce((select sum(va.adjustment_value) from public.valuation_adjustments va where va.comparable_id=cv.id and va.organization_id=v.organization_id),0) adjustment_total from comparable_values cv
  )
  select coalesce(sum((value+adjustment_total)*weight)/nullif(sum(weight),0),0),coalesce(sum(weight),0),count(*)::int,avg(similarity_index),avg(distance_km),stddev_samp(value+adjustment_total)
  into avg_value,total_weight,accepted_count,avg_similarity,avg_distance,dispersion from enriched;
  if accepted_count=0 or avg_value<=0 then
    update public.property_valuations set minimum_value=null,estimated_value=null,maximum_value=null,suggested_asking_value=null,quick_sale_value=null,estimated_price_per_m2=null,sample_quality=0,confidence_level='low',updated_at=now() where id=p_valuation_id;
    select * into v from public.property_valuations where id=p_valuation_id; return v;
  end if;
  spread=greatest(0.05,least(0.15,coalesce(dispersion/nullif(avg_value,0),0.10)));
  quality=least(100,least(40,accepted_count*8)+least(25,coalesce(avg_similarity,0)*0.25)+greatest(0,20-coalesce(avg_distance,20))+case when accepted_count>=6 then 15 when accepted_count>=4 then 10 when accepted_count>=2 then 6 else 2 end);
  update public.property_valuations set estimated_value=round(avg_value,2),minimum_value=round(avg_value*(1-spread),2),maximum_value=round(avg_value*(1+spread),2),suggested_asking_value=round(avg_value*(1+greatest(0.03,spread*0.45)),2),quick_sale_value=round(avg_value*(1-greatest(0.06,spread*0.65)),2),estimated_price_per_m2=case when target_area>0 then round(avg_value/target_area,2) else null end,sample_quality=round(quality,2),confidence_level=case when quality>=75 then 'high' when quality>=50 then 'medium' else 'low' end,updated_at=now() where id=p_valuation_id;
  select * into v from public.property_valuations where id=p_valuation_id; return v;
end $$;

revoke all on function public.recalculate_property_valuation(uuid) from public;
grant execute on function public.recalculate_property_valuation(uuid) to authenticated;

create or replace function public.get_property_valuation_candidates(p_property_id uuid,p_limit integer default 20)
returns table(property_id uuid,code text,title text,property_type text,purpose text,sale_price numeric,total_area numeric,built_area numeric,bedrooms integer,suites integer,bathrooms integer,parking_spaces integer,city_name text,neighborhood_name text,location_text text,similarity_index numeric)
language sql security invoker set search_path=''
as $$
with target as (select p.* from public.properties p where p.id=p_property_id and p.organization_id=public.current_organization_id()), scored as (
select p.id,p.code,p.title,p.property_type,p.purpose,p.sale_price,p.total_area,p.built_area,p.bedrooms,p.suites,p.bathrooms,p.parking_spaces,c.name city_name,n.name neighborhood_name,p.public_location_text location_text,
round(least(100,45+case when p.neighborhood_id=t.neighborhood_id then 25 else 0 end+case when p.property_type=t.property_type then 15 else 0 end+case when coalesce(t.built_area,t.total_area,0)>0 then greatest(0,10-abs(coalesce(p.built_area,p.total_area,0)-coalesce(t.built_area,t.total_area,0))/greatest(coalesce(t.built_area,t.total_area,1),1)*10) else 0 end+case when coalesce(p.bedrooms,-1)=coalesce(t.bedrooms,-2) then 5 else 0 end),2) similarity_index
from public.properties p cross join target t left join public.cities c on c.id=p.city_id left join public.neighborhoods n on n.id=p.neighborhood_id
where p.organization_id=public.current_organization_id() and p.id<>p_property_id and p.deleted_at is null and p.sale_price is not null and p.sale_price>0 and p.status in ('published','reserved','sold') and p.city_id is not distinct from t.city_id and (p.property_type=t.property_type or t.property_type is null) and (coalesce(p.built_area,p.total_area) is null or coalesce(t.built_area,t.total_area) is null or coalesce(p.built_area,p.total_area) between coalesce(t.built_area,t.total_area)*0.60 and coalesce(t.built_area,t.total_area)*1.40)
) select * from scored order by similarity_index desc,title limit greatest(1,least(coalesce(p_limit,20),100));
$$;

revoke all on function public.get_property_valuation_candidates(uuid,integer) from public;
grant execute on function public.get_property_valuation_candidates(uuid,integer) to authenticated;

create trigger property_valuations_updated_at before update on public.property_valuations for each row execute function public.touch_updated_at();
create trigger valuation_comparables_updated_at before update on public.valuation_comparables for each row execute function public.touch_updated_at();
create trigger valuation_adjustments_updated_at before update on public.valuation_adjustments for each row execute function public.touch_updated_at();
create trigger property_transactions_updated_at before update on public.property_transactions for each row execute function public.touch_updated_at();
