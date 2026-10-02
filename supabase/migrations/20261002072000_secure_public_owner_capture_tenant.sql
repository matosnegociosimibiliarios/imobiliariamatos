create or replace function public.submit_public_owner_capture(p_organization_slug text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare v_org uuid; v_id uuid; v_name text:=trim(coalesce(p_payload->>'owner_name','')); v_phone text:=trim(coalesce(p_payload->>'whatsapp','')); v_city text:=trim(coalesce(p_payload->>'city_name','')); v_type text:=trim(coalesce(p_payload->>'property_type',''));
begin
 select id into v_org from public.organizations where slug=p_organization_slug and status in ('trial','active') limit 1;
 if v_org is null then raise exception 'Imobiliária indisponível.'; end if;
 if length(v_name)<2 or length(v_name)>120 or length(regexp_replace(v_phone,'\D','','g'))<10 or length(regexp_replace(v_phone,'\D','','g'))>15 or length(v_city)<2 or length(v_city)>120 or length(v_type)<2 or length(v_type)>80 then raise exception 'Dados inválidos.'; end if;
 insert into public.owner_captures(organization_id,owner_name,whatsapp,email,request_type,purpose,property_type,city_name,state_code,neighborhood_name,address_text,asking_value,description,source,session_id,consent_at)
 values(v_org,v_name,v_phone,nullif(trim(p_payload->>'email'),''),coalesce(nullif(p_payload->>'request_type',''),'listing'),coalesce(nullif(p_payload->>'purpose',''),'sale'),v_type,v_city,upper(coalesce(nullif(p_payload->>'state_code',''),'MG')),nullif(trim(p_payload->>'neighborhood_name'),''),nullif(trim(p_payload->>'address_text'),''),case when nullif(p_payload->>'asking_value','') is null then null else (p_payload->>'asking_value')::numeric end,nullif(trim(p_payload->>'description'),''),'site',nullif(p_payload->>'session_id',''),now()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.submit_public_owner_capture(text,jsonb) from public;
grant execute on function public.submit_public_owner_capture(text,jsonb) to anon,authenticated;
drop policy if exists public_insert_owner_captures on public.owner_captures;
revoke insert on table public.owner_captures from anon;
