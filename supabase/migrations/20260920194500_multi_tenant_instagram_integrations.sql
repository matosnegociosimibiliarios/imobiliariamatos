create extension if not exists pgcrypto;

create table if not exists public.meta_instagram_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  instagram_user_id text not null,
  username text,
  account_type text,
  access_token_secret_id uuid not null,
  status text not null default 'connected' check (status in ('pending','connected','error','disconnected')),
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_refreshed_at timestamptz,
  last_webhook_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id),
  unique (instagram_user_id)
);

create index if not exists meta_instagram_connections_status_idx on public.meta_instagram_connections(status);
create index if not exists meta_instagram_connections_org_idx on public.meta_instagram_connections(organization_id);
alter table public.meta_instagram_connections enable row level security;

create table if not exists public.meta_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_username text,
  provider text not null default 'instagram',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists meta_oauth_states_expires_idx on public.meta_oauth_states(expires_at);
alter table public.meta_oauth_states enable row level security;

create or replace function public.store_meta_instagram_connection(
  p_organization_id uuid, p_instagram_user_id text, p_username text, p_account_type text,
  p_access_token text, p_scopes text[] default '{}', p_token_expires_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public, vault
as $function$
declare v_id uuid; v_secret_id uuid; v_secret_name text;
begin
  if p_organization_id is null or nullif(trim(p_instagram_user_id), '') is null then
    raise exception 'Organização e Instagram user id são obrigatórios.';
  end if;
  if p_access_token is null or length(trim(p_access_token)) = 0 then
    raise exception 'Token do Instagram é obrigatório.';
  end if;
  v_secret_name := 'meta_instagram_access_token_' || replace(p_organization_id::text, '-', '');
  select access_token_secret_id into v_secret_id from public.meta_instagram_connections
    where organization_id = p_organization_id limit 1;
  if v_secret_id is null then
    v_secret_id := vault.create_secret(p_access_token, v_secret_name,
      'Token de acesso do Instagram Business da organização ' || p_organization_id::text);
  else
    perform vault.update_secret(v_secret_id, p_access_token, v_secret_name,
      'Token de acesso do Instagram Business da organização ' || p_organization_id::text);
  end if;
  insert into public.meta_instagram_connections (
    organization_id, instagram_user_id, username, account_type, access_token_secret_id,
    status, scopes, token_expires_at, connected_at, last_refreshed_at, metadata, updated_at
  ) values (
    p_organization_id, trim(p_instagram_user_id), nullif(trim(p_username), ''), nullif(trim(p_account_type), ''),
    v_secret_id, 'connected', coalesce(p_scopes, '{}'), p_token_expires_at, now(), now(),
    coalesce(p_metadata, '{}'::jsonb), now()
  )
  on conflict (organization_id) do update set
    instagram_user_id = excluded.instagram_user_id, username = excluded.username,
    account_type = excluded.account_type, access_token_secret_id = excluded.access_token_secret_id,
    status = 'connected', scopes = excluded.scopes, token_expires_at = excluded.token_expires_at,
    connected_at = coalesce(public.meta_instagram_connections.connected_at, now()),
    last_refreshed_at = now(), metadata = excluded.metadata, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.get_meta_instagram_connection(p_organization_id uuid)
returns table(id uuid, organization_id uuid, instagram_user_id text, username text, account_type text,
  access_token text, status text, scopes text[], token_expires_at timestamptz, connected_at timestamptz,
  last_refreshed_at timestamptz, last_webhook_at timestamptz, metadata jsonb)
language sql stable security definer set search_path = public, vault
as $function$
  select c.id, c.organization_id, c.instagram_user_id, c.username, c.account_type, s.decrypted_secret,
    c.status, c.scopes, c.token_expires_at, c.connected_at, c.last_refreshed_at, c.last_webhook_at, c.metadata
  from public.meta_instagram_connections c
  left join vault.decrypted_secrets s on s.id = c.access_token_secret_id
  where c.organization_id = p_organization_id limit 1;
$function$;

create or replace function public.get_meta_instagram_connection_by_user_id(p_instagram_user_id text)
returns table(id uuid, organization_id uuid, instagram_user_id text, username text, account_type text,
  access_token text, status text, scopes text[], token_expires_at timestamptz, connected_at timestamptz,
  last_refreshed_at timestamptz, last_webhook_at timestamptz, metadata jsonb)
language sql stable security definer set search_path = public, vault
as $function$
  select c.id, c.organization_id, c.instagram_user_id, c.username, c.account_type, s.decrypted_secret,
    c.status, c.scopes, c.token_expires_at, c.connected_at, c.last_refreshed_at, c.last_webhook_at, c.metadata
  from public.meta_instagram_connections c
  left join vault.decrypted_secrets s on s.id = c.access_token_secret_id
  where c.instagram_user_id = trim(p_instagram_user_id) and c.status = 'connected' limit 1;
$function$;

create or replace function public.touch_meta_instagram_webhook(p_instagram_user_id text)
returns void language sql security definer set search_path = public
as $function$
  update public.meta_instagram_connections set last_webhook_at = now(), updated_at = now()
  where instagram_user_id = trim(p_instagram_user_id);
$function$;

revoke all on function public.store_meta_instagram_connection(uuid,text,text,text,text,text[],timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.store_meta_instagram_connection(uuid,text,text,text,text,text[],timestamptz,jsonb) to service_role;
revoke all on function public.get_meta_instagram_connection(uuid) from public, anon, authenticated;
grant execute on function public.get_meta_instagram_connection(uuid) to service_role;
revoke all on function public.get_meta_instagram_connection_by_user_id(text) from public, anon, authenticated;
grant execute on function public.get_meta_instagram_connection_by_user_id(text) to service_role;
revoke all on function public.touch_meta_instagram_webhook(text) from public, anon, authenticated;
grant execute on function public.touch_meta_instagram_webhook(text) to service_role;