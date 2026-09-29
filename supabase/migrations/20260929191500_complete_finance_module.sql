alter table public.finance_entries add column if not exists source_key text;
create unique index if not exists finance_entries_org_source_key_uidx on public.finance_entries(organization_id,source_key) where source_key is not null;

create or replace function public.sync_deal_commission_finance()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_account uuid; v_category uuid; v_received numeric; v_pending numeric;
begin
  if new.organization_id is null then return new; end if;
  select id into v_account from public.finance_accounts where organization_id=new.organization_id and active order by created_at limit 1;
  if v_account is null then return new; end if;
  select id into v_category from public.finance_categories where organization_id=new.organization_id and active and direction in ('income','both') and name='Receita de vendas' limit 1;
  if v_category is null then insert into public.finance_categories(organization_id,name,direction) values(new.organization_id,'Receita de vendas','income') on conflict(organization_id,name) do update set active=true returning id into v_category; end if;
  v_received:=least(greatest(coalesce(new.commission_received_amount,0),0),greatest(coalesce(new.commission_value,0),0));
  v_pending:=greatest(coalesce(new.commission_value,0)-v_received,0);
  if v_received>0 then
    insert into public.finance_entries(organization_id,account_id,category_id,description,direction,amount,due_date,paid_at,status,property_id,deal_id,lead_id,notes,managed_funds,source_key)
    values(new.organization_id,v_account,v_category,'Comissão recebida - '||coalesce(new.code,'negócio'),'income',v_received,new.commission_due_date,coalesce(new.commission_received_at,now()),'paid',new.property_id,new.id,new.lead_id,'Sincronizado automaticamente com o negócio fechado.',false,'deal:'||new.id||':commission:received')
    on conflict(organization_id,source_key) where source_key is not null do update set amount=excluded.amount,due_date=excluded.due_date,paid_at=excluded.paid_at,status='paid',account_id=excluded.account_id,category_id=excluded.category_id,updated_at=now();
  else delete from public.finance_entries where organization_id=new.organization_id and source_key='deal:'||new.id||':commission:received'; end if;
  if v_pending>0 and new.status<>'cancelled' then
    insert into public.finance_entries(organization_id,account_id,category_id,description,direction,amount,due_date,status,property_id,deal_id,lead_id,notes,managed_funds,source_key)
    values(new.organization_id,v_account,v_category,'Comissão a receber - '||coalesce(new.code,'negócio'),'income',v_pending,new.commission_due_date,'pending',new.property_id,new.id,new.lead_id,'Sincronizado automaticamente com o negócio fechado.',false,'deal:'||new.id||':commission:pending')
    on conflict(organization_id,source_key) where source_key is not null do update set amount=excluded.amount,due_date=excluded.due_date,status='pending',account_id=excluded.account_id,category_id=excluded.category_id,updated_at=now();
  else delete from public.finance_entries where organization_id=new.organization_id and source_key='deal:'||new.id||':commission:pending'; end if;
  return new;
end; $$;
revoke all on function public.sync_deal_commission_finance() from public,anon,authenticated;
drop trigger if exists deals_sync_finance_commission on public.deals;
create trigger deals_sync_finance_commission after insert or update of commission_value,commission_received_amount,commission_due_date,commission_received_at,status on public.deals for each row execute function public.sync_deal_commission_finance();

create or replace function public.set_finance_entry_status(p_id uuid,p_status text)
returns public.finance_entries language plpgsql security definer set search_path=public as $$
declare v public.finance_entries; begin
 if not public.has_permission('financial.manage') then raise exception 'Permissão financial.manage necessária'; end if;
 if p_status not in('pending','paid','cancelled') then raise exception 'Status financeiro inválido'; end if;
 update public.finance_entries set status=p_status,paid_at=case when p_status='paid' then coalesce(paid_at,now()) else null end where id=p_id and organization_id=public.current_organization_id() returning * into v;
 if not found then raise exception 'Lançamento não encontrado'; end if; return v;
end; $$;
revoke all on function public.set_finance_entry_status(uuid,text) from public,anon;
grant execute on function public.set_finance_entry_status(uuid,text) to authenticated;

create or replace function public.finance_overview(p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb; begin
 if not public.has_permission('financial.view') then raise exception 'Permissão financial.view necessária'; end if;
 select jsonb_build_object('opening_balance',coalesce((select sum(opening_balance) from finance_accounts where organization_id=current_organization_id() and active),0),'income_paid',coalesce(sum(amount) filter(where direction='income' and status='paid' and not managed_funds),0),'expense_paid',coalesce(sum(amount) filter(where direction='expense' and status='paid' and not managed_funds),0),'income_pending',coalesce(sum(amount) filter(where direction='income' and status='pending' and not managed_funds),0),'expense_pending',coalesce(sum(amount) filter(where direction='expense' and status='pending' and not managed_funds),0),'overdue_income',coalesce(sum(amount) filter(where direction='income' and status='pending' and not managed_funds and due_date<current_date),0),'overdue_expense',coalesce(sum(amount) filter(where direction='expense' and status='pending' and not managed_funds and due_date<current_date),0),'managed_income',coalesce(sum(amount) filter(where direction='income' and status='paid' and managed_funds),0),'managed_expense',coalesce(sum(amount) filter(where direction='expense' and status='paid' and managed_funds),0)) into v from finance_entries where organization_id=current_organization_id() and coalesce(due_date,paid_at::date,created_at::date) between p_start_date and p_end_date and status<>'cancelled'; return v;
end; $$;
revoke all on function public.finance_overview(date,date) from public,anon;
grant execute on function public.finance_overview(date,date) to authenticated;