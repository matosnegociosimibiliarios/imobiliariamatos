alter table public.properties
  add column if not exists street_name text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists postal_code text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

alter table public.properties
  drop constraint if exists properties_latitude_check;

alter table public.properties
  add constraint properties_latitude_check
  check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table public.properties
  drop constraint if exists properties_longitude_check;

alter table public.properties
  add constraint properties_longitude_check
  check (longitude is null or (longitude >= -180 and longitude <= 180));

comment on column public.properties.street_name is 'Logradouro interno do imóvel para localização precisa no CRM.';
comment on column public.properties.address_number is 'Número do imóvel para localização precisa no CRM.';
comment on column public.properties.address_complement is 'Complemento do endereço do imóvel.';
comment on column public.properties.postal_code is 'CEP do imóvel.';
comment on column public.properties.latitude is 'Latitude geográfica do imóvel.';
comment on column public.properties.longitude is 'Longitude geográfica do imóvel.';
