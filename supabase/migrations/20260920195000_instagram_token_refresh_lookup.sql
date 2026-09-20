create or replace function public.list_meta_instagram_connections_for_refresh(p_before timestamptz)
returns table(id uuid, organization_id uuid, instagram_user_id text, username text, account_type text, access_token text, status text, scopes text[], token_expires_at timestamptz, metadata jsonb)
language sql stable security definer set search_path = public, vault
as $function$
  select c.id, c.organization_id, c.instagram_user_id, c.username, c.account_type, s.decrypted_secret,
    c.status, c.scopes, c.token_expires_at, c.metadata
  from public.meta_instagram_connections c
  join vault.decrypted_secrets s on s.id = c.access_token_secret_id
  where c.status = 'connected' and c.token_expires_at is not null
    and c.token_expires_at <= p_before and c.token_expires_at > now()
  order by c.token_expires_at asc;
$function$;

revoke all on function public.list_meta_instagram_connections_for_refresh(timestamptz) from public, anon, authenticated;
grant execute on function public.list_meta_instagram_connections_for_refresh(timestamptz) to service_role;