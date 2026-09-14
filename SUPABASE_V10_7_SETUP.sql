-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.7 - FECHAMENTO, DOCUMENTAÇÃO E COMISSÃO
-- =========================================================

-- 1. CÓDIGO DOS NEGÓCIOS
create sequence if not exists public.deal_code_seq start 1;

create or replace function public.next_deal_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'NEG-' || lpad(nextval('public.deal_code_seq')::text, 4, '0');
$$;

-- 2. NEGÓCIOS FECHADOS
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.next_deal_code(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  proposal_id uuid unique references public.proposals(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  status text not null default 'documents'
    check (status in ('documents','contract','financing','deed_registry','completed','cancelled')),
  sale_value numeric(14,2),
  commission_percent numeric(7,4),
  commission_value numeric(14,2),
  commission_payer text
    check (commission_payer is null or commission_payer in ('seller','buyer','both','other')),
  commission_status text not null default 'pending'
    check (commission_status in ('pending','partial','received')),
  commission_received_amount numeric(14,2) not null default 0,
  commission_due_date date,
  commission_received_at timestamptz,
  financing_required boolean not null default false,
  financing_status text not null default 'not_applicable'
    check (financing_status in ('not_applicable','pending','analysis','approved','rejected','contracted')),
  contract_status text not null default 'pending'
    check (contract_status in ('pending','sent','signed')),
  deed_status text not null default 'pending'
    check (deed_status in ('not_applicable','pending','scheduled','signed')),
  registry_status text not null default 'pending'
    check (registry_status in ('not_applicable','pending','submitted','completed')),
  pending_issues text,
  notes text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_sale_value_nonnegative check (sale_value is null or sale_value >= 0),
  constraint deals_commission_percent_range check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100)),
  constraint deals_commission_value_nonnegative check (commission_value is null or commission_value >= 0),
  constraint deals_commission_received_nonnegative check (commission_received_amount >= 0)
);

create index if not exists deals_status_idx on public.deals(status);
create index if not exists deals_property_idx on public.deals(property_id);
create index if not exists deals_commission_due_idx on public.deals(commission_due_date);
create index if not exists deals_commission_status_idx on public.deals(commission_status);
create index if not exists deals_created_at_idx on public.deals(created_at desc);

alter table public.deals enable row level security;

-- 3. CHECKLIST DE DOCUMENTOS
create table if not exists public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  party text not null check (party in ('buyer','seller','transaction')),
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
  unique(deal_id, party, doc_key)
);

create index if not exists deal_documents_deal_idx
on public.deal_documents(deal_id, party, display_order);

alter table public.deal_documents enable row level security;

-- 4. HISTÓRICO DO FECHAMENTO
create table if not exists public.deal_status_history (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists deal_status_history_deal_idx
on public.deal_status_history(deal_id, created_at desc);

alter table public.deal_status_history enable row level security;

-- 5. REGRAS AUTOMÁTICAS DO NEGÓCIO
create or replace function public.apply_deal_business_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.commission_percent is not null and new.sale_value is not null then
    if tg_op = 'INSERT' or new.commission_value is null then
      new.commission_value := round((new.sale_value * new.commission_percent / 100.0)::numeric, 2);
    elsif old.commission_percent is distinct from new.commission_percent
       or old.sale_value is distinct from new.sale_value then
      new.commission_value := round((new.sale_value * new.commission_percent / 100.0)::numeric, 2);
    end if;
  end if;

  if new.commission_received_amount is null then
    new.commission_received_amount := 0;
  end if;

  if coalesce(new.commission_value, 0) > 0
     and new.commission_received_amount >= new.commission_value then
    new.commission_status := 'received';
    new.commission_received_amount := new.commission_value;
    new.commission_received_at := coalesce(new.commission_received_at, now());
  elsif new.commission_received_amount > 0 then
    new.commission_status := 'partial';
    new.commission_received_at := null;
  else
    new.commission_status := 'pending';
    new.commission_received_at := null;
  end if;

  if not new.financing_required then
    new.financing_status := 'not_applicable';
  elsif new.financing_status = 'not_applicable' then
    new.financing_status := 'pending';
  end if;

  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.cancelled_at := null;
  elsif new.status = 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.completed_at := null;
  else
    new.completed_at := null;
    new.cancelled_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists deals_business_rules on public.deals;
create trigger deals_business_rules
before insert or update on public.deals
for each row execute function public.apply_deal_business_rules();

drop trigger if exists deals_touch_updated_at on public.deals;
create trigger deals_touch_updated_at
before update on public.deals
for each row execute function public.touch_updated_at();

drop trigger if exists deal_documents_touch_updated_at on public.deal_documents;
create trigger deal_documents_touch_updated_at
before update on public.deal_documents
for each row execute function public.touch_updated_at();

-- 6. DATAS AUTOMÁTICAS DOS DOCUMENTOS
create or replace function public.apply_deal_document_rules()
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

drop trigger if exists deal_documents_business_rules on public.deal_documents;
create trigger deal_documents_business_rules
before update on public.deal_documents
for each row execute function public.apply_deal_document_rules();

-- 7. CRIA O CHECKLIST PADRÃO AO ABRIR UM FECHAMENTO
create or replace function public.seed_deal_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deal_documents (deal_id, party, doc_key, label, display_order) values
    (new.id, 'buyer', 'personal_id', 'Documento de identificação', 10),
    (new.id, 'buyer', 'cpf', 'CPF', 20),
    (new.id, 'buyer', 'address', 'Comprovante de endereço', 30),
    (new.id, 'buyer', 'civil_status', 'Documento de estado civil', 40),
    (new.id, 'buyer', 'income', 'Comprovante de renda / financiamento', 50),
    (new.id, 'seller', 'personal_id', 'Documento de identificação', 10),
    (new.id, 'seller', 'cpf', 'CPF', 20),
    (new.id, 'seller', 'address', 'Comprovante de endereço', 30),
    (new.id, 'seller', 'civil_status', 'Documento de estado civil', 40),
    (new.id, 'seller', 'property_registration', 'Matrícula atualizada do imóvel', 50),
    (new.id, 'seller', 'property_encumbrances', 'Certidão / situação de ônus do imóvel', 60),
    (new.id, 'seller', 'municipal_taxes', 'Situação de IPTU / tributos do imóvel', 70),
    (new.id, 'transaction', 'purchase_contract', 'Contrato / compromisso de compra e venda', 10),
    (new.id, 'transaction', 'financing', 'Documentação do financiamento', 20),
    (new.id, 'transaction', 'deed', 'Escritura', 30),
    (new.id, 'transaction', 'registry', 'Registro do imóvel', 40)
  on conflict (deal_id, party, doc_key) do nothing;

  return new;
end;
$$;

drop trigger if exists deals_seed_documents on public.deals;
create trigger deals_seed_documents
after insert on public.deals
for each row execute function public.seed_deal_documents();

-- 8. HISTÓRICO AUTOMÁTICO
create or replace function public.log_deal_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.deal_status_history (deal_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.deal_status_history (deal_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists deals_status_history_trigger on public.deals;
create trigger deals_status_history_trigger
after insert or update of status on public.deals
for each row execute function public.log_deal_status_change();

-- 9. SINCRONIZA O NEGÓCIO COM CLIENTE E IMÓVEL
create or replace function public.sync_deal_entities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purpose text;
begin
  if new.status <> 'cancelled' then
    update public.leads
       set status = 'won',
           deal_value = new.sale_value,
           commission_value = new.commission_value,
           closed_at = coalesce(closed_at, now()),
           next_action_at = null,
           next_action_text = null
     where id = new.lead_id;
  end if;

  if new.status = 'completed' and new.property_id is not null then
    select purpose into v_purpose from public.properties where id = new.property_id;

    update public.properties
       set status = case when v_purpose = 'rent' then 'rented' else 'sold' end
     where id = new.property_id;
  end if;

  return new;
end;
$$;

drop trigger if exists deals_sync_entities_trigger on public.deals;
create trigger deals_sync_entities_trigger
after insert or update on public.deals
for each row execute function public.sync_deal_entities();

-- 10. CRIAR/RECUPERAR FECHAMENTO A PARTIR DE UMA PROPOSTA ACEITA
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
  if not public.is_admin() then
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

-- 11. MÉTRICAS DE FECHAMENTO E COMISSÃO
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
  if not public.is_admin() then
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

-- 12. POLÍTICAS

drop policy if exists "admin_manage_deals" on public.deals;
create policy "admin_manage_deals"
on public.deals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_manage_deal_documents" on public.deal_documents;
create policy "admin_manage_deal_documents"
on public.deal_documents
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_read_deal_history" on public.deal_status_history;
create policy "admin_read_deal_history"
on public.deal_status_history
for select
to authenticated
using (public.is_admin());

-- 13. BACKFILL: NEGÓCIOS JÁ FECHADOS ANTES DA V10.7
insert into public.deals (
  lead_id,
  proposal_id,
  property_id,
  sale_value,
  commission_percent,
  commission_value,
  created_at
)
select
  l.id,
  p.id,
  coalesce(p.property_id, l.property_id),
  coalesce(p.proposal_value, l.deal_value),
  case
    when coalesce(p.proposal_value, l.deal_value, 0) > 0 and coalesce(l.commission_value, 0) > 0
      then round((l.commission_value / coalesce(p.proposal_value, l.deal_value)) * 100.0, 4)
    else null
  end,
  l.commission_value,
  coalesce(l.closed_at, now())
from public.leads l
left join lateral (
  select p1.*
  from public.proposals p1
  where p1.lead_id = l.id
    and p1.status = 'accepted'
  order by p1.accepted_at desc nulls last, p1.updated_at desc
  limit 1
) p on true
where l.status = 'won'
  and not exists (select 1 from public.deals d where d.lead_id = l.id)
on conflict (lead_id) do nothing;

-- 14. PERMISSÕES
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update, delete on public.deal_documents to authenticated;
grant select on public.deal_status_history to authenticated;
grant usage, select on sequence public.deal_code_seq to authenticated;
grant usage, select on sequence public.deal_status_history_id_seq to authenticated;
grant execute on function public.admin_create_deal_from_proposal(uuid) to authenticated;
grant execute on function public.admin_deal_metrics(integer) to authenticated;

-- =========================================================
-- FIM - V10.7
-- =========================================================
