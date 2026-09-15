alter table public.crm_monthly_goals drop constraint if exists crm_monthly_goals_period_month_key;
alter table public.crm_monthly_goals add constraint crm_monthly_goals_org_period_month_key unique (organization_id, period_month);

alter table public.deals drop constraint if exists deals_code_key;
alter table public.deals add constraint deals_org_code_key unique (organization_id, code);

alter table public.properties drop constraint if exists properties_code_key;
alter table public.properties add constraint properties_org_code_key unique (organization_id, code);
alter table public.properties drop constraint if exists properties_slug_key;
alter table public.properties add constraint properties_org_slug_key unique (organization_id, slug);

alter table public.proposals drop constraint if exists proposals_code_key;
alter table public.proposals add constraint proposals_org_code_key unique (organization_id, code);

alter table public.rental_contracts drop constraint if exists rental_contracts_code_key;
alter table public.rental_contracts add constraint rental_contracts_org_code_key unique (organization_id, code);

alter table public.response_templates drop constraint if exists response_templates_name_key;
alter table public.response_templates add constraint response_templates_org_name_key unique (organization_id, name);

create unique index if not exists agency_public_settings_org_unique
  on public.agency_public_settings(organization_id);

drop index if exists public.leads_external_lead_unique;
create unique index leads_external_lead_unique
  on public.leads(organization_id, source_platform, external_lead_id)
  where external_lead_id is not null;

drop index if exists public.leads_instagram_contact_unique;
create unique index leads_instagram_contact_unique
  on public.leads(organization_id, source_platform, external_contact_id)
  where source_platform='instagram' and source_channel='direct' and external_contact_id is not null;

drop index if exists public.leads_whatsapp_wa_id_unique;
create unique index leads_whatsapp_wa_id_unique
  on public.leads(organization_id, whatsapp_wa_id)
  where whatsapp_wa_id is not null;

drop index if exists public.social_messages_external_message_unique;
create unique index social_messages_external_message_unique
  on public.social_messages(organization_id, platform, external_message_id)
  where external_message_id is not null;;
