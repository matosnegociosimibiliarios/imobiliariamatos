revoke all on function public.set_rental_contract_lifecycle(uuid,text,timestamptz) from public, anon;
grant execute on function public.set_rental_contract_lifecycle(uuid,text,timestamptz) to authenticated;

revoke all on function public.apply_rental_adjustment(uuid,text,numeric,date,text) from public, anon;
grant execute on function public.apply_rental_adjustment(uuid,text,numeric,date,text) to authenticated;

revoke all on function public.record_rental_collection_action(uuid,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.record_rental_collection_action(uuid,text,text,text,text,timestamptz) to authenticated;

revoke all on function public.update_rental_transfer_expenses(uuid,numeric,text) from public, anon;
grant execute on function public.update_rental_transfer_expenses(uuid,numeric,text) to authenticated;
