create table if not exists public.saas_billing_products (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'kiwify',
  provider_product_id text not null,
  plan_code text not null references public.saas_plans(code),
  product_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_product_id)
);
alter table public.saas_billing_products enable row level security;
revoke all on public.saas_billing_products from public, anon, authenticated;

create table if not exists public.saas_billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null,
  order_id text,
  event_type text not null,
  provider_product_id text,
  provider_subscription_id text,
  organization_id uuid references public.organizations(id) on delete set null,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now(),
  unique(provider, event_key)
);
alter table public.saas_billing_webhook_events enable row level security;
revoke all on public.saas_billing_webhook_events from public, anon, authenticated;

create table if not exists public.saas_billing_provider_config (
  provider text primary key,
  webhook_token text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.saas_billing_provider_config enable row level security;
revoke all on public.saas_billing_provider_config from public, anon, authenticated;
insert into public.saas_billing_provider_config(provider,is_active) values ('kiwify',false)
on conflict(provider) do nothing;
