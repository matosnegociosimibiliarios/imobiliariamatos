-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 6 - SEGURANÇA DO PAINEL ADMINISTRATIVO
-- =========================================================

-- 1. PERFIS DE USUÁRIO
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 2. CRIAR PERFIL AUTOMATICAMENTE QUANDO UM USUÁRIO FOR CRIADO
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- 3. FUNÇÃO SEGURA PARA VERIFICAR ADMIN
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- 4. POLÍTICAS DE PERFIL
drop policy if exists "users_read_own_profile" on public.profiles;
drop policy if exists "admins_read_profiles" on public.profiles;

create policy "users_read_own_profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "admins_read_profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- 5. POLÍTICAS ADMINISTRATIVAS PARA CIDADES
drop policy if exists "admin_manage_cities" on public.cities;
create policy "admin_manage_cities"
on public.cities
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 6. POLÍTICAS ADMINISTRATIVAS PARA BAIRROS
drop policy if exists "admin_manage_neighborhoods" on public.neighborhoods;
create policy "admin_manage_neighborhoods"
on public.neighborhoods
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 7. POLÍTICAS ADMINISTRATIVAS PARA IMÓVEIS
drop policy if exists "admin_manage_properties" on public.properties;
create policy "admin_manage_properties"
on public.properties
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 8. POLÍTICAS ADMINISTRATIVAS PARA IMAGENS
drop policy if exists "admin_manage_property_images" on public.property_images;
create policy "admin_manage_property_images"
on public.property_images
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 9. POLÍTICAS ADMINISTRATIVAS PARA CARACTERÍSTICAS
drop policy if exists "admin_manage_features" on public.features;
create policy "admin_manage_features"
on public.features
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_manage_property_features" on public.property_features;
create policy "admin_manage_property_features"
on public.property_features
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 10. POLÍTICAS ADMINISTRATIVAS PARA CONFIGURAÇÕES PÚBLICAS
drop policy if exists "admin_manage_agency_settings" on public.agency_public_settings;
create policy "admin_manage_agency_settings"
on public.agency_public_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 11. GARANTIR PERMISSÕES SQL PARA AUTHENTICATED
grant select, insert, update, delete
on public.cities,
   public.neighborhoods,
   public.properties,
   public.property_images,
   public.features,
   public.property_features,
   public.agency_public_settings,
   public.profiles
to authenticated;

-- 12. STORAGE: SOMENTE ADMIN PODE ENVIAR / EDITAR / EXCLUIR
drop policy if exists "admin_upload_property_images" on storage.objects;
drop policy if exists "admin_update_property_images_storage" on storage.objects;
drop policy if exists "admin_delete_property_images_storage" on storage.objects;

create policy "admin_upload_property_images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-images'
  and public.is_admin()
);

create policy "admin_update_property_images_storage"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'property-images'
  and public.is_admin()
)
with check (
  bucket_id = 'property-images'
  and public.is_admin()
);

create policy "admin_delete_property_images_storage"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-images'
  and public.is_admin()
);

-- =========================================================
-- IMPORTANTE:
-- 1. Crie o usuário em Authentication > Users.
-- 2. Depois transforme esse usuário em administrador com:
--
-- update public.profiles
-- set role = 'admin',
--     full_name = 'Seu nome',
--     updated_at = now()
-- where id = (
--   select id
--   from auth.users
--   where email = 'SEU_EMAIL_AQUI'
--   limit 1
-- );
--
-- =========================================================
