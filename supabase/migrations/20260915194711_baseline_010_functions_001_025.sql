CREATE OR REPLACE FUNCTION public.prepare_property()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  next_number bigint;
  slug_base text;
begin
  if new.code is null or trim(new.code) = '' then
    next_number := nextval('public.property_code_seq');
    if next_number < 10000 then new.code := 'MAT-' || lpad(next_number::text, 4, '0'); else new.code := 'MAT-' || next_number::text; end if;
  end if;
  if new.slug is null or trim(new.slug) = '' then
    slug_base := translate(lower(coalesce(new.title, 'imovel')),'áàãâäéèêëíìîïóòõôöúùûüç','aaaaaeeeeiiiiooooouuuuc');
    slug_base := regexp_replace(slug_base,'[^a-z0-9]+','-','g');
    slug_base := trim(both '-' from slug_base);
    new.slug := slug_base || '-' || lower(new.code);
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, 'user')
  on conflict (id) do update set email=excluded.email, full_name=case when coalesce(public.profiles.full_name,'')='' then excluded.full_name else public.profiles.full_name end, updated_at=now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger LANGUAGE plpgsql
AS $function$ begin new.updated_at := now(); return new; end; $function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics(days_back integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare start_at timestamptz; visits_count bigint; unique_visitors_count bigint; leads_count bigint; appointments_count bigint; proposal_count bigint; won_count bigint; captures_count bigint; capture_new_count bigint; capture_authorized_count bigint; capture_published_count bigint; visitor_to_lead_rate numeric; lead_to_appointment_rate numeric; lead_to_won_rate numeric; won_value numeric; commission_value numeric;
begin
  if not public.has_permission('dashboard.view') then raise exception 'not authorized'; end if;
  start_at:=now()-make_interval(days=>greatest(days_back,1));
  select count(*) into visits_count from public.site_visits where created_at>=start_at;
  select count(distinct session_id) into unique_visitors_count from public.site_visits where created_at>=start_at;
  select count(*) into leads_count from public.leads where created_at>=start_at;
  select count(*) into appointments_count from public.appointments where created_at>=start_at;
  select count(*) into proposal_count from public.leads where created_at>=start_at and status='proposal';
  select count(*) into won_count from public.leads where created_at>=start_at and status='won';
  select count(*) into captures_count from public.owner_captures where created_at>=start_at;
  select count(*) into capture_new_count from public.owner_captures where created_at>=start_at and status='new';
  select count(*) into capture_authorized_count from public.owner_captures where created_at>=start_at and status='authorized';
  select count(*) into capture_published_count from public.owner_captures where created_at>=start_at and status='published';
  select coalesce(sum(deal_value),0) into won_value from public.leads where created_at>=start_at and status='won';
  select coalesce(sum(commission_value),0) into commission_value from public.leads where created_at>=start_at and status='won';
  visitor_to_lead_rate:=case when unique_visitors_count=0 then 0 else round((leads_count::numeric/unique_visitors_count::numeric)*100,2) end;
  lead_to_appointment_rate:=case when leads_count=0 then 0 else round((appointments_count::numeric/leads_count::numeric)*100,2) end;
  lead_to_won_rate:=case when leads_count=0 then 0 else round((won_count::numeric/leads_count::numeric)*100,2) end;
  return jsonb_build_object('visits',visits_count,'unique_visitors',unique_visitors_count,'leads',leads_count,'appointments',appointments_count,'proposals',proposal_count,'won',won_count,'visitor_to_lead_rate',visitor_to_lead_rate,'lead_to_appointment_rate',lead_to_appointment_rate,'lead_to_won_rate',lead_to_won_rate,'won_value',won_value,'commission_value',commission_value,'captures',captures_count,'capture_new',capture_new_count,'capture_authorized',capture_authorized_count,'capture_published',capture_published_count);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_lead_sources(days_back integer DEFAULT 30)
 RETURNS TABLE(source text,total bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select coalesce(nullif(trim(source),''),'site') as source,count(*)::bigint as total from public.leads where created_at>=now()-make_interval(days=>greatest(days_back,1)) and public.has_permission('analytics.view') group by 1 order by 2 desc; $function$;

CREATE OR REPLACE FUNCTION public.admin_top_lead_properties(days_back integer DEFAULT 30)
 RETURNS TABLE(property_id uuid,code text,title text,total bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select p.id,p.code,p.title,count(l.id)::bigint from public.leads l join public.properties p on p.id=l.property_id where l.created_at>=now()-make_interval(days=>greatest(days_back,1)) and public.has_permission('analytics.view') group by p.id,p.code,p.title order by count(l.id) desc limit 10; $function$;

CREATE OR REPLACE FUNCTION public.apply_lead_business_rules()
 RETURNS trigger LANGUAGE plpgsql
AS $function$ begin if new.status='won' and old.status is distinct from 'won' then new.closed_at:=coalesce(new.closed_at,now()); new.next_action_at:=null; new.next_action_text:=null; elsif new.status<>'won' and old.status='won' then new.closed_at:=null; end if; if new.status='lost' then new.next_action_at:=null; new.next_action_text:=null; end if; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.log_lead_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ begin if old.status is distinct from new.status then insert into public.lead_status_history(lead_id,from_status,to_status,changed_by) values(new.id,old.status,new.status,auth.uid()); end if; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.admin_lost_reasons(days_back integer DEFAULT 90)
 RETURNS TABLE(reason text,total bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select coalesce(nullif(trim(lost_reason),''),'Não informado') as reason,count(*)::bigint as total from public.leads where created_at>=now()-make_interval(days=>greatest(days_back,1)) and status='lost' and public.has_permission('analytics.view') group by 1 order by 2 desc; $function$;

CREATE OR REPLACE FUNCTION public.apply_capture_business_rules()
 RETURNS trigger LANGUAGE plpgsql
AS $function$ begin if new.status in ('published','lost') then new.next_action_at:=null; new.next_action_text:=null; end if; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.log_capture_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ begin if old.status is distinct from new.status then insert into public.capture_status_history(capture_id,from_status,to_status,changed_by) values(new.id,old.status,new.status,auth.uid()); end if; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.admin_acquisition_metrics(days_back integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ declare start_at timestamptz; whatsapp_clicks bigint; lead_submits bigint; appointment_submits bigint; capture_submits bigint; share_clicks bigint; search_clicks bigint; instagram_direct_leads bigint; meta_lead_ads bigint; begin if not public.has_permission('analytics.view') then raise exception 'not authorized'; end if; start_at:=now()-make_interval(days=>greatest(days_back,1)); select count(*) into whatsapp_clicks from public.site_events where created_at>=start_at and event_type='whatsapp_click'; select count(*) into lead_submits from public.site_events where created_at>=start_at and event_type='lead_submit'; select count(*) into appointment_submits from public.site_events where created_at>=start_at and event_type='appointment_submit'; select count(*) into capture_submits from public.site_events where created_at>=start_at and event_type='capture_submit'; select count(*) into share_clicks from public.site_events where created_at>=start_at and event_type='share_click'; select count(*) into search_clicks from public.site_events where created_at>=start_at and event_type='search_click'; select count(*) into instagram_direct_leads from public.leads where created_at>=start_at and source_platform='instagram' and source_channel='direct'; select count(*) into meta_lead_ads from public.leads where created_at>=start_at and source_channel='lead_ads'; return jsonb_build_object('whatsapp_clicks',whatsapp_clicks,'lead_submits',lead_submits,'appointment_submits',appointment_submits,'capture_submits',capture_submits,'share_clicks',share_clicks,'search_clicks',search_clicks,'instagram_direct_leads',instagram_direct_leads,'meta_lead_ads',meta_lead_ads); end; $function$;

CREATE OR REPLACE FUNCTION public.admin_integration_metrics(days_back integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ declare start_at timestamptz; direct_count bigint; ads_count bigint; instagram_inbound bigint; instagram_outbound bigint; instagram_unread bigint; whatsapp_leads bigint; whatsapp_inbound bigint; whatsapp_outbound bigint; whatsapp_unread bigint; last_event timestamptz; begin if not public.is_admin() then raise exception 'not authorized'; end if; start_at:=now()-make_interval(days=>greatest(days_back,1)); select count(*) into direct_count from public.leads where created_at>=start_at and source_platform='instagram' and source_channel='direct'; select count(*) into ads_count from public.leads where created_at>=start_at and source_channel='lead_ads'; select count(*) into instagram_inbound from public.social_messages where created_at>=start_at and platform='instagram' and direction='inbound'; select count(*) into instagram_outbound from public.social_messages where created_at>=start_at and platform='instagram' and direction='outbound'; select coalesce(sum(instagram_unread_count),0)::bigint into instagram_unread from public.leads; select count(*) into whatsapp_leads from public.leads where created_at>=start_at and whatsapp_wa_id is not null; select count(*) into whatsapp_inbound from public.social_messages where created_at>=start_at and platform='whatsapp' and direction='inbound'; select count(*) into whatsapp_outbound from public.social_messages where created_at>=start_at and platform='whatsapp' and direction='outbound'; select coalesce(sum(whatsapp_unread_count),0)::bigint into whatsapp_unread from public.leads; select max(created_at) into last_event from public.integration_events where platform='meta'; return jsonb_build_object('instagram_direct_leads',direct_count,'lead_ads_leads',ads_count,'instagram_messages',instagram_inbound,'instagram_sent_messages',instagram_outbound,'instagram_unread_messages',instagram_unread,'whatsapp_leads',whatsapp_leads,'whatsapp_messages',whatsapp_inbound,'whatsapp_sent_messages',whatsapp_outbound,'whatsapp_unread_messages',whatsapp_unread,'last_meta_event_at',last_event); end; $function$;

CREATE OR REPLACE FUNCTION public.sync_social_message_to_lead()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ declare message_at timestamptz; begin message_at:=coalesce(new.sent_at,new.created_at,now()); if new.direction='inbound' then update public.leads set last_inbound_message=new.message_text,last_inbound_at=message_at,last_message_at=message_at,social_unread_count=social_unread_count+1,instagram_unread_count=instagram_unread_count+case when new.platform='instagram' then 1 else 0 end,whatsapp_unread_count=whatsapp_unread_count+case when new.platform='whatsapp' then 1 else 0 end,updated_at=now() where id=new.lead_id; else update public.leads set last_outbound_message=new.message_text,last_outbound_at=message_at,last_message_at=message_at,updated_at=now() where id=new.lead_id; end if; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.mark_social_messages_read(p_lead_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ begin if not public.is_admin() then raise exception 'not authorized'; end if; update public.social_messages set read_at=now() where lead_id=p_lead_id and direction='inbound' and read_at is null; update public.leads set social_unread_count=0,updated_at=now() where id=p_lead_id; end; $function$;

CREATE OR REPLACE FUNCTION public.track_lead_source_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ begin if tg_op='INSERT' then if new.initial_source_platform is not null then insert into public.lead_source_history(lead_id,platform,channel,detail,touch_type,occurred_at) values(new.id,new.initial_source_platform,new.initial_source_channel,new.initial_source_detail,'initial',coalesce(new.created_at,now())); end if; elsif old.last_source_platform is distinct from new.last_source_platform or old.last_source_channel is distinct from new.last_source_channel or old.last_source_detail is distinct from new.last_source_detail then if new.last_source_platform is not null then insert into public.lead_source_history(lead_id,platform,channel,detail,touch_type,occurred_at) values(new.id,new.last_source_platform,new.last_source_channel,new.last_source_detail,'touch',coalesce(new.last_source_at,now())); end if; end if; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.submit_public_lead(p_property_id uuid,p_name text,p_whatsapp text,p_email text DEFAULT NULL::text,p_message text DEFAULT NULL::text,p_source text DEFAULT 'site'::text,p_source_detail text DEFAULT NULL::text,p_session_id text DEFAULT NULL::text,p_landing_path text DEFAULT NULL::text,p_source_platform text DEFAULT 'site'::text,p_source_channel text DEFAULT 'form'::text)
 RETURNS TABLE(id uuid,reused boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ declare v_id uuid; v_phone text; v_email text; v_existing boolean:=false; begin if length(trim(coalesce(p_name,'')))<2 then raise exception 'Nome inválido'; end if; v_phone:=regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g'); if length(v_phone)<10 or length(v_phone)>15 then raise exception 'WhatsApp inválido'; end if; v_email:=nullif(lower(trim(coalesce(p_email,''))),''); select l.id into v_id from public.leads l where regexp_replace(coalesce(l.whatsapp,''),'[^0-9]','','g')=v_phone or (v_email is not null and lower(trim(coalesce(l.email,'')))=v_email) order by case when regexp_replace(coalesce(l.whatsapp,''),'[^0-9]','','g')=v_phone then 0 else 1 end,l.created_at asc limit 1; if v_id is not null then v_existing:=true; update public.leads set name=case when name like 'Contato Instagram %' then trim(p_name) else name end,whatsapp=coalesce(nullif(trim(whatsapp),''),trim(p_whatsapp)),email=coalesce(nullif(trim(email),''),v_email),property_id=coalesce(property_id,p_property_id),message=coalesce(nullif(trim(message),''),nullif(trim(p_message),'')),session_id=coalesce(session_id,p_session_id),landing_path=coalesce(landing_path,p_landing_path),last_source_platform=coalesce(nullif(trim(p_source_platform),''),'site'),last_source_channel=coalesce(nullif(trim(p_source_channel),''),'form'),last_source_detail=nullif(trim(p_source_detail),''),last_source_at=now(),updated_at=now() where public.leads.id=v_id; else insert into public.leads(property_id,name,whatsapp,email,message,source,source_detail,session_id,landing_path,source_platform,source_channel,initial_source_platform,initial_source_channel,initial_source_detail,last_source_platform,last_source_channel,last_source_detail,last_source_at,status) values(p_property_id,trim(p_name),trim(p_whatsapp),v_email,nullif(trim(p_message),''),p_source,p_source_detail,p_session_id,p_landing_path,coalesce(nullif(trim(p_source_platform),''),'site'),coalesce(nullif(trim(p_source_channel),''),'form'),coalesce(nullif(trim(p_source_platform),''),'site'),coalesce(nullif(trim(p_source_channel),''),'form'),nullif(trim(p_source_detail),''),coalesce(nullif(trim(p_source_platform),''),'site'),coalesce(nullif(trim(p_source_channel),''),'form'),nullif(trim(p_source_detail),''),now(),'new') returning public.leads.id into v_id; end if; return query select v_id,v_existing; end; $function$;

CREATE OR REPLACE FUNCTION public.mark_social_conversation_unread(p_lead_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ begin if not public.is_admin() then raise exception 'not authorized'; end if; update public.social_messages set read_at=null where id=(select id from public.social_messages where lead_id=p_lead_id and direction='inbound' order by coalesce(sent_at,created_at) desc limit 1); update public.leads set social_unread_count=case when exists(select 1 from public.social_messages where lead_id=p_lead_id and direction='inbound') then 1 else 0 end,updated_at=now() where id=p_lead_id; end; $function$;

CREATE OR REPLACE FUNCTION public.admin_unread_social_count()
 RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select case when public.has_permission('messages.view') then coalesce(sum(social_unread_count),0)::bigint else 0::bigint end from public.leads where source_platform='instagram' and source_channel='direct'; $function$;

CREATE OR REPLACE FUNCTION public.admin_channel_performance(days_back integer DEFAULT 30)
 RETURNS TABLE(platform text,channel text,leads bigint,appointments bigint,won bigint,deal_value numeric,commission_value numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ with base as (select l.id,coalesce(l.initial_source_platform,l.source_platform,'site') as platform,coalesce(l.initial_source_channel,l.source_channel,'form') as channel,l.status,coalesce(l.deal_value,0) as deal_value,coalesce(l.commission_value,0) as commission_value from public.leads l where l.created_at>=now()-make_interval(days=>greatest(days_back,1)) and public.has_permission('reports.view')), appts as (select a.lead_id,count(*)::bigint as total from public.appointments a where a.created_at>=now()-make_interval(days=>greatest(days_back,1)) group by a.lead_id) select b.platform,b.channel,count(*)::bigint as leads,coalesce(sum(a.total),0)::bigint as appointments,count(*) filter(where b.status='won')::bigint as won,coalesce(sum(b.deal_value) filter(where b.status='won'),0)::numeric as deal_value,coalesce(sum(b.commission_value) filter(where b.status='won'),0)::numeric as commission_value from base b left join appts a on a.lead_id=b.id group by b.platform,b.channel order by leads desc,won desc; $function$;

CREATE OR REPLACE FUNCTION public.mark_channel_messages_read(p_lead_id uuid,p_platform text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ declare v_instagram integer; v_whatsapp integer; v_total integer; begin if not public.is_admin() then raise exception 'not authorized'; end if; update public.social_messages set read_at=now() where lead_id=p_lead_id and platform=p_platform and direction='inbound' and read_at is null; select count(*) filter(where platform='instagram' and direction='inbound' and read_at is null)::integer,count(*) filter(where platform='whatsapp' and direction='inbound' and read_at is null)::integer,count(*) filter(where direction='inbound' and read_at is null)::integer into v_instagram,v_whatsapp,v_total from public.social_messages where lead_id=p_lead_id; update public.leads set instagram_unread_count=coalesce(v_instagram,0),whatsapp_unread_count=coalesce(v_whatsapp,0),social_unread_count=coalesce(v_total,0),updated_at=now() where id=p_lead_id; end; $function$;

CREATE OR REPLACE FUNCTION public.mark_channel_conversation_unread(p_lead_id uuid,p_platform text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ declare v_instagram integer; v_whatsapp integer; v_total integer; begin if not public.is_admin() then raise exception 'not authorized'; end if; update public.social_messages set read_at=null where id=(select id from public.social_messages where lead_id=p_lead_id and platform=p_platform and direction='inbound' order by coalesce(sent_at,created_at) desc limit 1); select count(*) filter(where platform='instagram' and direction='inbound' and read_at is null)::integer,count(*) filter(where platform='whatsapp' and direction='inbound' and read_at is null)::integer,count(*) filter(where direction='inbound' and read_at is null)::integer into v_instagram,v_whatsapp,v_total from public.social_messages where lead_id=p_lead_id; update public.leads set instagram_unread_count=coalesce(v_instagram,0),whatsapp_unread_count=coalesce(v_whatsapp,0),social_unread_count=coalesce(v_total,0),updated_at=now() where id=p_lead_id; end; $function$;

CREATE OR REPLACE FUNCTION public.admin_unread_social_count_by_platform(p_platform text)
 RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select case when not public.has_permission('messages.view') then 0::bigint when p_platform='instagram' then coalesce(sum(instagram_unread_count),0)::bigint when p_platform='whatsapp' then coalesce(sum(whatsapp_unread_count),0)::bigint else coalesce(sum(social_unread_count),0)::bigint end from public.leads; $function$;

CREATE OR REPLACE FUNCTION public.next_proposal_code()
 RETURNS text LANGUAGE sql SET search_path TO 'public'
AS $function$ select 'PROP-' || lpad(nextval('public.proposal_code_seq')::text,4,'0'); $function$;;
