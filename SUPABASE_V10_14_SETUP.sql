-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.14 - EQUIPE, USUÁRIOS E PERMISSÕES
-- Base preparada para futura evolução SaaS / multiempresa.
-- =========================================================

create extension if not exists pgcrypto;

-- 1. ORGANIZAÇÕES (CAMADA BASE PARA FUTURO SAAS)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('trial','active','suspended','cancelled')),
  plan_code text not null default 'internal',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizations (name, slug, status, plan_code)
values ('Matos Negócios Imobiliários', 'matos-negocios-imobiliarios', 'active', 'internal')
on conflict (slug) do update
set name = excluded.name,
    updated_at = now();

-- 2. PERFIL GLOBAL DO USUÁRIO
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists last_seen_at timestamptz;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

-- Mantém o perfil sincronizado para novos usuários.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'user'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = case
        when coalesce(public.profiles.full_name, '') = '' then excluded.full_name
        else public.profiles.full_name
      end,
      updated_at = now();

  return new;
end;
$$;

-- 3. MEMBROS DA ORGANIZAÇÃO
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'assistant'
    check (role in ('owner','admin','broker','assistant')),
  status text not null default 'active'
    check (status in ('invited','active','disabled')),
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- O administrador atual vira proprietário da organização inicial.
insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  joined_at
)
select
  o.id,
  p.id,
  'owner',
  'active',
  now()
from public.profiles p
cross join public.organizations o
where p.role = 'admin'
  and o.slug = 'matos-negocios-imobiliarios'
on conflict (organization_id, user_id) do update
set role = case
      when public.organization_members.role = 'owner' then 'owner'
      else excluded.role
    end,
    status = 'active',
    joined_at = coalesce(public.organization_members.joined_at, now()),
    updated_at = now();

-- 4. PERMISSÕES PADRÃO POR FUNÇÃO
create or replace function public.role_permissions_json(p_role text)
returns jsonb
language sql
immutable
as $$
  select case p_role
    when 'owner' then jsonb_build_object(
      'dashboard.view', true,
      'management.view', true,
      'management.manage', true,
      'reports.view', true,
      'analytics.view', true,
      'properties.view', true,
      'properties.manage', true,
      'leads.view', true,
      'leads.manage', true,
      'appointments.view', true,
      'appointments.manage', true,
      'captures.view', true,
      'captures.manage', true,
      'proposals.view', true,
      'proposals.manage', true,
      'deals.view', true,
      'deals.manage', true,
      'financial.view', true,
      'documents.view', true,
      'documents.manage', true,
      'messages.view', true,
      'messages.respond', true,
      'integrations.manage', true,
      'health.view', true,
      'team.view', true,
      'team.manage', true,
      'settings.manage', true
    )
    when 'admin' then jsonb_build_object(
      'dashboard.view', true,
      'management.view', true,
      'management.manage', true,
      'reports.view', true,
      'analytics.view', true,
      'properties.view', true,
      'properties.manage', true,
      'leads.view', true,
      'leads.manage', true,
      'appointments.view', true,
      'appointments.manage', true,
      'captures.view', true,
      'captures.manage', true,
      'proposals.view', true,
      'proposals.manage', true,
      'deals.view', true,
      'deals.manage', true,
      'financial.view', true,
      'documents.view', true,
      'documents.manage', true,
      'messages.view', true,
      'messages.respond', true,
      'integrations.manage', true,
      'health.view', true,
      'team.view', true,
      'team.manage', true,
      'settings.manage', true
    )
    when 'broker' then jsonb_build_object(
      'dashboard.view', true,
      'management.view', true,
      'management.manage', false,
      'reports.view', true,
      'analytics.view', true,
      'properties.view', true,
      'properties.manage', true,
      'leads.view', true,
      'leads.manage', true,
      'appointments.view', true,
      'appointments.manage', true,
      'captures.view', true,
      'captures.manage', true,
      'proposals.view', true,
      'proposals.manage', true,
      'deals.view', true,
      'deals.manage', true,
      'financial.view', false,
      'documents.view', true,
      'documents.manage', true,
      'messages.view', true,
      'messages.respond', true,
      'integrations.manage', false,
      'health.view', false,
      'team.view', true,
      'team.manage', false,
      'settings.manage', false
    )
    else jsonb_build_object(
      'dashboard.view', true,
      'management.view', false,
      'management.manage', false,
      'reports.view', false,
      'analytics.view', false,
      'properties.view', true,
      'properties.manage', false,
      'leads.view', true,
      'leads.manage', true,
      'appointments.view', true,
      'appointments.manage', true,
      'captures.view', true,
      'captures.manage', true,
      'proposals.view', true,
      'proposals.manage', false,
      'deals.view', false,
      'deals.manage', false,
      'financial.view', false,
      'documents.view', true,
      'documents.manage', true,
      'messages.view', true,
      'messages.respond', true,
      'integrations.manage', false,
      'health.view', false,
      'team.view', true,
      'team.manage', false,
      'settings.manage', false
    )
  end;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.organization_id
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1;
$$;

create or replace function public.current_team_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1;
$$;

create or replace function public.effective_permissions_json()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.role_permissions_json(m.role), '{}'::jsonb) || coalesce(m.permissions, '{}'::jsonb)
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1;
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.effective_permissions_json()->>p_permission)::boolean, false)
      or public.is_admin();
$$;

create or replace function public.can_access_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or exists (
        select 1
        from public.organization_members m
        where m.user_id = auth.uid()
          and m.status = 'active'
      );
$$;

grant execute on function public.role_permissions_json(text) to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_team_role() to authenticated;
grant execute on function public.effective_permissions_json() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.can_access_admin() to authenticated;

-- Contexto único usado pelo front-end para montar menus e proteger rotas.
create or replace function public.current_access_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'organization_id', m.organization_id,
    'organization_name', o.name,
    'organization_slug', o.slug,
    'plan_code', o.plan_code,
    'user_id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'role', m.role,
    'status', m.status,
    'permissions', public.role_permissions_json(m.role) || coalesce(m.permissions, '{}'::jsonb)
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1;
$$;

grant execute on function public.current_access_context() to authenticated;

-- 5. PROTEÇÃO CONTRA REMOVER O ÚLTIMO PROPRIETÁRIO
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_owners integer;
  actor_role text;
begin
  actor_role := public.current_team_role();

  if auth.uid() is not null and actor_role = 'admin' then
    if old.role = 'owner' or (tg_op <> 'DELETE' and new.role = 'owner') then
      raise exception 'Somente um proprietário pode alterar outro proprietário.';
    end if;
  end if;

  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    select count(*) into remaining_owners
    from public.organization_members m
    where m.organization_id = old.organization_id
      and m.role = 'owner'
      and m.status = 'active'
      and m.id <> old.id;

    if remaining_owners = 0 then
      raise exception 'A organização precisa manter pelo menos um proprietário ativo.';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_last_owner on public.organization_members;
create trigger trg_protect_last_owner
before update or delete on public.organization_members
for each row execute function public.protect_last_owner();

-- 6. RESPONSÁVEL PELOS PRINCIPAIS REGISTROS
alter table public.leads add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.leads add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.leads add column if not exists assigned_at timestamptz;

alter table public.properties add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.properties add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.properties add column if not exists assigned_at timestamptz;

alter table public.appointments add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.appointments add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.appointments add column if not exists assigned_at timestamptz;

alter table public.owner_captures add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.owner_captures add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.owner_captures add column if not exists assigned_at timestamptz;

alter table public.proposals add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.proposals add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.proposals add column if not exists assigned_at timestamptz;

alter table public.deals add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.deals add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.deals add column if not exists assigned_at timestamptz;

create or replace function public.stamp_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is null and auth.uid() is not null then
      new.assigned_to := auth.uid();
    end if;
    if new.assigned_to is not null then
      new.assigned_by := coalesce(auth.uid(), new.assigned_by);
      new.assigned_at := coalesce(new.assigned_at, now());
    end if;
  elsif new.assigned_to is distinct from old.assigned_to then
    new.assigned_by := auth.uid();
    new.assigned_at := case when new.assigned_to is null then null else now() end;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['leads','properties','appointments','owner_captures','proposals','deals'] loop
    execute format('drop trigger if exists trg_%I_assignment on public.%I', t, t);
    execute format('create trigger trg_%I_assignment before insert or update on public.%I for each row execute function public.stamp_assignment()', t, t);
  end loop;
end $$;

-- 7. LOG DE ATIVIDADES: QUEM ALTEROU O QUÊ E QUANDO
create table if not exists public.team_activity_log (
  id bigint generated by default as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_activity_log_org_created_idx
  on public.team_activity_log (organization_id, created_at desc);

create or replace function public.log_team_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_json jsonb;
  old_json jsonb;
  changed jsonb := '[]'::jsonb;
  rid text;
  org_id uuid;
begin
  if tg_op = 'INSERT' then
    new_json := to_jsonb(new);
    rid := new_json->>'id';
  elsif tg_op = 'UPDATE' then
    new_json := to_jsonb(new);
    old_json := to_jsonb(old);
    rid := new_json->>'id';

    select coalesce(jsonb_agg(k.key order by k.key), '[]'::jsonb)
      into changed
    from jsonb_object_keys(new_json) as k(key)
    where (new_json -> k.key) is distinct from (old_json -> k.key)
      and k.key not in ('updated_at');
  else
    old_json := to_jsonb(old);
    rid := old_json->>'id';
  end if;

  org_id := public.current_organization_id();
  if org_id is null then
    select id into org_id
    from public.organizations
    where slug = 'matos-negocios-imobiliarios'
    limit 1;
  end if;

  insert into public.team_activity_log (
    organization_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    changed_fields
  ) values (
    org_id,
    auth.uid(),
    tg_table_name,
    rid,
    tg_op,
    changed
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['leads','properties','appointments','owner_captures','proposals','deals','crm_documents'] loop
    execute format('drop trigger if exists trg_%I_activity_log on public.%I', t, t);
    execute format('create trigger trg_%I_activity_log after insert or update or delete on public.%I for each row execute function public.log_team_activity()', t, t);
  end loop;
end $$;

-- 8. RLS DAS NOVAS TABELAS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.team_activity_log enable row level security;

drop policy if exists "members_read_own_organization" on public.organizations;
create policy "members_read_own_organization"
on public.organizations for select to authenticated
using (id = public.current_organization_id());

drop policy if exists "owners_manage_organization" on public.organizations;
create policy "owners_manage_organization"
on public.organizations for update to authenticated
using (id = public.current_organization_id() and public.current_team_role() = 'owner')
with check (id = public.current_organization_id() and public.current_team_role() = 'owner');

drop policy if exists "team_read_members" on public.organization_members;
create policy "team_read_members"
on public.organization_members for select to authenticated
using (organization_id = public.current_organization_id());

drop policy if exists "team_manage_members" on public.organization_members;
create policy "team_manage_members"
on public.organization_members for all to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('team.manage'))
with check (organization_id = public.current_organization_id() and public.has_permission('team.manage'));

drop policy if exists "team_read_activity" on public.team_activity_log;
create policy "team_read_activity"
on public.team_activity_log for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('team.view'));

-- Membros do mesmo time podem aparecer nos seletores de responsável.
drop policy if exists "team_read_profiles" on public.profiles;
create policy "team_read_profiles"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members other
      on other.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and other.user_id = profiles.id
  )
);

-- 9. RLS POR PERMISSÃO PARA O CRM ATUAL (AINDA UMA ÚNICA EMPRESA)
-- Propriedades e cadastros auxiliares
drop policy if exists "team_read_properties" on public.properties;
create policy "team_read_properties" on public.properties for select to authenticated
using (public.has_permission('properties.view'));
drop policy if exists "team_manage_properties" on public.properties;
create policy "team_manage_properties" on public.properties for all to authenticated
using (public.has_permission('properties.manage'))
with check (public.has_permission('properties.manage'));

drop policy if exists "team_manage_cities" on public.cities;
create policy "team_manage_cities" on public.cities for all to authenticated
using (public.has_permission('properties.manage'))
with check (public.has_permission('properties.manage'));
drop policy if exists "team_manage_neighborhoods" on public.neighborhoods;
create policy "team_manage_neighborhoods" on public.neighborhoods for all to authenticated
using (public.has_permission('properties.manage'))
with check (public.has_permission('properties.manage'));
drop policy if exists "team_manage_features" on public.features;
create policy "team_manage_features" on public.features for all to authenticated
using (public.has_permission('properties.manage'))
with check (public.has_permission('properties.manage'));
drop policy if exists "team_manage_property_features" on public.property_features;
create policy "team_manage_property_features" on public.property_features for all to authenticated
using (public.has_permission('properties.manage'))
with check (public.has_permission('properties.manage'));
drop policy if exists "team_manage_property_images" on public.property_images;
create policy "team_manage_property_images" on public.property_images for all to authenticated
using (public.has_permission('properties.manage'))
with check (public.has_permission('properties.manage'));

-- Leads e agenda
drop policy if exists "team_read_leads" on public.leads;
create policy "team_read_leads" on public.leads for select to authenticated
using (public.has_permission('leads.view'));
drop policy if exists "team_manage_leads" on public.leads;
create policy "team_manage_leads" on public.leads for all to authenticated
using (public.has_permission('leads.manage'))
with check (public.has_permission('leads.manage'));

drop policy if exists "team_manage_lead_notes" on public.lead_notes;
create policy "team_manage_lead_notes" on public.lead_notes for all to authenticated
using (public.has_permission('leads.manage'))
with check (public.has_permission('leads.manage'));
drop policy if exists "team_read_lead_status_history" on public.lead_status_history;
create policy "team_read_lead_status_history" on public.lead_status_history for select to authenticated
using (public.has_permission('leads.view'));
drop policy if exists "team_read_lead_source_history" on public.lead_source_history;
create policy "team_read_lead_source_history" on public.lead_source_history for select to authenticated
using (public.has_permission('leads.view'));
drop policy if exists "team_manage_lead_preferences" on public.lead_preferences;
create policy "team_manage_lead_preferences" on public.lead_preferences for all to authenticated
using (public.has_permission('leads.manage'))
with check (public.has_permission('leads.manage'));
drop policy if exists "team_manage_lead_property_matches" on public.lead_property_matches;
create policy "team_manage_lead_property_matches" on public.lead_property_matches for all to authenticated
using (public.has_permission('leads.manage'))
with check (public.has_permission('leads.manage'));

drop policy if exists "team_read_appointments" on public.appointments;
create policy "team_read_appointments" on public.appointments for select to authenticated
using (public.has_permission('appointments.view'));
drop policy if exists "team_manage_appointments" on public.appointments;
create policy "team_manage_appointments" on public.appointments for all to authenticated
using (public.has_permission('appointments.manage'))
with check (public.has_permission('appointments.manage'));

-- Captações
drop policy if exists "team_read_owner_captures" on public.owner_captures;
create policy "team_read_owner_captures" on public.owner_captures for select to authenticated
using (public.has_permission('captures.view'));
drop policy if exists "team_manage_owner_captures" on public.owner_captures;
create policy "team_manage_owner_captures" on public.owner_captures for all to authenticated
using (public.has_permission('captures.manage'))
with check (public.has_permission('captures.manage'));
drop policy if exists "team_manage_capture_notes" on public.capture_notes;
create policy "team_manage_capture_notes" on public.capture_notes for all to authenticated
using (public.has_permission('captures.manage'))
with check (public.has_permission('captures.manage'));
drop policy if exists "team_manage_capture_documents" on public.capture_documents;
create policy "team_manage_capture_documents" on public.capture_documents for all to authenticated
using (public.has_permission('captures.manage'))
with check (public.has_permission('captures.manage'));
drop policy if exists "team_read_capture_status_history" on public.capture_status_history;
create policy "team_read_capture_status_history" on public.capture_status_history for select to authenticated
using (public.has_permission('captures.view'));

-- Propostas
drop policy if exists "team_read_proposals" on public.proposals;
create policy "team_read_proposals" on public.proposals for select to authenticated
using (public.has_permission('proposals.view'));
drop policy if exists "team_manage_proposals" on public.proposals;
create policy "team_manage_proposals" on public.proposals for all to authenticated
using (public.has_permission('proposals.manage'))
with check (public.has_permission('proposals.manage'));
drop policy if exists "team_read_proposal_history" on public.proposal_status_history;
create policy "team_read_proposal_history" on public.proposal_status_history for select to authenticated
using (public.has_permission('proposals.view'));

-- Negócios fechados
drop policy if exists "team_read_deals" on public.deals;
create policy "team_read_deals" on public.deals for select to authenticated
using (public.has_permission('deals.view'));
drop policy if exists "team_manage_deals" on public.deals;
create policy "team_manage_deals" on public.deals for all to authenticated
using (public.has_permission('deals.manage'))
with check (public.has_permission('deals.manage'));
drop policy if exists "team_manage_deal_documents" on public.deal_documents;
create policy "team_manage_deal_documents" on public.deal_documents for all to authenticated
using (public.has_permission('deals.manage'))
with check (public.has_permission('deals.manage'));
drop policy if exists "team_read_deal_history" on public.deal_status_history;
create policy "team_read_deal_history" on public.deal_status_history for select to authenticated
using (public.has_permission('deals.view'));

-- Gestão dos imóveis
drop policy if exists "team_read_property_management" on public.property_management;
create policy "team_read_property_management" on public.property_management for select to authenticated
using (public.has_permission('properties.view'));
drop policy if exists "team_manage_property_management" on public.property_management;
create policy "team_manage_property_management" on public.property_management for all to authenticated
using (public.has_permission('properties.manage'))
with check (public.has_permission('properties.manage'));
drop policy if exists "team_manage_property_documents" on public.property_documents;
create policy "team_manage_property_documents" on public.property_documents for all to authenticated
using (public.has_permission('properties.manage'))
with check (public.has_permission('properties.manage'));
drop policy if exists "team_read_property_price_history" on public.property_price_history;
create policy "team_read_property_price_history" on public.property_price_history for select to authenticated
using (public.has_permission('properties.view'));
drop policy if exists "team_read_property_status_history" on public.property_status_history;
create policy "team_read_property_status_history" on public.property_status_history for select to authenticated
using (public.has_permission('properties.view'));

-- Central de documentos
drop policy if exists "team_read_crm_documents" on public.crm_documents;
create policy "team_read_crm_documents" on public.crm_documents for select to authenticated
using (public.has_permission('documents.view'));
drop policy if exists "team_manage_crm_documents" on public.crm_documents;
create policy "team_manage_crm_documents" on public.crm_documents for all to authenticated
using (public.has_permission('documents.manage'))
with check (public.has_permission('documents.manage'));

-- Mensagens e integrações
drop policy if exists "team_read_social_messages" on public.social_messages;
create policy "team_read_social_messages" on public.social_messages for select to authenticated
using (public.has_permission('messages.view'));
drop policy if exists "team_manage_social_messages" on public.social_messages;
create policy "team_manage_social_messages" on public.social_messages for all to authenticated
using (public.has_permission('messages.respond'))
with check (public.has_permission('messages.respond'));

drop policy if exists "team_manage_response_templates" on public.response_templates;
create policy "team_manage_response_templates" on public.response_templates for all to authenticated
using (public.has_permission('messages.respond'))
with check (public.has_permission('messages.respond'));

drop policy if exists "team_read_integration_events" on public.integration_events;
create policy "team_read_integration_events" on public.integration_events for select to authenticated
using (public.has_permission('health.view') or public.has_permission('integrations.manage'));

-- Indicadores, metas e rastreamento
drop policy if exists "team_read_site_visits" on public.site_visits;
create policy "team_read_site_visits" on public.site_visits for select to authenticated
using (public.has_permission('analytics.view'));
drop policy if exists "team_read_site_events" on public.site_events;
create policy "team_read_site_events" on public.site_events for select to authenticated
using (public.has_permission('analytics.view'));
drop policy if exists "team_read_crm_monthly_goals" on public.crm_monthly_goals;
create policy "team_read_crm_monthly_goals" on public.crm_monthly_goals for select to authenticated
using (public.has_permission('management.view'));
drop policy if exists "team_manage_crm_monthly_goals" on public.crm_monthly_goals;
create policy "team_manage_crm_monthly_goals" on public.crm_monthly_goals for all to authenticated
using (public.has_permission('management.manage'))
with check (public.has_permission('management.manage'));

-- Configuração pública da agência
drop policy if exists "team_manage_agency_settings" on public.agency_public_settings;
create policy "team_manage_agency_settings" on public.agency_public_settings for all to authenticated
using (public.has_permission('settings.manage'))
with check (public.has_permission('settings.manage'));

-- 10. STORAGE POR PERMISSÃO
drop policy if exists "team_upload_property_images" on storage.objects;
create policy "team_upload_property_images"
on storage.objects for insert to authenticated
with check (bucket_id = 'property-images' and public.has_permission('properties.manage'));
drop policy if exists "team_update_property_images_storage" on storage.objects;
create policy "team_update_property_images_storage"
on storage.objects for update to authenticated
using (bucket_id = 'property-images' and public.has_permission('properties.manage'))
with check (bucket_id = 'property-images' and public.has_permission('properties.manage'));
drop policy if exists "team_delete_property_images_storage" on storage.objects;
create policy "team_delete_property_images_storage"
on storage.objects for delete to authenticated
using (bucket_id = 'property-images' and public.has_permission('properties.manage'));

drop policy if exists "team_read_crm_documents_storage" on storage.objects;
create policy "team_read_crm_documents_storage"
on storage.objects for select to authenticated
using (bucket_id = 'crm-documents' and public.has_permission('documents.view'));
drop policy if exists "team_upload_crm_documents_storage" on storage.objects;
create policy "team_upload_crm_documents_storage"
on storage.objects for insert to authenticated
with check (bucket_id = 'crm-documents' and public.has_permission('documents.manage'));
drop policy if exists "team_update_crm_documents_storage" on storage.objects;
create policy "team_update_crm_documents_storage"
on storage.objects for update to authenticated
using (bucket_id = 'crm-documents' and public.has_permission('documents.manage'))
with check (bucket_id = 'crm-documents' and public.has_permission('documents.manage'));
drop policy if exists "team_delete_crm_documents_storage" on storage.objects;
create policy "team_delete_crm_documents_storage"
on storage.objects for delete to authenticated
using (bucket_id = 'crm-documents' and public.has_permission('documents.manage'));

-- 11. GRANTS

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select on public.team_activity_log to authenticated;

grant select, insert, update, delete on
  public.properties,
  public.property_images,
  public.cities,
  public.neighborhoods,
  public.features,
  public.property_features,
  public.agency_public_settings,
  public.leads,
  public.lead_notes,
  public.lead_status_history,
  public.lead_source_history,
  public.lead_preferences,
  public.lead_property_matches,
  public.appointments,
  public.owner_captures,
  public.capture_notes,
  public.capture_documents,
  public.capture_status_history,
  public.proposals,
  public.proposal_status_history,
  public.deals,
  public.deal_documents,
  public.deal_status_history,
  public.property_management,
  public.property_documents,
  public.property_price_history,
  public.property_status_history,
  public.crm_documents,
  public.response_templates,
  public.social_messages,
  public.crm_monthly_goals
  to authenticated;

grant select on public.site_visits, public.site_events, public.integration_events to authenticated;

-- =========================================================
-- IMPORTANTE SOBRE SAAS:
-- Esta versão cria organizações, membros e permissões e mantém a Matos
-- como a organização inicial. Os dados atuais do CRM ainda pertencem ao
-- ambiente único existente. A separação física de todos os registros por
-- organization_id será feita numa futura etapa de multiempresa antes da
-- comercialização pública.
-- =========================================================

-- 12. RPCs LEGADAS ADAPTADAS PARA AS NOVAS PERMISSÕES


-- admin_dashboard_metrics: dashboard.view
create or replace function public.admin_dashboard_metrics(days_back integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at timestamptz;

  visits_count bigint;
  unique_visitors_count bigint;
  leads_count bigint;
  appointments_count bigint;
  proposal_count bigint;
  won_count bigint;

  captures_count bigint;
  capture_new_count bigint;
  capture_authorized_count bigint;
  capture_published_count bigint;

  visitor_to_lead_rate numeric;
  lead_to_appointment_rate numeric;
  lead_to_won_rate numeric;

  won_value numeric;
  commission_value numeric;
begin
  if not public.has_permission('dashboard.view') then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*)
  into visits_count
  from public.site_visits
  where created_at >= start_at;

  select count(distinct session_id)
  into unique_visitors_count
  from public.site_visits
  where created_at >= start_at;

  select count(*)
  into leads_count
  from public.leads
  where created_at >= start_at;

  select count(*)
  into appointments_count
  from public.appointments
  where created_at >= start_at;

  select count(*)
  into proposal_count
  from public.leads
  where created_at >= start_at
    and status = 'proposal';

  select count(*)
  into won_count
  from public.leads
  where created_at >= start_at
    and status = 'won';

  select count(*)
  into captures_count
  from public.owner_captures
  where created_at >= start_at;

  select count(*)
  into capture_new_count
  from public.owner_captures
  where created_at >= start_at
    and status = 'new';

  select count(*)
  into capture_authorized_count
  from public.owner_captures
  where created_at >= start_at
    and status = 'authorized';

  select count(*)
  into capture_published_count
  from public.owner_captures
  where created_at >= start_at
    and status = 'published';

  select coalesce(sum(deal_value), 0)
  into won_value
  from public.leads
  where created_at >= start_at
    and status = 'won';

  select coalesce(sum(commission_value), 0)
  into commission_value
  from public.leads
  where created_at >= start_at
    and status = 'won';

  visitor_to_lead_rate :=
    case
      when unique_visitors_count = 0 then 0
      else round((leads_count::numeric / unique_visitors_count::numeric) * 100, 2)
    end;

  lead_to_appointment_rate :=
    case
      when leads_count = 0 then 0
      else round((appointments_count::numeric / leads_count::numeric) * 100, 2)
    end;

  lead_to_won_rate :=
    case
      when leads_count = 0 then 0
      else round((won_count::numeric / leads_count::numeric) * 100, 2)
    end;

  return jsonb_build_object(
    'visits', visits_count,
    'unique_visitors', unique_visitors_count,
    'leads', leads_count,
    'appointments', appointments_count,
    'proposals', proposal_count,
    'won', won_count,
    'visitor_to_lead_rate', visitor_to_lead_rate,
    'lead_to_appointment_rate', lead_to_appointment_rate,
    'lead_to_won_rate', lead_to_won_rate,
    'won_value', won_value,
    'commission_value', commission_value,
    'captures', captures_count,
    'capture_new', capture_new_count,
    'capture_authorized', capture_authorized_count,
    'capture_published', capture_published_count
  );
end;
$$;


-- admin_lead_sources: analytics.view
create or replace function public.admin_lead_sources(days_back integer default 30)
returns table (
  source text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(source), ''), 'site') as source,
    count(*)::bigint as total
  from public.leads
  where created_at >= now() - make_interval(days => greatest(days_back, 1))
    and public.has_permission('analytics.view')
  group by 1
  order by 2 desc;
$$;


-- admin_top_lead_properties: analytics.view
create or replace function public.admin_top_lead_properties(days_back integer default 30)
returns table (
  property_id uuid,
  code text,
  title text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.code,
    p.title,
    count(l.id)::bigint
  from public.leads l
  join public.properties p on p.id = l.property_id
  where l.created_at >= now() - make_interval(days => greatest(days_back, 1))
    and public.has_permission('analytics.view')
  group by p.id, p.code, p.title
  order by count(l.id) desc
  limit 10;
$$;


-- admin_lost_reasons: analytics.view
create or replace function public.admin_lost_reasons(days_back integer default 90)
returns table (
  reason text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(lost_reason), ''), 'Não informado') as reason,
    count(*)::bigint as total
  from public.leads
  where created_at >= now() - make_interval(days => greatest(days_back, 1))
    and status = 'lost'
    and public.has_permission('analytics.view')
  group by 1
  order by 2 desc;
$$;


-- admin_acquisition_metrics: analytics.view
create or replace function public.admin_acquisition_metrics(days_back integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at timestamptz;
  whatsapp_clicks bigint;
  lead_submits bigint;
  appointment_submits bigint;
  capture_submits bigint;
  share_clicks bigint;
  search_clicks bigint;
  instagram_direct_leads bigint;
  meta_lead_ads bigint;
begin
  if not public.has_permission('analytics.view') then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*) into whatsapp_clicks from public.site_events
  where created_at >= start_at and event_type = 'whatsapp_click';

  select count(*) into lead_submits from public.site_events
  where created_at >= start_at and event_type = 'lead_submit';

  select count(*) into appointment_submits from public.site_events
  where created_at >= start_at and event_type = 'appointment_submit';

  select count(*) into capture_submits from public.site_events
  where created_at >= start_at and event_type = 'capture_submit';

  select count(*) into share_clicks from public.site_events
  where created_at >= start_at and event_type = 'share_click';

  select count(*) into search_clicks from public.site_events
  where created_at >= start_at and event_type = 'search_click';

  select count(*) into instagram_direct_leads from public.leads
  where created_at >= start_at
    and source_platform = 'instagram'
    and source_channel = 'direct';

  select count(*) into meta_lead_ads from public.leads
  where created_at >= start_at
    and source_channel = 'lead_ads';

  return jsonb_build_object(
    'whatsapp_clicks', whatsapp_clicks,
    'lead_submits', lead_submits,
    'appointment_submits', appointment_submits,
    'capture_submits', capture_submits,
    'share_clicks', share_clicks,
    'search_clicks', search_clicks,
    'instagram_direct_leads', instagram_direct_leads,
    'meta_lead_ads', meta_lead_ads
  );
end;
$$;


-- admin_channel_performance: reports.view
create or replace function public.admin_channel_performance(days_back integer default 30)
returns table (
  platform text,
  channel text,
  leads bigint,
  appointments bigint,
  won bigint,
  deal_value numeric,
  commission_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      l.id,
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      l.status,
      coalesce(l.deal_value, 0) as deal_value,
      coalesce(l.commission_value, 0) as commission_value
    from public.leads l
    where l.created_at >= now() - make_interval(days => greatest(days_back, 1))
      and public.has_permission('reports.view')
  ),
  appts as (
    select a.lead_id, count(*)::bigint as total
    from public.appointments a
    where a.created_at >= now() - make_interval(days => greatest(days_back, 1))
    group by a.lead_id
  )
  select
    b.platform,
    b.channel,
    count(*)::bigint as leads,
    coalesce(sum(a.total), 0)::bigint as appointments,
    count(*) filter (where b.status = 'won')::bigint as won,
    coalesce(sum(b.deal_value) filter (where b.status = 'won'), 0)::numeric as deal_value,
    coalesce(sum(b.commission_value) filter (where b.status = 'won'), 0)::numeric as commission_value
  from base b
  left join appts a on a.lead_id = b.id
  group by b.platform, b.channel
  order by leads desc, won desc;
$$;


-- admin_unread_social_count: messages.view
create or replace function public.admin_unread_social_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_permission('messages.view') then
      coalesce(sum(social_unread_count), 0)::bigint
    else 0::bigint
  end
  from public.leads
  where source_platform = 'instagram'
    and source_channel = 'direct';
$$;


-- admin_unread_social_count_by_platform: messages.view
create or replace function public.admin_unread_social_count_by_platform(p_platform text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.has_permission('messages.view') then 0::bigint
    when p_platform = 'instagram' then coalesce(sum(instagram_unread_count), 0)::bigint
    when p_platform = 'whatsapp' then coalesce(sum(whatsapp_unread_count), 0)::bigint
    else coalesce(sum(social_unread_count), 0)::bigint
  end
  from public.leads;
$$;


-- admin_refresh_expired_proposals: proposals.view
create or replace function public.admin_refresh_expired_proposals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.has_permission('proposals.view') then
    raise exception 'not authorized';
  end if;

  update public.proposals
     set status = 'expired'
   where status in ('sent','negotiation')
     and valid_until is not null
     and valid_until < current_date;

  get diagnostics affected = row_count;
  return affected;
end;
$$;


-- admin_proposal_metrics: proposals.view
create or replace function public.admin_proposal_metrics(days_back integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at timestamptz;
  total_count bigint;
  open_count bigint;
  sent_count bigint;
  negotiation_count bigint;
  accepted_count bigint;
  rejected_count bigint;
  expired_count bigint;
  decided_count bigint;
  leads_with_proposal bigint;
  sales_from_proposals bigint;
  open_value numeric;
  accepted_value numeric;
  acceptance_rate numeric;
  proposal_to_sale_rate numeric;
begin
  if not public.has_permission('proposals.view') then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*) into total_count
  from public.proposals
  where created_at >= start_at;

  select count(*) into open_count
  from public.proposals
  where created_at >= start_at
    and status in ('draft','sent','negotiation');

  select count(*) into sent_count
  from public.proposals
  where created_at >= start_at and status = 'sent';

  select count(*) into negotiation_count
  from public.proposals
  where created_at >= start_at and status = 'negotiation';

  select count(*) into accepted_count
  from public.proposals
  where created_at >= start_at and status = 'accepted';

  select count(*) into rejected_count
  from public.proposals
  where created_at >= start_at and status = 'rejected';

  select count(*) into expired_count
  from public.proposals
  where created_at >= start_at and status = 'expired';

  decided_count := accepted_count + rejected_count + expired_count;

  select coalesce(sum(proposal_value), 0) into open_value
  from public.proposals
  where created_at >= start_at
    and status in ('draft','sent','negotiation');

  select coalesce(sum(proposal_value), 0) into accepted_value
  from public.proposals
  where created_at >= start_at
    and status = 'accepted';

  select count(distinct lead_id) into leads_with_proposal
  from public.proposals
  where created_at >= start_at;

  select count(distinct p.lead_id) into sales_from_proposals
  from public.proposals p
  join public.leads l on l.id = p.lead_id
  where p.created_at >= start_at
    and l.status = 'won';

  acceptance_rate := case
    when decided_count = 0 then 0
    else round((accepted_count::numeric / decided_count::numeric) * 100, 2)
  end;

  proposal_to_sale_rate := case
    when leads_with_proposal = 0 then 0
    else round((sales_from_proposals::numeric / leads_with_proposal::numeric) * 100, 2)
  end;

  return jsonb_build_object(
    'total', total_count,
    'open', open_count,
    'sent', sent_count,
    'negotiation', negotiation_count,
    'accepted', accepted_count,
    'rejected', rejected_count,
    'expired', expired_count,
    'open_value', open_value,
    'accepted_value', accepted_value,
    'acceptance_rate', acceptance_rate,
    'leads_with_proposal', leads_with_proposal,
    'sales_from_proposals', sales_from_proposals,
    'proposal_to_sale_rate', proposal_to_sale_rate
  );
end;
$$;


-- admin_create_deal_from_proposal: deals.manage
create or replace function public.admin_create_deal_from_proposal(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_lead public.leads%rowtype;
  v_deal_id uuid;
  v_percent numeric;
begin
  if not public.has_permission('deals.manage') then
    raise exception 'not authorized';
  end if;

  select * into v_proposal
  from public.proposals
  where id = p_proposal_id;

  if not found then
    raise exception 'proposal not found';
  end if;

  if v_proposal.status <> 'accepted' then
    raise exception 'proposal must be accepted';
  end if;

  select id into v_deal_id
  from public.deals
  where proposal_id = p_proposal_id
     or lead_id = v_proposal.lead_id
  limit 1;

  if v_deal_id is not null then
    return v_deal_id;
  end if;

  select * into v_lead from public.leads where id = v_proposal.lead_id;

  if coalesce(v_proposal.proposal_value, 0) > 0 and coalesce(v_lead.commission_value, 0) > 0 then
    v_percent := round((v_lead.commission_value / v_proposal.proposal_value) * 100.0, 4);
  else
    v_percent := null;
  end if;

  insert into public.deals (
    lead_id,
    proposal_id,
    property_id,
    sale_value,
    commission_percent,
    commission_value,
    created_by
  ) values (
    v_proposal.lead_id,
    v_proposal.id,
    v_proposal.property_id,
    coalesce(v_proposal.proposal_value, v_lead.deal_value),
    v_percent,
    v_lead.commission_value,
    auth.uid()
  )
  returning id into v_deal_id;

  insert into public.lead_notes (lead_id, note, created_by)
  values (
    v_proposal.lead_id,
    'Fechamento aberto a partir da proposta ' || coalesce(v_proposal.code, '') || '.',
    auth.uid()
  );

  return v_deal_id;
end;
$$;


-- admin_deal_metrics: deals.view
create or replace function public.admin_deal_metrics(days_back integer default 365)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at timestamptz;
  total_count bigint;
  in_progress_count bigint;
  completed_count bigint;
  overdue_commission_count bigint;
  sold_value numeric;
  commission_total numeric;
  commission_received numeric;
  commission_receivable numeric;
begin
  if not public.has_permission('deals.view') then
    raise exception 'not authorized';
  end if;

  start_at := now() - make_interval(days => greatest(days_back, 1));

  select count(*) into total_count
  from public.deals
  where created_at >= start_at and status <> 'cancelled';

  select count(*) into in_progress_count
  from public.deals
  where created_at >= start_at
    and status not in ('completed','cancelled');

  select count(*) into completed_count
  from public.deals
  where created_at >= start_at and status = 'completed';

  select count(*) into overdue_commission_count
  from public.deals
  where created_at >= start_at
    and status <> 'cancelled'
    and commission_status <> 'received'
    and commission_due_date is not null
    and commission_due_date < current_date;

  select coalesce(sum(sale_value), 0) into sold_value
  from public.deals
  where created_at >= start_at and status <> 'cancelled';

  select coalesce(sum(commission_value), 0) into commission_total
  from public.deals
  where created_at >= start_at and status <> 'cancelled';

  select coalesce(sum(commission_received_amount), 0) into commission_received
  from public.deals
  where created_at >= start_at and status <> 'cancelled';

  select coalesce(sum(greatest(coalesce(commission_value, 0) - coalesce(commission_received_amount, 0), 0)), 0)
    into commission_receivable
  from public.deals
  where created_at >= start_at and status <> 'cancelled';

  return jsonb_build_object(
    'total', total_count,
    'in_progress', in_progress_count,
    'completed', completed_count,
    'overdue_commissions', overdue_commission_count,
    'sold_value', sold_value,
    'commission_total', commission_total,
    'commission_received', commission_received,
    'commission_receivable', commission_receivable
  );
end;
$$;


-- admin_management_period: management.view
create or replace function public.admin_management_period(
  p_start_date date,
  p_end_date date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      p_start_date::timestamptz as start_at,
      (p_end_date + 1)::timestamptz as end_at
  ),
  lead_stats as (
    select count(*)::bigint as total
    from public.leads l, bounds b
    where l.created_at >= b.start_at and l.created_at < b.end_at
  ),
  visitor_stats as (
    select count(distinct s.session_id)::bigint as total
    from public.site_visits s, bounds b
    where s.created_at >= b.start_at and s.created_at < b.end_at
  ),
  appointment_stats as (
    select
      count(*)::bigint as total,
      count(*) filter (where a.status = 'completed')::bigint as completed,
      count(distinct a.lead_id) filter (where a.status = 'completed')::bigint as completed_leads
    from public.appointments a, bounds b
    where coalesce(a.scheduled_at, a.created_at) >= b.start_at
      and coalesce(a.scheduled_at, a.created_at) < b.end_at
  ),
  capture_stats as (
    select count(*)::bigint as total
    from public.owner_captures c, bounds b
    where c.created_at >= b.start_at and c.created_at < b.end_at
  ),
  proposal_stats as (
    select
      count(*)::bigint as total,
      count(*) filter (where p.status = 'accepted')::bigint as accepted,
      count(distinct p.lead_id)::bigint as leads_with_proposal
    from public.proposals p, bounds b
    where p.created_at >= b.start_at and p.created_at < b.end_at
  ),
  deal_stats as (
    select
      count(*) filter (where d.status <> 'cancelled')::bigint as total,
      coalesce(sum(d.sale_value) filter (where d.status <> 'cancelled'), 0)::numeric as sales_value,
      coalesce(sum(d.commission_value) filter (where d.status <> 'cancelled'), 0)::numeric as commission_generated
    from public.deals d, bounds b
    where d.created_at >= b.start_at and d.created_at < b.end_at
  ),
  commission_stats as (
    select
      coalesce(sum(d.commission_received_amount) filter (where d.commission_status = 'received'), 0)::numeric as received
    from public.deals d, bounds b
    where d.commission_received_at >= b.start_at and d.commission_received_at < b.end_at
  ),
  property_stats as (
    select
      count(*) filter (where p.status = 'published')::bigint as published,
      count(*) filter (where p.status in ('published','draft'))::bigint as active_portfolio
    from public.properties p
    where p.deleted_at is null
  )
  select jsonb_build_object(
    'unique_visitors', coalesce(v.total, 0),
    'leads', coalesce(l.total, 0),
    'appointments', coalesce(a.total, 0),
    'visits_completed', coalesce(a.completed, 0),
    'visited_leads', coalesce(a.completed_leads, 0),
    'captures', coalesce(c.total, 0),
    'proposals', coalesce(p.total, 0),
    'proposals_accepted', coalesce(p.accepted, 0),
    'proposal_leads', coalesce(p.leads_with_proposal, 0),
    'deals', coalesce(d.total, 0),
    'sales_value', coalesce(d.sales_value, 0),
    'commission_generated', coalesce(d.commission_generated, 0),
    'commission_received', coalesce(cr.received, 0),
    'published_properties', coalesce(ps.published, 0),
    'active_portfolio', coalesce(ps.active_portfolio, 0),
    'lead_to_visit_rate', case when coalesce(l.total,0) > 0 then least(100, round((coalesce(a.completed_leads,0)::numeric / l.total::numeric) * 100, 1)) else 0 end,
    'visit_to_proposal_rate', case when coalesce(a.completed_leads,0) > 0 then least(100, round((coalesce(p.leads_with_proposal,0)::numeric / a.completed_leads::numeric) * 100, 1)) else 0 end,
    'proposal_to_deal_rate', case when coalesce(p.total,0) > 0 then least(100, round((coalesce(d.total,0)::numeric / p.total::numeric) * 100, 1)) else 0 end,
    'lead_to_deal_rate', case when coalesce(l.total,0) > 0 then least(100, round((coalesce(d.total,0)::numeric / l.total::numeric) * 100, 1)) else 0 end
  )
  from lead_stats l
  cross join visitor_stats v
  cross join appointment_stats a
  cross join capture_stats c
  cross join proposal_stats p
  cross join deal_stats d
  cross join commission_stats cr
  cross join property_stats ps
  where public.has_permission('management.view');
$$;


-- admin_management_channels: management.view
create or replace function public.admin_management_channels(
  p_start_date date,
  p_end_date date
)
returns table (
  platform text,
  channel text,
  leads bigint,
  visits bigint,
  proposals bigint,
  deals bigint,
  sales_value numeric,
  commission_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select p_start_date::timestamptz as start_at, (p_end_date + 1)::timestamptz as end_at
  ),
  lead_metrics as (
    select
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      count(*)::bigint as leads
    from public.leads l, bounds b
    where l.created_at >= b.start_at and l.created_at < b.end_at
    group by 1,2
  ),
  visit_metrics as (
    select
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      count(distinct a.lead_id)::bigint as visits
    from public.appointments a
    join public.leads l on l.id = a.lead_id
    cross join bounds b
    where a.status = 'completed'
      and coalesce(a.scheduled_at, a.created_at) >= b.start_at
      and coalesce(a.scheduled_at, a.created_at) < b.end_at
    group by 1,2
  ),
  proposal_metrics as (
    select
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      count(*)::bigint as proposals
    from public.proposals p
    join public.leads l on l.id = p.lead_id
    cross join bounds b
    where p.created_at >= b.start_at and p.created_at < b.end_at
    group by 1,2
  ),
  deal_metrics as (
    select
      coalesce(l.initial_source_platform, l.source_platform, 'site') as platform,
      coalesce(l.initial_source_channel, l.source_channel, 'form') as channel,
      count(*) filter (where d.status <> 'cancelled')::bigint as deals,
      coalesce(sum(d.sale_value) filter (where d.status <> 'cancelled'), 0)::numeric as sales_value,
      coalesce(sum(d.commission_value) filter (where d.status <> 'cancelled'), 0)::numeric as commission_value
    from public.deals d
    join public.leads l on l.id = d.lead_id
    cross join bounds b
    where d.created_at >= b.start_at and d.created_at < b.end_at
    group by 1,2
  ),
  keys as (
    select platform, channel from lead_metrics
    union
    select platform, channel from visit_metrics
    union
    select platform, channel from proposal_metrics
    union
    select platform, channel from deal_metrics
  )
  select
    k.platform,
    k.channel,
    coalesce(lm.leads,0)::bigint,
    coalesce(vm.visits,0)::bigint,
    coalesce(pm.proposals,0)::bigint,
    coalesce(dm.deals,0)::bigint,
    coalesce(dm.sales_value,0)::numeric,
    coalesce(dm.commission_value,0)::numeric
  from keys k
  left join lead_metrics lm using (platform,channel)
  left join visit_metrics vm using (platform,channel)
  left join proposal_metrics pm using (platform,channel)
  left join deal_metrics dm using (platform,channel)
  where public.has_permission('management.view')
  order by deals desc, leads desc, platform, channel;
$$;


-- admin_management_trend: management.view
create or replace function public.admin_management_trend(p_months integer default 6)
returns table (
  month_start date,
  leads bigint,
  visits bigint,
  proposals bigint,
  deals bigint,
  sales_value numeric,
  commission_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with months as (
    select generate_series(
      date_trunc('month', current_date) - make_interval(months => greatest(p_months,1) - 1),
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  )
  select
    m.month_start,
    (
      select count(*)::bigint from public.leads l
      where l.created_at >= m.month_start::timestamptz
        and l.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as leads,
    (
      select count(distinct a.lead_id)::bigint from public.appointments a
      where a.status = 'completed'
        and coalesce(a.scheduled_at,a.created_at) >= m.month_start::timestamptz
        and coalesce(a.scheduled_at,a.created_at) < (m.month_start + interval '1 month')::timestamptz
    ) as visits,
    (
      select count(*)::bigint from public.proposals p
      where p.created_at >= m.month_start::timestamptz
        and p.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as proposals,
    (
      select count(*)::bigint from public.deals d
      where d.status <> 'cancelled'
        and d.created_at >= m.month_start::timestamptz
        and d.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as deals,
    (
      select coalesce(sum(d.sale_value),0)::numeric from public.deals d
      where d.status <> 'cancelled'
        and d.created_at >= m.month_start::timestamptz
        and d.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as sales_value,
    (
      select coalesce(sum(d.commission_value),0)::numeric from public.deals d
      where d.status <> 'cancelled'
        and d.created_at >= m.month_start::timestamptz
        and d.created_at < (m.month_start + interval '1 month')::timestamptz
    ) as commission_value
  from months m
  where public.has_permission('management.view')
  order by m.month_start;
$$;


-- refresh_property_documentation_status: properties.manage
create or replace function public.refresh_property_documentation_status(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_count integer;
  validated_or_na_count integer;
  total_count integer;
begin
  if not public.has_permission('properties.manage') then
    raise exception 'not authorized';
  end if;

  select
    count(*),
    count(*) filter (where status = 'pending'),
    count(*) filter (where status in ('validated','not_applicable'))
  into total_count, pending_count, validated_or_na_count
  from public.property_documents
  where property_id = p_property_id;

  update public.property_management
  set documentation_status = case
    when total_count > 0 and validated_or_na_count = total_count then 'complete'
    when pending_count = total_count then 'pending'
    else 'partial'
  end
  where property_id = p_property_id;
end;
$$;
