create table if not exists public.saas_plans (
 code text primary key, name text not null, description text, monthly_price numeric(12,2) not null default 0, annual_price numeric(12,2),
 limits jsonb not null default '{}'::jsonb, features jsonb not null default '{}'::jsonb, is_public boolean not null default false,
 is_active boolean not null default true, sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.saas_plans enable row level security;
create policy saas_plans_authenticated_read on public.saas_plans for select to authenticated using (is_active = true or public.current_team_role() = 'owner');
create table if not exists public.saas_subscriptions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 plan_code text not null references public.saas_plans(code), status text not null default 'trialing' check (status in ('trialing','active','past_due','cancelled','blocked')),
 billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','annual','internal')), trial_ends_at timestamptz,
 current_period_start timestamptz, current_period_end timestamptz, cancel_at_period_end boolean not null default false,
 provider text, provider_customer_id text, provider_subscription_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id)
);
create index if not exists saas_subscriptions_status_idx on public.saas_subscriptions(status);
alter table public.saas_subscriptions enable row level security;
create policy saas_subscriptions_org_read on public.saas_subscriptions for select to authenticated using (organization_id = public.current_organization_id());
insert into public.saas_plans(code,name,description,monthly_price,annual_price,limits,features,is_public,is_active,sort_order) values
('internal','Interno','Plano reservado para a operação proprietária do CRM.',0,null,'{"users":-1,"properties":-1,"storage_mb":-1}'::jsonb,'{"all":true}'::jsonb,false,true,0),
('starter','Essencial','Estrutura para imobiliárias menores.',0,null,'{"users":2,"properties":100,"storage_mb":1024}'::jsonb,'{"commercial":true,"agenda":true,"documents":true,"rentals":false,"finance":false,"management":true}'::jsonb,false,true,10),
('professional','Profissional','Operação comercial e de locação completa.',0,null,'{"users":8,"properties":500,"storage_mb":5120}'::jsonb,'{"commercial":true,"agenda":true,"documents":true,"rentals":true,"finance":true,"management":true,"integrations":true}'::jsonb,false,true,20),
('business','Empresarial','Estrutura ampliada para equipes maiores.',0,null,'{"users":-1,"properties":-1,"storage_mb":20480}'::jsonb,'{"all":true}'::jsonb,false,true,30) on conflict (code) do nothing;
insert into public.saas_subscriptions(organization_id,plan_code,status,billing_cycle,current_period_start)
select o.id,'internal','active','internal',now() from public.organizations o where o.plan_code='internal' on conflict (organization_id) do nothing;
create or replace function public.current_saas_entitlement() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('organization_id',o.id,'organization_status',o.status,'plan_code',coalesce(s.plan_code,o.plan_code),
 'subscription_status',coalesce(s.status,case when o.status='active' then 'active' else 'blocked' end),'trial_ends_at',coalesce(s.trial_ends_at,o.trial_ends_at),
 'current_period_end',s.current_period_end,'limits',coalesce(p.limits,'{}'::jsonb),'features',coalesce(p.features,'{}'::jsonb))
 from public.organizations o left join public.saas_subscriptions s on s.organization_id=o.id
 left join public.saas_plans p on p.code=coalesce(s.plan_code,o.plan_code) where o.id=public.current_organization_id() limit 1 $$;
revoke all on function public.current_saas_entitlement() from public, anon;
grant execute on function public.current_saas_entitlement() to authenticated;