-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.6 - PROPOSTAS E ACOMPANHAMENTO COMERCIAL
-- =========================================================

-- 1. CÓDIGO SEQUENCIAL DAS PROPOSTAS
create sequence if not exists public.proposal_code_seq start 1;

create or replace function public.next_proposal_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'PROP-' || lpad(nextval('public.proposal_code_seq')::text, 4, '0');
$$;

-- 2. PROPOSTAS
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.next_proposal_code(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','sent','negotiation','accepted','rejected','expired')),
  proposal_value numeric(14,2),
  payment_terms text,
  conditions text,
  valid_until date,
  next_follow_up_text text,
  next_follow_up_at timestamptz,
  rejection_reason text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposals_value_nonnegative check (proposal_value is null or proposal_value >= 0)
);

create index if not exists proposals_lead_idx on public.proposals(lead_id);
create index if not exists proposals_property_idx on public.proposals(property_id);
create index if not exists proposals_status_idx on public.proposals(status);
create index if not exists proposals_valid_until_idx on public.proposals(valid_until);
create index if not exists proposals_next_follow_up_idx on public.proposals(next_follow_up_at);

alter table public.proposals enable row level security;

-- 3. HISTÓRICO DE STATUS DA PROPOSTA
create table if not exists public.proposal_status_history (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists proposal_status_history_proposal_idx
on public.proposal_status_history(proposal_id, created_at desc);

alter table public.proposal_status_history enable row level security;

-- 4. REGRAS AUTOMÁTICAS DA PROPOSTA
create or replace function public.apply_proposal_business_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  status_changed boolean;
begin
  if tg_op = 'INSERT' then
    status_changed := true;
  else
    status_changed := old.status is distinct from new.status;
  end if;

  if new.status = 'sent' and status_changed then
    new.sent_at := coalesce(new.sent_at, now());
  end if;

  if new.status = 'accepted' and status_changed then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.rejected_at := null;
    new.rejection_reason := null;
    new.next_follow_up_at := null;
    new.next_follow_up_text := null;
  elsif new.status = 'rejected' and status_changed then
    new.rejected_at := coalesce(new.rejected_at, now());
    new.accepted_at := null;
    new.next_follow_up_at := null;
    new.next_follow_up_text := null;
  elsif new.status = 'expired' and status_changed then
    new.next_follow_up_at := null;
    new.next_follow_up_text := null;
  end if;

  if new.status <> 'rejected' then
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists proposals_business_rules on public.proposals;
create trigger proposals_business_rules
before insert or update on public.proposals
for each row execute function public.apply_proposal_business_rules();

-- Mantém updated_at em dia usando a função já existente no projeto.
drop trigger if exists proposals_touch_updated_at on public.proposals;
create trigger proposals_touch_updated_at
before update on public.proposals
for each row execute function public.touch_updated_at();

-- 5. HISTÓRICO AUTOMÁTICO
create or replace function public.log_proposal_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.proposal_status_history (
      proposal_id, from_status, to_status, changed_by
    ) values (
      new.id, null, new.status, auth.uid()
    );
  elsif old.status is distinct from new.status then
    insert into public.proposal_status_history (
      proposal_id, from_status, to_status, changed_by
    ) values (
      new.id, old.status, new.status, auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists proposals_status_history_trigger on public.proposals;
create trigger proposals_status_history_trigger
after insert or update of status on public.proposals
for each row execute function public.log_proposal_status_change();

-- 6. QUANDO A PROPOSTA AVANÇA, COLOCA O CLIENTE NA ETAPA PROPOSTA
create or replace function public.sync_lead_from_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('sent','negotiation','accepted') then
    update public.leads
       set status = 'proposal'
     where id = new.lead_id
       and status not in ('won','lost');
  end if;

  return new;
end;
$$;

drop trigger if exists proposals_sync_lead_trigger on public.proposals;
create trigger proposals_sync_lead_trigger
after insert or update of status on public.proposals
for each row execute function public.sync_lead_from_proposal();

-- 7. POLÍTICAS

drop policy if exists "admin_manage_proposals" on public.proposals;
create policy "admin_manage_proposals"
on public.proposals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_read_proposal_history" on public.proposal_status_history;
create policy "admin_read_proposal_history"
on public.proposal_status_history
for select
to authenticated
using (public.is_admin());

-- 8. ATUALIZAR PROPOSTAS VENCIDAS
create or replace function public.admin_refresh_expired_proposals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_admin() then
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

-- 9. MÉTRICAS COMERCIAIS DAS PROPOSTAS
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
  if not public.is_admin() then
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

-- 10. PERMISSÕES

grant select, insert, update, delete on public.proposals to authenticated;
grant select on public.proposal_status_history to authenticated;
grant usage, select on sequence public.proposal_code_seq to authenticated;
grant usage, select on sequence public.proposal_status_history_id_seq to authenticated;
grant execute on function public.admin_refresh_expired_proposals() to authenticated;
grant execute on function public.admin_proposal_metrics(integer) to authenticated;

-- =========================================================
-- FIM - V10.6
-- =========================================================
