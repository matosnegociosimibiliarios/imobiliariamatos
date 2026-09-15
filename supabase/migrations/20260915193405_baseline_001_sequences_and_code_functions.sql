create sequence if not exists public.deal_code_seq as bigint start 1 increment 1 minvalue 1 no maxvalue no cycle;
create sequence if not exists public.property_code_seq as bigint start 1 increment 1 minvalue 1 no maxvalue no cycle;
create sequence if not exists public.proposal_code_seq as bigint start 1 increment 1 minvalue 1 no maxvalue no cycle;
create sequence if not exists public.rental_contract_code_seq as bigint start 1 increment 1 minvalue 1 no maxvalue no cycle;

create or replace function public.next_deal_code()
returns text
language sql
set search_path to 'public'
as $function$
  select 'NEG-' || lpad(nextval('public.deal_code_seq')::text, 4, '0');
$function$;

create or replace function public.next_proposal_code()
returns text
language sql
set search_path to 'public'
as $function$
  select 'PROP-' || lpad(nextval('public.proposal_code_seq')::text, 4, '0');
$function$;;
