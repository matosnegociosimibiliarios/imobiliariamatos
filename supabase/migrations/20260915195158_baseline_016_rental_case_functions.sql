CREATE OR REPLACE FUNCTION public.apply_rental_case_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.stage is distinct from new.stage then
    new.stage_entered_at := now();
    insert into public.rental_stage_history(rental_case_id,property_id,lead_id,from_stage,to_stage,changed_by)
    values(new.id,new.property_id,new.lead_id,old.stage,new.stage,auth.uid());
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_new_rental_case()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  insert into public.rental_stage_history(rental_case_id,property_id,lead_id,from_stage,to_stage,changed_by)
  values(new.id,new.property_id,new.lead_id,null,new.stage,auth.uid());
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_rental_cases()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare affected integer:=0;
begin
  if not public.has_permission('properties.view') then raise exception 'Sem permissão para acessar locações.'; end if;
  insert into public.rental_cases(property_id,stage,active)
  select p.id,case when p.status='rented' then 'occupied' else 'available' end,true
  from public.properties p
  where p.deleted_at is null and p.purpose in('rent','sale_and_rent') and p.status in('published','rented')
  on conflict(property_id) do update set active=true,stage=case when excluded.stage='occupied' and public.rental_cases.stage in('available','interested','visit','proposal','screening','contract','vacated') then 'occupied' else public.rental_cases.stage end,updated_at=now();
  get diagnostics affected=row_count;
  update public.rental_cases rc set active=false,updated_at=now()
  where rc.active=true and not exists(select 1 from public.properties p where p.id=rc.property_id and p.deleted_at is null and p.purpose in('rent','sale_and_rent') and p.status in('published','rented'));
  return affected;
end;
$function$;

CREATE OR REPLACE FUNCTION public.move_rental_case(p_case_id uuid,p_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_case public.rental_cases%rowtype;
begin
  if not public.has_permission('properties.manage') then raise exception 'Sem permissão para alterar locações.'; end if;
  if p_stage not in('available','interested','visit','proposal','screening','contract','occupied','renewal','vacated') then raise exception 'Etapa de locação inválida.'; end if;
  update public.rental_cases set stage=p_stage where id=p_case_id and active=true returning * into v_case;
  if v_case.id is null then raise exception 'Locação não encontrada.'; end if;
  if p_stage='occupied' then update public.properties set status='rented' where id=v_case.property_id and status is distinct from 'rented';
  elsif p_stage in('available','vacated') then update public.properties set status='published' where id=v_case.property_id and status='rented'; end if;
  return jsonb_build_object('id',v_case.id,'stage',v_case.stage,'stage_entered_at',v_case.stage_entered_at,'updated_at',v_case.updated_at);
end;
$function$;;
