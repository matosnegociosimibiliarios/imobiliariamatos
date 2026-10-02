create or replace function public.enforce_saas_property_limit()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_plan text; v_limit integer; v_count integer;
begin
 if new.organization_id is null then return new; end if;
 select coalesce(s.plan_code,o.plan_code) into v_plan from public.organizations o left join public.saas_subscriptions s on s.organization_id=o.id where o.id=new.organization_id;
 if v_plan='internal' then return new; end if;
 select coalesce((limits->>'properties')::integer,-1) into v_limit from public.saas_plans where code=v_plan;
 if coalesce(v_limit,-1)<0 then return new; end if;
 select count(*) into v_count from public.properties where organization_id=new.organization_id and deleted_at is null;
 if v_count>=v_limit then raise exception 'Limite de imóveis do plano atingido (%).',v_limit; end if;
 return new;
end $$;
drop trigger if exists trg_enforce_saas_property_limit on public.properties;
create trigger trg_enforce_saas_property_limit before insert on public.properties for each row execute function public.enforce_saas_property_limit();
revoke all on function public.enforce_saas_property_limit() from public,anon,authenticated;

create or replace function public.enforce_saas_member_limit()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_plan text; v_limit integer; v_count integer;
begin
 if new.status<>'active' then return new; end if;
 if tg_op='UPDATE' and old.status='active' and old.organization_id=new.organization_id then return new; end if;
 select coalesce(s.plan_code,o.plan_code) into v_plan from public.organizations o left join public.saas_subscriptions s on s.organization_id=o.id where o.id=new.organization_id;
 if v_plan='internal' then return new; end if;
 select coalesce((limits->>'users')::integer,-1) into v_limit from public.saas_plans where code=v_plan;
 if coalesce(v_limit,-1)<0 then return new; end if;
 select count(*) into v_count from public.organization_members where organization_id=new.organization_id and status='active';
 if v_count>=v_limit then raise exception 'Limite de usuários do plano atingido (%).',v_limit; end if;
 return new;
end $$;
drop trigger if exists trg_enforce_saas_member_limit on public.organization_members;
create trigger trg_enforce_saas_member_limit before insert or update of status,organization_id on public.organization_members for each row execute function public.enforce_saas_member_limit();
revoke all on function public.enforce_saas_member_limit() from public,anon,authenticated;