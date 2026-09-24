create unique index if not exists property_transactions_org_deal_uidx
on public.property_transactions(organization_id, deal_id)
where deal_id is not null;

create or replace function public.sync_completed_deal_property_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_price numeric;
  proposal_price numeric;
  listing_date date;
  close_date date;
  market_days integer;
begin
  if new.status <> 'completed' or new.property_id is null or new.organization_id is null then
    return new;
  end if;

  close_date := coalesce(new.completed_at::date, current_date);

  select p.sale_price, pm.listing_started_at
  into listing_price, listing_date
  from public.properties p
  left join public.property_management pm
    on pm.property_id = p.id
   and pm.organization_id = new.organization_id
  where p.id = new.property_id
    and p.organization_id = new.organization_id;

  select pr.proposal_value
  into proposal_price
  from public.proposals pr
  where pr.id = new.proposal_id
    and pr.organization_id = new.organization_id;

  if listing_date is not null then
    market_days := greatest(0, close_date - listing_date);
  end if;

  insert into public.property_transactions (
    organization_id, property_id, deal_id, transaction_type,
    listed_price, proposal_price, closed_price, listed_at, closed_at,
    days_on_market, notes
  )
  values (
    new.organization_id, new.property_id, new.id, 'sale',
    listing_price, proposal_price, new.sale_value, listing_date, close_date,
    market_days, 'Gerada automaticamente a partir do negócio concluído.'
  )
  on conflict (organization_id, deal_id)
  do update set
    listed_price = excluded.listed_price,
    proposal_price = excluded.proposal_price,
    closed_price = excluded.closed_price,
    listed_at = excluded.listed_at,
    closed_at = excluded.closed_at,
    days_on_market = excluded.days_on_market,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_completed_deal_property_transaction() from public;

drop trigger if exists deals_sync_property_transaction on public.deals;
create trigger deals_sync_property_transaction
after insert or update of status, sale_value, completed_at, property_id, proposal_id
on public.deals
for each row
execute function public.sync_completed_deal_property_transaction();
