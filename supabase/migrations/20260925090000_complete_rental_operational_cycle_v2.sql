-- Complete rental operational cycle: lifecycle, adjustments, collection and transfer controls

create or replace function public.set_rental_contract_lifecycle(
  p_contract_id uuid,
  p_action text,
  p_at timestamptz default now()
)
returns public.rental_contracts
language plpgsql
security definer
set search_path = public
as $$
declare v_contract public.rental_contracts;
begin
  if not public.has_permission('rentals.manage') then raise exception 'Permissão rentals.manage necessária'; end if;
  select * into v_contract from public.rental_contracts where id=p_contract_id and organization_id=public.current_organization_id() for update;
  if not found then raise exception 'Contrato não encontrado'; end if;
  if p_action='mark_signed' then
    update public.rental_contracts set signed_at=coalesce(p_at,now()),status='active' where id=p_contract_id returning * into v_contract;
  elsif p_action='move_in' then
    update public.rental_contracts set move_in_at=coalesce(p_at,now()),status='active' where id=p_contract_id returning * into v_contract;
  elsif p_action='move_out' then
    update public.rental_contracts set move_out_at=coalesce(p_at,now()),status='ended' where id=p_contract_id returning * into v_contract;
  elsif p_action='mark_ending' then
    update public.rental_contracts set status='ending' where id=p_contract_id returning * into v_contract;
  elsif p_action='reactivate' then
    update public.rental_contracts set status='active' where id=p_contract_id returning * into v_contract;
  elsif p_action='cancel' then
    update public.rental_contracts set status='cancelled' where id=p_contract_id returning * into v_contract;
  else raise exception 'Ação de ciclo de locação inválida: %',p_action;
  end if;
  return v_contract;
end;
$$;

create or replace function public.apply_rental_adjustment(
  p_contract_id uuid,p_index_name text,p_index_percent numeric,p_effective_date date,p_notes text default null
)
returns public.rental_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare v_contract public.rental_contracts; v_previous numeric(14,2); v_new numeric(14,2); v_adjustment public.rental_adjustments;
begin
  if not public.has_permission('rentals.manage') then raise exception 'Permissão rentals.manage necessária'; end if;
  if p_index_percent is null or p_index_percent < -100 or p_index_percent > 100 then raise exception 'Percentual de reajuste inválido'; end if;
  if p_effective_date is null then raise exception 'Informe a data de vigência'; end if;
  select * into v_contract from public.rental_contracts where id=p_contract_id and organization_id=public.current_organization_id() for update;
  if not found then raise exception 'Contrato não encontrado'; end if;
  if v_contract.monthly_rent is null then raise exception 'Contrato sem aluguel mensal'; end if;
  if v_contract.status not in ('active','ending') then raise exception 'O reajuste só pode ser aplicado em contrato ativo ou em encerramento'; end if;
  v_previous:=round(v_contract.monthly_rent,2); v_new:=round(v_previous*(1+p_index_percent/100.0),2);
  insert into public.rental_adjustments(organization_id,contract_id,index_name,index_percent,previous_rent,new_rent,effective_date,notes)
  values(v_contract.organization_id,v_contract.id,trim(p_index_name),p_index_percent,v_previous,v_new,p_effective_date,nullif(trim(p_notes),''))
  returning * into v_adjustment;
  update public.rental_contracts set monthly_rent=v_new,next_adjustment_date=p_effective_date+interval '1 year' where id=p_contract_id;
  update public.rental_payments set rent_amount=v_new,management_fee=round(v_new*coalesce(v_contract.administration_fee_percent,0)/100.0,2),updated_at=now()
  where contract_id=p_contract_id and reference_month>=date_trunc('month',p_effective_date)::date and coalesce(paid_amount,0)=0 and status in ('pending','overdue');
  return v_adjustment;
end;
$$;

create or replace function public.record_rental_collection_action(
  p_charge_id uuid,p_channel text default 'whatsapp',p_notes text default null,p_agreement_text text default null,p_installment_plan text default null,p_next_contact_at timestamptz default null
)
returns public.rental_collection_actions
language plpgsql
security definer
set search_path = public
as $$
declare v_charge public.rental_charges; v_action public.rental_collection_actions;
begin
  if not public.has_permission('rentals.manage') then raise exception 'Permissão rentals.manage necessária'; end if;
  select * into v_charge from public.rental_charges where id=p_charge_id and organization_id=public.current_organization_id();
  if not found then raise exception 'Cobrança não encontrada'; end if;
  if v_charge.status='paid' then raise exception 'Não é necessário cobrar uma cobrança já paga'; end if;
  insert into public.rental_collection_actions(organization_id,charge_id,channel,notes,agreement_text,installment_plan,next_contact_at)
  values(v_charge.organization_id,v_charge.id,coalesce(nullif(trim(p_channel),''),'whatsapp'),nullif(trim(p_notes),''),nullif(trim(p_agreement_text),''),nullif(trim(p_installment_plan),''),p_next_contact_at)
  returning * into v_action;
  return v_action;
end;
$$;

create or replace function public.update_rental_transfer_expenses(
  p_transfer_id uuid,p_other_expenses numeric,p_notes text default null
)
returns public.rental_transfers
language plpgsql
security definer
set search_path = public
as $$
declare v_transfer public.rental_transfers;
begin
  if not public.has_permission('rentals.manage') then raise exception 'Permissão rentals.manage necessária'; end if;
  if coalesce(p_other_expenses,0)<0 then raise exception 'Despesas não podem ser negativas'; end if;
  select * into v_transfer from public.rental_transfers where id=p_transfer_id and organization_id=public.current_organization_id() for update;
  if not found then raise exception 'Repasse não encontrado'; end if;
  if v_transfer.status='paid' then raise exception 'Não altere despesas de um repasse já baixado'; end if;
  update public.rental_transfers set other_expenses=coalesce(p_other_expenses,0),notes=coalesce(nullif(trim(p_notes),''),notes) where id=p_transfer_id returning * into v_transfer;
  return v_transfer;
end;
$$;

grant execute on function public.set_rental_contract_lifecycle(uuid,text,timestamptz) to authenticated;
grant execute on function public.apply_rental_adjustment(uuid,text,numeric,date,text) to authenticated;
grant execute on function public.record_rental_collection_action(uuid,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.update_rental_transfer_expenses(uuid,numeric,text) to authenticated;
