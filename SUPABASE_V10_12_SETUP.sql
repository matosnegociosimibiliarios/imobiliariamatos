-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.12 - PERFIL DO CLIENTE E MATCH DE IMÓVEIS
-- =========================================================

-- 1. PERFIL DO QUE O CLIENTE PROCURA
create table if not exists public.lead_preferences (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  purpose text not null default 'sale'
    check (purpose in ('sale','rent','either')),
  min_price numeric(14,2),
  max_price numeric(14,2),
  property_types text[] not null default '{}',
  preferred_cities text[] not null default '{}',
  preferred_neighborhoods text[] not null default '{}',
  min_bedrooms integer,
  min_bathrooms integer,
  min_parking_spaces integer,
  min_total_area numeric(12,2),
  min_built_area numeric(12,2),
  financing_needed boolean not null default false,
  urgency text not null default 'research'
    check (urgency in ('now','30_days','90_days','research')),
  must_haves text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_preferences_prices_nonnegative check (
    (min_price is null or min_price >= 0)
    and (max_price is null or max_price >= 0)
  ),
  constraint lead_preferences_price_order check (
    min_price is null or max_price is null or min_price <= max_price
  ),
  constraint lead_preferences_counts_nonnegative check (
    (min_bedrooms is null or min_bedrooms >= 0)
    and (min_bathrooms is null or min_bathrooms >= 0)
    and (min_parking_spaces is null or min_parking_spaces >= 0)
  ),
  constraint lead_preferences_areas_nonnegative check (
    (min_total_area is null or min_total_area >= 0)
    and (min_built_area is null or min_built_area >= 0)
  )
);

create index if not exists lead_preferences_updated_idx
on public.lead_preferences(updated_at desc);

alter table public.lead_preferences enable row level security;

drop trigger if exists lead_preferences_touch_updated_at on public.lead_preferences;
create trigger lead_preferences_touch_updated_at
before update on public.lead_preferences
for each row execute function public.touch_updated_at();

-- 2. RETORNO DO CLIENTE SOBRE IMÓVEIS SUGERIDOS
create table if not exists public.lead_property_matches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  status text not null default 'suggested'
    check (status in ('suggested','interested','visit','discarded')),
  score integer check (score is null or (score >= 0 and score <= 100)),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, property_id)
);

create index if not exists lead_property_matches_lead_idx
on public.lead_property_matches(lead_id, status, updated_at desc);

create index if not exists lead_property_matches_property_idx
on public.lead_property_matches(property_id, status, updated_at desc);

alter table public.lead_property_matches enable row level security;

drop trigger if exists lead_property_matches_touch_updated_at on public.lead_property_matches;
create trigger lead_property_matches_touch_updated_at
before update on public.lead_property_matches
for each row execute function public.touch_updated_at();

-- 3. POLÍTICAS ADMINISTRATIVAS
-- O CRM continua operando com o mesmo perfil administrativo das versões anteriores.
drop policy if exists "admin_manage_lead_preferences" on public.lead_preferences;
create policy "admin_manage_lead_preferences"
on public.lead_preferences
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_manage_lead_property_matches" on public.lead_property_matches;
create policy "admin_manage_lead_property_matches"
on public.lead_property_matches
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete
on public.lead_preferences, public.lead_property_matches
to authenticated;

-- =========================================================
-- FIM DA VERSÃO 10.12
-- =========================================================
