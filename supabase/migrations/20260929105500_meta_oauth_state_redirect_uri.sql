alter table public.meta_oauth_states
  add column if not exists redirect_uri text;
