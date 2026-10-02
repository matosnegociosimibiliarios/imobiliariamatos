create or replace function public.track_public_page_view(p_organization_slug text,p_session_id text,p_path text,p_page_type text default null,p_property_id uuid default null,p_referrer text default null,p_utm_source text default null,p_utm_medium text default null,p_utm_campaign text default null)
returns bigint language plpgsql security definer set search_path='public' as $$
declare v_org uuid; v_id bigint;
begin
 select id into v_org from public.organizations where slug=lower(trim(p_organization_slug)) and status in ('trial','active') limit 1;
 if v_org is null then raise exception 'Imobiliária indisponível'; end if;
 if p_property_id is not null and not exists(select 1 from public.properties where id=p_property_id and organization_id=v_org and status='published' and deleted_at is null) then raise exception 'Imóvel indisponível'; end if;
 insert into public.site_visits(organization_id,session_id,path,page_type,property_id,referrer,utm_source,utm_medium,utm_campaign)
 values(v_org,left(coalesce(p_session_id,''),120),left(coalesce(p_path,'/'),500),left(p_page_type,80),p_property_id,left(p_referrer,1000),left(p_utm_source,200),left(p_utm_medium,200),left(p_utm_campaign,200)) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.track_public_page_view(text,text,text,text,uuid,text,text,text,text) from public;
grant execute on function public.track_public_page_view(text,text,text,text,uuid,text,text,text,text) to anon,authenticated;

create or replace function public.track_public_event(p_organization_slug text,p_session_id text,p_event_type text,p_property_id uuid default null,p_path text default null,p_metadata jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path='public' as $$
declare v_org uuid; v_id bigint;
begin
 select id into v_org from public.organizations where slug=lower(trim(p_organization_slug)) and status in ('trial','active') limit 1;
 if v_org is null then raise exception 'Imobiliária indisponível'; end if;
 if length(trim(coalesce(p_event_type,'')))<1 or length(p_event_type)>100 then raise exception 'Evento inválido'; end if;
 if p_property_id is not null and not exists(select 1 from public.properties where id=p_property_id and organization_id=v_org and status='published' and deleted_at is null) then raise exception 'Imóvel indisponível'; end if;
 if pg_column_size(coalesce(p_metadata,'{}'::jsonb))>16384 then raise exception 'Metadados inválidos'; end if;
 insert into public.site_events(organization_id,session_id,event_type,property_id,path,metadata)
 values(v_org,left(coalesce(p_session_id,''),120),trim(p_event_type),p_property_id,left(p_path,500),coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.track_public_event(text,text,text,uuid,text,jsonb) from public;
grant execute on function public.track_public_event(text,text,text,uuid,text,jsonb) to anon,authenticated;

create or replace function public.submit_public_appointment(p_organization_slug text,p_lead_id uuid,p_property_id uuid default null,p_requested_date date default null,p_requested_time time default null)
returns uuid language plpgsql security definer set search_path='public' as $$
declare v_org uuid; v_id uuid;
begin
 select id into v_org from public.organizations where slug=lower(trim(p_organization_slug)) and status in ('trial','active') limit 1;
 if v_org is null then raise exception 'Imobiliária indisponível'; end if;
 if not exists(select 1 from public.leads where id=p_lead_id and organization_id=v_org) then raise exception 'Contato inválido'; end if;
 if p_property_id is not null and not exists(select 1 from public.properties where id=p_property_id and organization_id=v_org and status='published' and deleted_at is null) then raise exception 'Imóvel indisponível'; end if;
 insert into public.appointments(organization_id,lead_id,property_id,requested_date,requested_time,status)
 values(v_org,p_lead_id,p_property_id,p_requested_date,p_requested_time,'requested') returning id into v_id;
 return v_id;
end $$;
revoke all on function public.submit_public_appointment(text,uuid,uuid,date,time) from public;
grant execute on function public.submit_public_appointment(text,uuid,uuid,date,time) to anon,authenticated;

revoke insert on public.site_visits from anon;
revoke insert on public.site_events from anon;
revoke insert on public.appointments from anon;

revoke all on function public.submit_public_lead(text,uuid,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_public_lead(text,uuid,text,text,text,text,text,text,text,text,text,text) to anon,authenticated;
