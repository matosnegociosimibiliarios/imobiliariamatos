drop trigger if exists rental_charge_calculate on public.rental_charges;
drop trigger if exists rental_charge_sync_transfer on public.rental_charges;
drop trigger if exists rental_contract_activation on public.rental_contracts;

drop function if exists public.apply_rental_adjustment(uuid,numeric,text,date,text);
drop function if exists public.generate_rental_charges(uuid);
drop function if exists public.refresh_rental_charge_statuses();
drop function if exists public.rental_charge_calculate_totals();
drop function if exists public.sync_rental_contract_activation();
drop function if exists public.sync_rental_transfer_from_charge();;
