-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.8 - GESTÃO DE IMÓVEIS E PROPRIETÁRIOS
-- =========================================================

-- 1. GESTÃO COMERCIAL DO IMÓVEL
create table if not exists public.property_management (
  property_id uuid primary key references public.properties(id) on delete cascade,
  source_capture_id uuid unique references public.owner_captures(id) on delete set null,

  owner_name text,
  owner_whatsapp text,
  owner_email text,

  listing_started_at date not null default current_date,

  authorization_status text not null default 'pending'
    check (authorization_status in ('pending','authorized','expired','not_required')),
  authorization_signed_at date,
  authorization_expires_at date,

  exclusivity boolean not null default false,
  exclusivity_until date,

  commission_percent numeric(7,4),
  commission_payer text not null default 'seller'
    check (commission_payer in ('seller','buyer','both','other')),

  documentation_status text not null default 'pending'
    check (documentation_status in ('pending','partial','complete')),

  next_review_at timestamptz,
  internal_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint property_management_commission_range
    check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100))
);

create index if not exists property_management_authorization_idx
on public.property_management(authorization_status, authorization_expires_at);

create index if not exists property_management_exclusivity_idx
on public.property_management(exclusivity, exclusivity_until);

create index if not exists property_management_review_idx
on public.property_management(next_review_at);

alter table public.property_management enable row level security;

-- 2. DOCUMENTOS DO IMÓVEL / PROPRIETÁRIO
create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  doc_key text not null,
  label text not null,
  status text not null default 'pending'
    check (status in ('pending','received','validated','not_applicable')),
  notes text,
  display_order integer not null default 0,
  received_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, doc_key)
);

create index if not exists property_documents_property_idx
on public.property_documents(property_id, display_order);

alter table public.property_documents enable row level security;

-- 3. HISTÓRICO DE PREÇOS
create table if not exists public.property_price_history (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  price_type text not null check (price_type in ('sale','rent')),
  old_price numeric(14,2),
  new_price numeric(14,2),
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists property_price_history_property_idx
on public.property_price_history(property_id, created_at desc);

alter table public.property_price_history enable row level security;

-- 4. HISTÓRICO DE STATUS DO IMÓVEL
create table if not exists public.property_status_history (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists property_status_history_property_idx
on public.property_status_history(property_id, created_at desc);

alter table public.property_status_history enable row level security;

-- 5. UPDATED_AT

drop trigger if exists property_management_touch_updated_at on public.property_management;
create trigger property_management_touch_updated_at
before update on public.property_management
for each row execute function public.touch_updated_at();

drop trigger if exists property_documents_touch_updated_at on public.property_documents;
create trigger property_documents_touch_updated_at
before update on public.property_documents
for each row execute function public.touch_updated_at();

-- 6. DATAS AUTOMÁTICAS DOS DOCUMENTOS
create or replace function public.apply_property_document_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('received','validated') and old.status is distinct from new.status then
    new.received_at := coalesce(new.received_at, now());
  end if;

  if new.status = 'validated' and old.status is distinct from 'validated' then
    new.validated_at := coalesce(new.validated_at, now());
  elsif new.status <> 'validated' then
    new.validated_at := null;
  end if;

  if new.status = 'pending' then
    new.received_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists property_documents_business_rules on public.property_documents;
create trigger property_documents_business_rules
before update on public.property_documents
for each row execute function public.apply_property_document_rules();

-- 7. CHECKLIST PADRÃO DE DOCUMENTOS
create or replace function public.seed_property_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.property_documents (property_id, doc_key, label, display_order) values
    (new.property_id, 'owner_id', 'Documento de identificação do proprietário', 10),
    (new.property_id, 'authorization', 'Autorização para venda / locação', 20),
    (new.property_id, 'registration', 'Matrícula atualizada do imóvel', 30),
    (new.property_id, 'municipal_taxes', 'IPTU / tributos municipais', 40),
    (new.property_id, 'encumbrances', 'Certidão / situação de ônus', 50),
    (new.property_id, 'regularization', 'Regularidade da construção / averbação', 60)
  on conflict (property_id, doc_key) do nothing;

  return new;
end;
$$;

drop trigger if exists property_management_seed_documents on public.property_management;
create trigger property_management_seed_documents
after insert on public.property_management
for each row execute function public.seed_property_documents();

-- 8. CRIA GESTÃO AUTOMATICAMENTE PARA NOVOS IMÓVEIS
create or replace function public.seed_property_management()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.property_management (
    property_id,
    listing_started_at
  ) values (
    new.id,
    coalesce(new.published_at::date, new.created_at::date, current_date)
  )
  on conflict (property_id) do nothing;

  if new.sale_price is not null then
    insert into public.property_price_history (property_id, price_type, old_price, new_price)
    values (new.id, 'sale', null, new.sale_price);
  end if;

  if new.rent_price is not null then
    insert into public.property_price_history (property_id, price_type, old_price, new_price)
    values (new.id, 'rent', null, new.rent_price);
  end if;

  insert into public.property_status_history (property_id, from_status, to_status)
  values (new.id, null, new.status);

  return new;
end;
$$;

drop trigger if exists properties_seed_management on public.properties;
create trigger properties_seed_management
after insert on public.properties
for each row execute function public.seed_property_management();

-- 9. SINCRONIZA CAPTAÇÃO CONVERTIDA COM A GESTÃO DO IMÓVEL
create or replace function public.sync_capture_property_management()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.converted_property_id is not null then
    insert into public.property_management (
      property_id,
      source_capture_id,
      owner_name,
      owner_whatsapp,
      owner_email,
      listing_started_at,
      authorization_status,
      authorization_signed_at,
      commission_percent
    ) values (
      new.converted_property_id,
      new.id,
      new.owner_name,
      new.whatsapp,
      new.email,
      coalesce(new.updated_at::date, new.created_at::date, current_date),
      case when new.status in ('authorized','published') then 'authorized' else 'pending' end,
      case when new.status in ('authorized','published') then coalesce(new.updated_at::date, current_date) else null end,
      new.commission_percent
    )
    on conflict (property_id) do update set
      source_capture_id = excluded.source_capture_id,
      owner_name = coalesce(excluded.owner_name, property_management.owner_name),
      owner_whatsapp = coalesce(excluded.owner_whatsapp, property_management.owner_whatsapp),
      owner_email = coalesce(excluded.owner_email, property_management.owner_email),
      commission_percent = coalesce(excluded.commission_percent, property_management.commission_percent),
      authorization_status = case
        when excluded.authorization_status = 'authorized' then 'authorized'
        else property_management.authorization_status
      end,
      authorization_signed_at = coalesce(excluded.authorization_signed_at, property_management.authorization_signed_at);
  end if;

  return new;
end;
$$;

drop trigger if exists owner_captures_sync_property_management on public.owner_captures;
create trigger owner_captures_sync_property_management
after insert or update of converted_property_id, owner_name, whatsapp, email, commission_percent, status
on public.owner_captures
for each row execute function public.sync_capture_property_management();

-- 10. HISTÓRICO AUTOMÁTICO DE PREÇO
create or replace function public.log_property_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.sale_price is distinct from new.sale_price then
    insert into public.property_price_history (
      property_id, price_type, old_price, new_price, changed_by
    ) values (
      new.id, 'sale', old.sale_price, new.sale_price, auth.uid()
    );
  end if;

  if old.rent_price is distinct from new.rent_price then
    insert into public.property_price_history (
      property_id, price_type, old_price, new_price, changed_by
    ) values (
      new.id, 'rent', old.rent_price, new.rent_price, auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists properties_price_history_trigger on public.properties;
create trigger properties_price_history_trigger
after update of sale_price, rent_price on public.properties
for each row execute function public.log_property_price_change();

-- 11. HISTÓRICO AUTOMÁTICO DE STATUS
create or replace function public.log_property_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.property_status_history (
      property_id, from_status, to_status, changed_by
    ) values (
      new.id, old.status, new.status, auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists properties_status_history_trigger on public.properties;
create trigger properties_status_history_trigger
after update of status on public.properties
for each row execute function public.log_property_status_change();

-- 12. BACKFILL DOS IMÓVEIS JÁ EXISTENTES
insert into public.property_management (
  property_id,
  source_capture_id,
  owner_name,
  owner_whatsapp,
  owner_email,
  listing_started_at,
  authorization_status,
  authorization_signed_at,
  commission_percent
)
select
  p.id,
  oc.id,
  oc.owner_name,
  oc.whatsapp,
  oc.email,
  coalesce(p.published_at::date, p.created_at::date, current_date),
  case when oc.status in ('authorized','published') then 'authorized' else 'pending' end,
  case when oc.status in ('authorized','published') then coalesce(oc.updated_at::date, current_date) else null end,
  oc.commission_percent
from public.properties p
left join lateral (
  select c.*
  from public.owner_captures c
  where c.converted_property_id = p.id
  order by c.created_at desc
  limit 1
) oc on true
where p.deleted_at is null
on conflict (property_id) do update set
  source_capture_id = coalesce(excluded.source_capture_id, property_management.source_capture_id),
  owner_name = coalesce(excluded.owner_name, property_management.owner_name),
  owner_whatsapp = coalesce(excluded.owner_whatsapp, property_management.owner_whatsapp),
  owner_email = coalesce(excluded.owner_email, property_management.owner_email),
  commission_percent = coalesce(excluded.commission_percent, property_management.commission_percent);

-- Garante checklist mesmo se a linha de gestão já existia.
insert into public.property_documents (property_id, doc_key, label, display_order)
select pm.property_id, d.doc_key, d.label, d.display_order
from public.property_management pm
cross join (values
  ('owner_id', 'Documento de identificação do proprietário', 10),
  ('authorization', 'Autorização para venda / locação', 20),
  ('registration', 'Matrícula atualizada do imóvel', 30),
  ('municipal_taxes', 'IPTU / tributos municipais', 40),
  ('encumbrances', 'Certidão / situação de ônus', 50),
  ('regularization', 'Regularidade da construção / averbação', 60)
) as d(doc_key, label, display_order)
on conflict (property_id, doc_key) do nothing;

-- Registra preço atual como ponto inicial do histórico.
insert into public.property_price_history (property_id, price_type, old_price, new_price)
select p.id, 'sale', null, p.sale_price
from public.properties p
where p.deleted_at is null
  and p.sale_price is not null
  and not exists (
    select 1 from public.property_price_history h
    where h.property_id = p.id and h.price_type = 'sale'
  );

insert into public.property_price_history (property_id, price_type, old_price, new_price)
select p.id, 'rent', null, p.rent_price
from public.properties p
where p.deleted_at is null
  and p.rent_price is not null
  and not exists (
    select 1 from public.property_price_history h
    where h.property_id = p.id and h.price_type = 'rent'
  );

-- Registra status atual como ponto inicial.
insert into public.property_status_history (property_id, from_status, to_status)
select p.id, null, p.status
from public.properties p
where p.deleted_at is null
  and not exists (
    select 1 from public.property_status_history h
    where h.property_id = p.id
  );

-- 13. POLÍTICAS ADMINISTRATIVAS

drop policy if exists "admin_manage_property_management" on public.property_management;
create policy "admin_manage_property_management"
on public.property_management
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_manage_property_documents" on public.property_documents;
create policy "admin_manage_property_documents"
on public.property_documents
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_read_property_price_history" on public.property_price_history;
create policy "admin_read_property_price_history"
on public.property_price_history
for select to authenticated
using (public.is_admin());

drop policy if exists "admin_read_property_status_history" on public.property_status_history;
create policy "admin_read_property_status_history"
on public.property_status_history
for select to authenticated
using (public.is_admin());

-- 14. PERMISSÕES

grant select, insert, update, delete
on public.property_management,
   public.property_documents
to authenticated;

grant select
on public.property_price_history,
   public.property_status_history
to authenticated;

grant usage, select on sequence public.property_price_history_id_seq to authenticated;
grant usage, select on sequence public.property_status_history_id_seq to authenticated;

-- 15. SINCRONIZA STATUS DOCUMENTAL DA GESTÃO COM O CHECKLIST
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
  if not public.is_admin() then
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

grant execute on function public.refresh_property_documentation_status(uuid) to authenticated;

-- =========================================================
-- FIM DA VERSÃO 10.8
-- =========================================================
