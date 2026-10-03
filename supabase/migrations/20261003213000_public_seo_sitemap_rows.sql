create or replace function public.get_public_seo_sitemap_rows()
returns table(
  organization_slug text,
  website_url text,
  property_slug text,
  purpose text,
  property_type text,
  city_slug text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    o.slug as organization_slug,
    s.website_url,
    p.slug as property_slug,
    p.purpose,
    p.property_type,
    c.slug as city_slug,
    greatest(coalesce(p.updated_at,p.created_at),coalesce(s.updated_at,o.updated_at,o.created_at)) as updated_at
  from public.organizations o
  left join public.agency_public_settings s on s.organization_id=o.id
  left join public.properties p
    on p.organization_id=o.id
    and p.status='published'
    and p.deleted_at is null
  left join public.cities c on c.id=p.city_id
  where o.status in ('trial','active')
    and public.organization_public_website_allowed(o.id);
$$;

revoke all on function public.get_public_seo_sitemap_rows() from public;
grant execute on function public.get_public_seo_sitemap_rows() to anon, authenticated;
