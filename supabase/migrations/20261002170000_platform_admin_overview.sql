-- Platform owner dashboard: private registry + authenticated admin-only overview.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from public, anon, authenticated;
grant select on table public.platform_admins to service_role;

insert into public.platform_admins(user_id)
select om.user_id from public.organization_members om
join public.organizations o on o.id=om.organization_id
where o.slug='matos-negocios-imobiliarios' and om.role='owner' and om.status='active'
on conflict (user_id) do nothing;

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public,auth as $$
select exists(select 1 from public.platform_admins where user_id=auth.uid()); $$;

create or replace function public.platform_admin_overview() returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
if not public.is_platform_admin() then raise exception 'Acesso restrito ao administrador da plataforma'; end if;
return jsonb_build_object(
'summary',jsonb_build_object('organizations',(select count(*) from public.organizations),'active',(select count(*) from public.organizations where status='active'),'trial',(select count(*) from public.organizations where status='trial'),'paid_subscriptions',(select count(*) from public.saas_subscriptions where status in ('active','past_due') and provider is not null)),
'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'status',o.status,'plan_code',o.plan_code,'trial_ends_at',o.trial_ends_at,'created_at',o.created_at,'subscription_status',s.status,'current_period_end',s.current_period_end,'provider',s.provider,'users',(select count(*) from public.organization_members m where m.organization_id=o.id and m.status='active'),'properties',(select count(*) from public.properties p where p.organization_id=o.id and p.deleted_at is null)) order by o.created_at desc) from public.organizations o left join lateral(select ss.status,ss.current_period_end,ss.provider from public.saas_subscriptions ss where ss.organization_id=o.id order by ss.created_at desc limit 1)s on true),'[]'::jsonb));
end; $$;
revoke all on function public.is_platform_admin() from public,anon;
revoke all on function public.platform_admin_overview() from public,anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.platform_admin_overview() to authenticated;