alter table public.properties
  add column if not exists region_name text,
  add column if not exists subregion_name text;

comment on column public.properties.region_name is 'Região comercial/geográfica usada para organizar e filtrar imóveis no CRM.';
comment on column public.properties.subregion_name is 'Sub-região comercial/geográfica usada para organizar e filtrar imóveis no CRM.';
