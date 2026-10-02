alter table public.organizations
  add column if not exists email_sender_name text,
  add column if not exists email_reply_to text;

update public.organizations set email_sender_name=coalesce(email_sender_name,name) where email_sender_name is null;

create or replace function public.current_organization_email_identity()
returns table(organization_id uuid, organization_name text, sender_name text, reply_to text)
language sql stable security definer set search_path=public
as $$
  select o.id,o.name,coalesce(o.email_sender_name,o.name),o.email_reply_to
  from public.organizations o where o.id=public.current_organization_id() limit 1
$$;
revoke all on function public.current_organization_email_identity() from public;
grant execute on function public.current_organization_email_identity() to authenticated;

create or replace function public.sync_organization_email_identity_from_agency_settings()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  update public.organizations
  set email_sender_name=coalesce(nullif(trim(new.agency_name),''),name),
      email_reply_to=nullif(trim(new.public_email),''),
      updated_at=now()
  where id=new.organization_id;
  return new;
end;
$$;
drop trigger if exists trg_sync_organization_email_identity on public.agency_public_settings;
create trigger trg_sync_organization_email_identity
after insert or update of agency_name,public_email on public.agency_public_settings
for each row execute function public.sync_organization_email_identity_from_agency_settings();

update public.organizations o
set email_sender_name=coalesce(nullif(trim(s.agency_name),''),o.name),
    email_reply_to=nullif(trim(s.public_email),'')
from public.agency_public_settings s where s.organization_id=o.id;