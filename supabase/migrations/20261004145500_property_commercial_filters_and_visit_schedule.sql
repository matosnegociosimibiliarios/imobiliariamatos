alter table public.properties
  add column if not exists discount_percent numeric,
  add column if not exists visit_schedule jsonb not null default '[]'::jsonb;

alter table public.properties
  drop constraint if exists properties_discount_percent_check;

alter table public.properties
  add constraint properties_discount_percent_check
  check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

comment on column public.properties.discount_percent is 'Percentual máximo de desconto comercial informado para negociação do imóvel.';
comment on column public.properties.visit_schedule is 'Janelas recorrentes disponíveis para visita, em JSON: dia da semana, hora inicial e final.';
