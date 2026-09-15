create or replace function public.submit_public_lead(
  p_property_id uuid,
  p_name text,
  p_whatsapp text,
  p_email text default null,
  p_message text default null,
  p_source text default 'site',
  p_source_detail text default null,
  p_session_id text default null,
  p_landing_path text default null,
  p_source_platform text default 'site',
  p_source_channel text default 'form'
)
returns table(id uuid, reused boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_phone text;
  v_email text;
  v_existing boolean := false;
  v_org uuid;
  v_org_count integer;
begin
  if length(trim(coalesce(p_name,''))) < 2 then
    raise exception 'Nome inválido';
  end if;

  v_phone := regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g');
  if length(v_phone) < 10 or length(v_phone) > 15 then
    raise exception 'WhatsApp inválido';
  end if;

  v_email := nullif(lower(trim(coalesce(p_email,''))),'');

  if p_property_id is not null then
    select p.organization_id into v_org
    from public.properties p
    where p.id = p_property_id
      and p.deleted_at is null
    limit 1;
  end if;

  if v_org is null then
    select count(*) into v_org_count
    from public.organizations
    where status='active';

    if v_org_count <> 1 then
      raise exception 'Organization context is required';
    end if;

    select id into v_org
    from public.organizations
    where status='active'
    limit 1;
  end if;

  select l.id into v_id
  from public.leads l
  where l.organization_id = v_org
    and (
      regexp_replace(coalesce(l.whatsapp,''),'[^0-9]','','g') = v_phone
      or (v_email is not null and lower(trim(coalesce(l.email,''))) = v_email)
    )
  order by
    case when regexp_replace(coalesce(l.whatsapp,''),'[^0-9]','','g') = v_phone then 0 else 1 end,
    l.created_at asc
  limit 1;

  if v_id is not null then
    v_existing := true;
    update public.leads
    set name = case when name like 'Contato Instagram %' then trim(p_name) else name end,
        whatsapp = coalesce(nullif(trim(whatsapp),''),trim(p_whatsapp)),
        email = coalesce(nullif(trim(email),''),v_email),
        property_id = coalesce(property_id,p_property_id),
        message = coalesce(nullif(trim(message),''),nullif(trim(p_message),'')),
        session_id = coalesce(session_id,p_session_id),
        landing_path = coalesce(landing_path,p_landing_path),
        last_source_platform = coalesce(nullif(trim(p_source_platform),''),'site'),
        last_source_channel = coalesce(nullif(trim(p_source_channel),''),'form'),
        last_source_detail = nullif(trim(p_source_detail),''),
        last_source_at = now(),
        updated_at = now()
    where public.leads.id = v_id
      and public.leads.organization_id = v_org;
  else
    insert into public.leads(
      organization_id,property_id,name,whatsapp,email,message,source,source_detail,session_id,landing_path,
      source_platform,source_channel,initial_source_platform,initial_source_channel,initial_source_detail,
      last_source_platform,last_source_channel,last_source_detail,last_source_at,status
    ) values (
      v_org,p_property_id,trim(p_name),trim(p_whatsapp),v_email,nullif(trim(p_message),''),p_source,p_source_detail,
      p_session_id,p_landing_path,coalesce(nullif(trim(p_source_platform),''),'site'),
      coalesce(nullif(trim(p_source_channel),''),'form'),coalesce(nullif(trim(p_source_platform),''),'site'),
      coalesce(nullif(trim(p_source_channel),''),'form'),nullif(trim(p_source_detail),''),
      coalesce(nullif(trim(p_source_platform),''),'site'),coalesce(nullif(trim(p_source_channel),''),'form'),
      nullif(trim(p_source_detail),''),now(),'new'
    ) returning public.leads.id into v_id;
  end if;

  return query select v_id,v_existing;
end;
$$;

revoke all on function public.submit_public_lead(uuid,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_public_lead(uuid,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;;
