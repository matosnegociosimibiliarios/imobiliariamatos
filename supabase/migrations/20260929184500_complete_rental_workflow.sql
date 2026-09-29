-- Completa o fluxo operacional de locação: interesse -> visita -> proposta -> análise -> contrato.
alter table public.rental_processes
  add column if not exists visit_at timestamptz,
  add column if not exists proposal_status text,
  add column if not exists proposal_notes text,
  add column if not exists analysis_decided_at timestamptz,
  add column if not exists contract_id uuid references public.rental_contracts(id) on delete set null;

do $$ begin
  alter table public.rental_processes add constraint rental_processes_proposal_status_check
    check (proposal_status is null or proposal_status in ('pending','accepted','rejected'));
exception when duplicate_object then null; end $$;

create index if not exists rental_processes_org_stage_idx on public.rental_processes(organization_id,stage,updated_at desc);
create index if not exists rental_processes_lead_property_idx on public.rental_processes(organization_id,lead_id,property_id);

create or replace function public.track_rental_process_stage()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' or old.stage is distinct from new.stage then
    insert into public.rental_stage_history(organization_id,rental_case_id,property_id,lead_id,from_stage,to_stage,changed_by)
    values(new.organization_id,new.id,new.property_id,new.lead_id,case when tg_op='INSERT' then null else old.stage end,new.stage,auth.uid());
  end if;
  return new;
end; $$;
revoke all on function public.track_rental_process_stage() from public,anon,authenticated;
drop trigger if exists rental_processes_stage_history on public.rental_processes;
create trigger rental_processes_stage_history after insert or update of stage on public.rental_processes
for each row execute function public.track_rental_process_stage();

create or replace function public.submit_public_lead(p_property_id uuid,p_name text,p_whatsapp text,p_email text default null,p_message text default null,p_source text default 'site',p_source_detail text default null,p_session_id text default null,p_landing_path text default null,p_source_platform text default 'site',p_source_channel text default 'form')
returns table(id uuid,reused boolean) language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_phone text; v_email text; v_existing boolean:=false; v_org uuid; v_org_count integer; v_is_rental boolean:=false;
begin
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Nome inválido'; end if;
  v_phone:=regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g');
  if length(v_phone)<10 or length(v_phone)>15 then raise exception 'WhatsApp inválido'; end if;
  v_email:=nullif(lower(trim(coalesce(p_email,''))),'');
  if p_property_id is not null then select p.organization_id,(p.purpose in ('rent','sale_and_rent')) into v_org,v_is_rental from public.properties p where p.id=p_property_id and p.deleted_at is null limit 1; end if;
  if v_org is null then
    select count(*) into v_org_count from public.organizations o where o.status='active';
    if v_org_count<>1 then raise exception 'Organization context is required'; end if;
    select o.id into v_org from public.organizations o where o.status='active' limit 1;
  end if;
  select l.id into v_id from public.leads l where l.organization_id=v_org and (regexp_replace(coalesce(l.whatsapp,''),'[^0-9]','','g')=v_phone or (v_email is not null and lower(trim(coalesce(l.email,'')))=v_email)) order by case when regexp_replace(coalesce(l.whatsapp,''),'[^0-9]','','g')=v_phone then 0 else 1 end,l.created_at asc limit 1;
  if v_id is not null then
    v_existing:=true;
    update public.leads set name=case when name like 'Contato Instagram %' then trim(p_name) else name end,whatsapp=coalesce(nullif(trim(whatsapp),''),trim(p_whatsapp)),email=coalesce(nullif(trim(email),''),v_email),property_id=coalesce(property_id,p_property_id),message=coalesce(nullif(trim(p_message),''),message),session_id=coalesce(session_id,p_session_id),landing_path=coalesce(landing_path,p_landing_path),last_source_platform=coalesce(nullif(trim(p_source_platform),''),'site'),last_source_channel=coalesce(nullif(trim(p_source_channel),''),'form'),last_source_detail=nullif(trim(p_source_detail),''),last_source_at=now(),updated_at=now() where public.leads.id=v_id and organization_id=v_org;
  else
    insert into public.leads(organization_id,property_id,name,whatsapp,email,message,source,source_detail,session_id,landing_path,source_platform,source_channel,initial_source_platform,initial_source_channel,initial_source_detail,last_source_platform,last_source_channel,last_source_detail,last_source_at,status)
    values(v_org,p_property_id,trim(p_name),trim(p_whatsapp),v_email,nullif(trim(p_message),''),p_source,p_source_detail,p_session_id,p_landing_path,coalesce(nullif(trim(p_source_platform),''),'site'),coalesce(nullif(trim(p_source_channel),''),'form'),coalesce(nullif(trim(p_source_platform),''),'site'),coalesce(nullif(trim(p_source_channel),''),'form'),nullif(trim(p_source_detail),''),coalesce(nullif(trim(p_source_platform),''),'site'),coalesce(nullif(trim(p_source_channel),''),'form'),nullif(trim(p_source_detail),''),now(),'new') returning public.leads.id into v_id;
  end if;
  if v_is_rental and p_property_id is not null and not exists(select 1 from public.rental_processes rp where rp.organization_id=v_org and rp.lead_id=v_id and rp.property_id=p_property_id and rp.stage not in ('lost','vacated')) then
    insert into public.rental_processes(organization_id,property_id,lead_id,stage,analysis_status,next_action_at) values(v_org,p_property_id,v_id,'interested','pending',now());
  end if;
  return query select v_id,v_existing;
end; $$;
revoke all on function public.submit_public_lead(uuid,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_public_lead(uuid,text,text,text,text,text,text,text,text,text,text) to anon,authenticated;


create or replace function public.sync_rental_property_status()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_purpose text;
begin
  select purpose into v_purpose from public.properties where id=new.property_id;
  if v_purpose in ('rent','sale_and_rent') then
    if new.status='awaiting_signature' then
      update public.properties set status='reserved' where id=new.property_id and status<>'reserved';
    elsif new.status in ('active','ending') then
      update public.properties set status='rented' where id=new.property_id and status<>'rented';
    elsif new.status in ('ended','cancelled') then
      update public.properties set status='published' where id=new.property_id and status in ('reserved','rented');
    end if;
  end if;
  if new.status in ('active','ending') then
    update public.rental_processes set stage='occupied' where contract_id=new.id and stage<>'occupied';
  elsif new.status='ended' then
    update public.rental_processes set stage='vacated' where contract_id=new.id and stage<>'vacated';
  elsif new.status='cancelled' then
    update public.rental_processes set stage='lost',lost_reason=coalesce(lost_reason,'Contrato cancelado') where contract_id=new.id and stage<>'lost';
  end if;
  return new;
end; $$;
revoke all on function public.sync_rental_property_status() from public,anon,authenticated;
