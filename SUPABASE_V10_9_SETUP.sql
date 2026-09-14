-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.9 - CENTRAL DE DOCUMENTOS E ARQUIVOS
-- =========================================================

-- 1. BUCKET PRIVADO PARA DOCUMENTOS DO CRM
insert into storage.buckets (id, name, public)
values ('crm-documents', 'crm-documents', false)
on conflict (id) do update set public = false;

-- 2. ARQUIVOS VINCULADOS AO CRM
create table if not exists public.crm_documents (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  category text not null default 'other'
    check (category in (
      'property','owner','buyer','seller','proposal','authorization',
      'contract','deed_registry','finance','personal','proof','other'
    )),
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','rejected')),

  notes text,
  original_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  issued_at date,
  expires_at date,

  property_id uuid references public.properties(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  capture_id uuid references public.owner_captures(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,

  property_document_id uuid references public.property_documents(id) on delete set null,
  capture_document_id uuid references public.capture_documents(id) on delete set null,
  deal_document_id uuid references public.deal_documents(id) on delete set null,

  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_documents_file_size_nonnegative
    check (file_size is null or file_size >= 0),
  constraint crm_documents_validity_order
    check (expires_at is null or issued_at is null or expires_at >= issued_at),
  constraint crm_documents_single_context
    check (num_nonnulls(property_id, lead_id, capture_id, proposal_id, deal_id) <= 1)
);

create index if not exists crm_documents_created_idx
on public.crm_documents(created_at desc);

create index if not exists crm_documents_status_idx
on public.crm_documents(status, created_at desc);

create index if not exists crm_documents_expiry_idx
on public.crm_documents(expires_at)
where expires_at is not null;

create index if not exists crm_documents_property_idx
on public.crm_documents(property_id)
where property_id is not null;

create index if not exists crm_documents_lead_idx
on public.crm_documents(lead_id)
where lead_id is not null;

create index if not exists crm_documents_capture_idx
on public.crm_documents(capture_id)
where capture_id is not null;

create index if not exists crm_documents_proposal_idx
on public.crm_documents(proposal_id)
where proposal_id is not null;

create index if not exists crm_documents_deal_idx
on public.crm_documents(deal_id)
where deal_id is not null;

alter table public.crm_documents enable row level security;

-- 3. UPDATED_AT E REVISÃO

drop trigger if exists crm_documents_touch_updated_at on public.crm_documents;
create trigger crm_documents_touch_updated_at
before update on public.crm_documents
for each row execute function public.touch_updated_at();

create or replace function public.apply_crm_document_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('approved','rejected') then
      new.reviewed_at := coalesce(new.reviewed_at, now());
      new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    end if;
  elsif old.status is distinct from new.status then
    if new.status in ('approved','rejected') then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    else
      new.reviewed_at := null;
      new.reviewed_by := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_documents_business_rules on public.crm_documents;
create trigger crm_documents_business_rules
before insert or update on public.crm_documents
for each row execute function public.apply_crm_document_rules();

-- 4. QUANDO UM ARQUIVO É ANEXADO A UM ITEM DO CHECKLIST,
--    MARCA ESSE ITEM COMO RECEBIDO SEM SOBRESCREVER VALIDAÇÃO.
create or replace function public.crm_document_mark_checklist_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.property_document_id is not null then
    update public.property_documents
       set status = 'received'
     where id = new.property_document_id
       and status = 'pending';
  end if;

  if new.capture_document_id is not null then
    update public.capture_documents
       set status = 'received'
     where id = new.capture_document_id
       and status = 'pending';
  end if;

  if new.deal_document_id is not null then
    update public.deal_documents
       set status = 'received'
     where id = new.deal_document_id
       and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists crm_documents_checklist_received on public.crm_documents;
create trigger crm_documents_checklist_received
after insert on public.crm_documents
for each row execute function public.crm_document_mark_checklist_received();

-- Quando o arquivo é conferido, também valida o item correspondente do checklist.
create or replace function public.crm_document_sync_review_to_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    if new.property_document_id is not null then
      update public.property_documents
         set status = 'validated'
       where id = new.property_document_id
         and status <> 'not_applicable';
    end if;

    if new.deal_document_id is not null then
      update public.deal_documents
         set status = 'validated'
       where id = new.deal_document_id
         and status <> 'not_applicable';
    end if;

    if new.capture_document_id is not null then
      update public.capture_documents
         set status = 'received'
       where id = new.capture_document_id
         and status <> 'not_applicable';
    end if;
  elsif new.status = 'rejected' and old.status is distinct from new.status then
    if new.property_document_id is not null then
      update public.property_documents
         set status = 'received'
       where id = new.property_document_id
         and status = 'validated';
    end if;

    if new.deal_document_id is not null then
      update public.deal_documents
         set status = 'received'
       where id = new.deal_document_id
         and status = 'validated';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_documents_sync_review on public.crm_documents;
create trigger crm_documents_sync_review
after update of status on public.crm_documents
for each row execute function public.crm_document_sync_review_to_checklist();

-- Mantém o resumo documental do imóvel sincronizado mesmo quando o status
-- do checklist muda automaticamente por causa de um anexo.
create or replace function public.sync_property_documentation_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;
  v_total integer;
  v_pending integer;
  v_complete integer;
begin
  if tg_op = 'DELETE' then
    v_property_id := old.property_id;
  else
    v_property_id := new.property_id;
  end if;

  select
    count(*),
    count(*) filter (where status = 'pending'),
    count(*) filter (where status in ('validated','not_applicable'))
  into v_total, v_pending, v_complete
  from public.property_documents
  where property_id = v_property_id;

  update public.property_management
     set documentation_status = case
       when v_total > 0 and v_complete = v_total then 'complete'
       when v_total = 0 or v_pending = v_total then 'pending'
       else 'partial'
     end
   where property_id = v_property_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists property_documents_sync_summary on public.property_documents;
create trigger property_documents_sync_summary
after insert or delete or update of status on public.property_documents
for each row execute function public.sync_property_documentation_summary();

-- 5. SE O ÚLTIMO ARQUIVO DE UM ITEM FOR EXCLUÍDO,
--    VOLTA PARA PENDENTE SOMENTE SE O ITEM ESTAVA APENAS COMO RECEBIDO.
create or replace function public.crm_document_restore_checklist_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.property_document_id is not null
     and not exists (
       select 1 from public.crm_documents
       where property_document_id = old.property_document_id
     ) then
    update public.property_documents
       set status = 'pending'
     where id = old.property_document_id
       and status = 'received';
  end if;

  if old.capture_document_id is not null
     and not exists (
       select 1 from public.crm_documents
       where capture_document_id = old.capture_document_id
     ) then
    update public.capture_documents
       set status = 'pending'
     where id = old.capture_document_id
       and status = 'received';
  end if;

  if old.deal_document_id is not null
     and not exists (
       select 1 from public.crm_documents
       where deal_document_id = old.deal_document_id
     ) then
    update public.deal_documents
       set status = 'pending'
     where id = old.deal_document_id
       and status = 'received';
  end if;

  return old;
end;
$$;

drop trigger if exists crm_documents_checklist_pending on public.crm_documents;
create trigger crm_documents_checklist_pending
after delete on public.crm_documents
for each row execute function public.crm_document_restore_checklist_pending();

-- 6. RLS DA TABELA

drop policy if exists "admin_manage_crm_documents" on public.crm_documents;
create policy "admin_manage_crm_documents"
on public.crm_documents
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 7. STORAGE PRIVADO: SOMENTE ADMINISTRADOR

drop policy if exists "admin_read_crm_documents_storage" on storage.objects;
drop policy if exists "admin_upload_crm_documents_storage" on storage.objects;
drop policy if exists "admin_update_crm_documents_storage" on storage.objects;
drop policy if exists "admin_delete_crm_documents_storage" on storage.objects;

create policy "admin_read_crm_documents_storage"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'crm-documents'
  and public.is_admin()
);

create policy "admin_upload_crm_documents_storage"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crm-documents'
  and public.is_admin()
);

create policy "admin_update_crm_documents_storage"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'crm-documents'
  and public.is_admin()
)
with check (
  bucket_id = 'crm-documents'
  and public.is_admin()
);

create policy "admin_delete_crm_documents_storage"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crm-documents'
  and public.is_admin()
);

-- 8. PERMISSÕES SQL

grant select, insert, update, delete on public.crm_documents to authenticated;

-- =========================================================
-- OBSERVAÇÃO
-- O bucket é PRIVADO. Os arquivos são abertos apenas por URL assinada
-- enquanto o administrador estiver autenticado.
-- =========================================================

-- =========================================================
-- FIM DA VERSÃO 10.9
-- =========================================================
