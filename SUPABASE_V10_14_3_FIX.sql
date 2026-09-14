-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- CORREÇÃO V10.14.3
-- Corrige a função de listagem da equipe e reforça permissões do proprietário.

-- 1. Proprietário sempre usa as permissões padrão completas.
update public.organization_members
set permissions = '{}'::jsonb,
    updated_at = now()
where role = 'owner';

create or replace function public.effective_permissions_json()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when m.role = 'owner' then public.role_permissions_json('owner')
    else coalesce(public.role_permissions_json(m.role), '{}'::jsonb)
         || coalesce(m.permissions, '{}'::jsonb)
  end
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by
    case m.role
      when 'owner' then 1
      when 'admin' then 2
      when 'broker' then 3
      else 4
    end,
    m.created_at
  limit 1;
$$;

grant execute on function public.effective_permissions_json() to authenticated;

-- 2. Contexto de acesso usado pelo painel.
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
    'permissions',
      case
        when m.role = 'owner' then public.role_permissions_json('owner')
        else public.role_permissions_json(m.role)
             || coalesce(m.permissions, '{}'::jsonb)
      end
  )
  from public.organization_members m
  join public.organizations o
    on o.id = m.organization_id
  join public.profiles p
    on p.id = m.user_id
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by
    case m.role
      when 'owner' then 1
      when 'admin' then 2
      when 'broker' then 3
      else 4
    end,
    m.created_at
  limit 1;
$$;

grant execute on function public.current_access_context() to authenticated;

-- 3. Lista todos os usuários da empresa atual.
create or replace function public.organization_team_members()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'organization_id', m.organization_id,
        'user_id', m.user_id,
        'role', m.role,
        'status', m.status,
        'permissions', coalesce(m.permissions, '{}'::jsonb),
        'invited_at', m.invited_at,
        'joined_at', m.joined_at,
        'created_at', m.created_at,
        'updated_at', m.updated_at,
        'profile', jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'email', p.email,
          'last_seen_at', p.last_seen_at
        )
      )
      order by
        case m.role
          when 'owner' then 1
          when 'admin' then 2
          when 'broker' then 3
          else 4
        end,
        m.created_at
    ),
    '[]'::jsonb
  )
  from public.organization_members m
  join public.profiles p
    on p.id = m.user_id
  where m.organization_id = public.current_organization_id()
    and public.has_permission('team.view');
$$;

grant execute on function public.organization_team_members() to authenticated;

-- 4. Marca como ativos os usuários que já aceitaram o convite.
update public.organization_members m
set status = 'active',
    joined_at = coalesce(m.joined_at, u.created_at),
    updated_at = now()
from auth.users u
where u.id = m.user_id
  and u.last_sign_in_at is not null
  and m.status <> 'disabled';

-- 5. Força o PostgREST/Supabase a recarregar o catálogo de funções.
notify pgrst, 'reload schema';
