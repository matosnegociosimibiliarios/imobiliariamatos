alter table public.agency_public_settings
  add column if not exists service_area text;

drop function if exists public.update_agency_public_settings(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
);

create or replace function public.update_agency_public_settings(
  p_agency_name text default null,
  p_legal_name text default null,
  p_trade_name text default null,
  p_creci text default null,
  p_cnpj text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_public_email text default null,
  p_public_address text default null,
  p_website_url text default null,
  p_instagram text default null,
  p_facebook text default null,
  p_tiktok text default null,
  p_youtube text default null,
  p_logo_url text default null,
  p_favicon_url text default null,
  p_cover_image_url text default null,
  p_slogan text default null,
  p_primary_color text default null,
  p_secondary_color text default null,
  p_service_area text default null
)
returns public.agency_public_settings
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid := public.current_organization_id();
  v_row public.agency_public_settings%rowtype;
begin
  if v_org is null then
    raise exception 'Active organization is required';
  end if;

  if not public.has_permission('integrations.manage') then
    raise exception 'Permission denied';
  end if;

  insert into public.agency_public_settings (organization_id)
  values (v_org)
  on conflict (organization_id) do nothing;

  update public.agency_public_settings
  set agency_name = nullif(trim(p_agency_name), ''),
      legal_name = nullif(trim(p_legal_name), ''),
      trade_name = nullif(trim(p_trade_name), ''),
      creci = nullif(trim(p_creci), ''),
      cnpj = nullif(trim(p_cnpj), ''),
      phone = nullif(trim(p_phone), ''),
      whatsapp = nullif(trim(p_whatsapp), ''),
      public_email = nullif(trim(p_public_email), ''),
      public_address = nullif(trim(p_public_address), ''),
      website_url = nullif(trim(p_website_url), ''),
      instagram = nullif(trim(p_instagram), ''),
      facebook = nullif(trim(p_facebook), ''),
      tiktok = nullif(trim(p_tiktok), ''),
      youtube = nullif(trim(p_youtube), ''),
      logo_url = nullif(trim(p_logo_url), ''),
      favicon_url = nullif(trim(p_favicon_url), ''),
      cover_image_url = nullif(trim(p_cover_image_url), ''),
      slogan = nullif(trim(p_slogan), ''),
      primary_color = nullif(trim(p_primary_color), ''),
      secondary_color = nullif(trim(p_secondary_color), ''),
      service_area = nullif(trim(p_service_area), ''),
      updated_at = now()
  where organization_id = v_org
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_agency_public_settings(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.update_agency_public_settings(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
