alter table public.properties
  add column if not exists construction_standard text,
  add column if not exists conservation_status text,
  add column if not exists construction_year integer;

alter table public.properties
  drop constraint if exists properties_construction_standard_check;
alter table public.properties
  add constraint properties_construction_standard_check
  check (construction_standard is null or construction_standard in ('economico','medio','alto','luxo'));

alter table public.properties
  drop constraint if exists properties_conservation_status_check;
alter table public.properties
  add constraint properties_conservation_status_check
  check (conservation_status is null or conservation_status in ('precisa_reforma','regular','bom','novo'));

alter table public.properties
  drop constraint if exists properties_construction_year_check;
alter table public.properties
  add constraint properties_construction_year_check
  check (construction_year is null or construction_year between 1800 and 2200);

comment on column public.properties.construction_standard is 'Padrão construtivo padronizado para comparação e avaliação.';
comment on column public.properties.conservation_status is 'Estado de conservação padronizado para comparação e avaliação.';
comment on column public.properties.construction_year is 'Ano aproximado da construção para apoio à análise de idade/depreciação.';
