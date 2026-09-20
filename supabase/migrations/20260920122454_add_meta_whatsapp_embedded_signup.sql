create table if not exists public.meta_whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  access_token_secret_id uuid not null,
  status text not null default 'connected' check (status in ('pending','connected','error','disconnected')),
  connected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meta_whatsapp_connections enable row level security;

create index if not exists meta_whatsapp_connections_waba_idx
  on public.meta_whatsapp_connections (waba_id);

create index if not exists meta_whatsapp_connections_phone_idx
  on public.meta_whatsapp_connections (phone_number_id);

create or replace function public.store_meta_whatsapp_connection(
  p_organization_id uuid,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text,
  p_access_token text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
  v_secret_id uuid;
  v_secret_name text;
begin
  if p_organization_id is null or p_access_token is null or length(trim(p_access_token)) = 0 then
    raise exception 'Organização e token do WhatsApp são obrigatórios.';
  end if;

  v_secret_name := 'meta_whatsapp_access_token_' || replace(p_organization_id::text, '-', '');

  select access_token_secret_id
    into v_secret_id
  from public.meta_whatsapp_connections
  where organization_id = p_organization_id
  limit 1;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_access_token,
      v_secret_name,
      'Token de acesso do WhatsApp Business Platform da organização ' || p_organization_id::text
    );
  else
    perform vault.update_secret(
      v_secret_id,
      p_access_token,
      v_secret_name,
      'Token de acesso do WhatsApp Business Platform da organização ' || p_organization_id::text
    );
  end if;

  insert into public.meta_whatsapp_connections (
    organization_id,
    waba_id,
    phone_number_id,
    display_phone_number,
    access_token_secret_id,
    status,
    connected_at,
    metadata,
    updated_at
  )
  values (
    p_organization_id,
    nullif(trim(p_waba_id), ''),
    nullif(trim(p_phone_number_id), ''),
    nullif(trim(p_display_phone_number), ''),
    v_secret_id,
    'connected',
    now(),
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (organization_id) do update set
    waba_id = excluded.waba_id,
    phone_number_id = excluded.phone_number_id,
    display_phone_number = excluded.display_phone_number,
    access_token_secret_id = excluded.access_token_secret_id,
    status = 'connected',
    connected_at = now(),
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_meta_whatsapp_connection(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  access_token text,
  status text,
  connected_at timestamptz,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public, vault
as $$
  select
    c.id,
    c.organization_id,
    c.waba_id,
    c.phone_number_id,
    c.display_phone_number,
    s.decrypted_secret,
    c.status,
    c.connected_at,
    c.metadata
  from public.meta_whatsapp_connections c
  left join vault.decrypted_secrets s
    on s.id = c.access_token_secret_id
  where c.organization_id = p_organization_id
  limit 1;
$$;

revoke all on function public.store_meta_whatsapp_connection(uuid,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.get_meta_whatsapp_connection(uuid) from public, anon, authenticated;
grant execute on function public.store_meta_whatsapp_connection(uuid,text,text,text,text,jsonb) to service_role;
grant execute on function public.get_meta_whatsapp_connection(uuid) to service_role;

revoke all on table public.meta_whatsapp_connections from public, anon, authenticated;