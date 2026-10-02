drop function public.get_public_properties(text,text,boolean,integer);
drop function public.get_public_property_by_slug(text,text);
create function public.get_public_properties(p_organization_slug text,p_purpose text default null,p_featured_only boolean default false,p_limit integer default 24)
returns table(id uuid,code text,title text,slug text,purpose text,property_type text,sale_price numeric,rent_price numeric,public_location_text text,total_area numeric,built_area numeric,bedrooms integer,bathrooms integer,parking_spaces integer,featured boolean,tag text,created_at timestamptz)
language sql stable security definer set search_path='public' as $$
 select p.id,p.code,p.title,p.slug,p.purpose,p.property_type,p.sale_price,p.rent_price,p.public_location_text,p.total_area,p.built_area,p.bedrooms,p.bathrooms,p.parking_spaces,p.featured,p.tag,p.created_at
 from public.properties p join public.organizations o on o.id=p.organization_id
 where o.slug=lower(trim(p_organization_slug)) and o.status in ('trial','active') and p.status='published' and p.deleted_at is null
 and (p_purpose is null or (p_purpose='sale' and p.purpose in ('sale','sale_and_rent')) or (p_purpose='rent' and p.purpose in ('rent','sale_and_rent')))
 and (not p_featured_only or p.featured=true) order by p.created_at desc limit greatest(1,least(coalesce(p_limit,24),100))
$$;
create function public.get_public_property_by_slug(p_organization_slug text,p_property_slug text)
returns table(id uuid,code text,title text,slug text,purpose text,property_type text,description text,sale_price numeric,rent_price numeric,condominium_fee numeric,iptu_value numeric,city_id uuid,neighborhood_id uuid,public_location_text text,total_area numeric,built_area numeric,bedrooms integer,suites integer,bathrooms integer,parking_spaces integer,furnished boolean,financing_allowed boolean,exchange_allowed boolean,featured boolean,published_at timestamptz,created_at timestamptz,tag text)
language sql stable security definer set search_path='public' as $$
 select p.id,p.code,p.title,p.slug,p.purpose,p.property_type,p.description,p.sale_price,p.rent_price,p.condominium_fee,p.iptu_value,p.city_id,p.neighborhood_id,p.public_location_text,p.total_area,p.built_area,p.bedrooms,p.suites,p.bathrooms,p.parking_spaces,p.furnished,p.financing_allowed,p.exchange_allowed,p.featured,p.published_at,p.created_at,p.tag
 from public.properties p join public.organizations o on o.id=p.organization_id
 where o.slug=lower(trim(p_organization_slug)) and o.status in ('trial','active') and p.slug=p_property_slug and p.status='published' and p.deleted_at is null limit 1
$$;
revoke all on function public.get_public_properties(text,text,boolean,integer) from public;
revoke all on function public.get_public_property_by_slug(text,text) from public;
grant execute on function public.get_public_properties(text,text,boolean,integer) to anon,authenticated;
grant execute on function public.get_public_property_by_slug(text,text) to anon,authenticated;
drop policy if exists public_read_published_properties on public.properties;
revoke select on table public.properties from anon;