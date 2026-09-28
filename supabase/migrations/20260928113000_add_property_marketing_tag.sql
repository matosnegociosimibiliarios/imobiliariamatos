-- Imobiliária Matos premium UI/CRM support
-- Adds a controlled public marketing tag to properties and optimizes showcase queries.
alter table public.properties add column if not exists tag text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_tag_allowed'
      and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_tag_allowed
      check (tag is null or tag in ('Lançamento','Exclusivo','Pronto para Morar'));
  end if;
end $$;

create index if not exists properties_public_showcase_idx
  on public.properties (organization_id, status, featured, created_at desc)
  where deleted_at is null;

comment on column public.properties.tag is
  'Etiqueta comercial pública do imóvel: Lançamento, Exclusivo ou Pronto para Morar.';
