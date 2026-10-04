alter table public.leads
  add column if not exists property_feedback_code text,
  add column if not exists property_feedback_notes text;

alter table public.appointments
  add column if not exists feedback_code text,
  add column if not exists feedback_notes text;

alter table public.proposals
  add column if not exists feedback_code text,
  add column if not exists feedback_notes text;

alter table public.owner_captures
  add column if not exists commercial_notes text;

create table if not exists public.property_owner_report_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default current_organization_id() references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  enabled boolean not null default false,
  channel text not null default 'email' check (channel in ('email','whatsapp','both')),
  frequency text not null default 'monthly' check (frequency in ('weekly','biweekly','monthly')),
  send_day integer not null default 1 check (send_day between 1 and 31),
  send_hour integer not null default 9 check (send_hour between 0 and 23),
  recipient_email text,
  recipient_whatsapp text,
  whatsapp_template_name text,
  next_send_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id)
);

create table if not exists public.property_owner_report_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  settings_id uuid references public.property_owner_report_settings(id) on delete set null,
  channel text not null,
  status text not null default 'pending' check (status in ('pending','sent','partial','error','skipped')),
  period_start date,
  period_end date,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists property_owner_report_settings_due_idx
  on public.property_owner_report_settings(enabled, next_send_at);

create index if not exists property_owner_report_history_property_idx
  on public.property_owner_report_history(property_id, created_at desc);

alter table public.property_owner_report_settings enable row level security;
alter table public.property_owner_report_history enable row level security;

drop policy if exists team_read_property_owner_report_settings on public.property_owner_report_settings;
create policy team_read_property_owner_report_settings
on public.property_owner_report_settings for select
to authenticated
using (
  organization_id = current_organization_id()
  and (is_admin() or has_permission('properties.view'))
);

drop policy if exists team_manage_property_owner_report_settings on public.property_owner_report_settings;
create policy team_manage_property_owner_report_settings
on public.property_owner_report_settings for all
to authenticated
using (
  organization_id = current_organization_id()
  and (is_admin() or has_permission('properties.manage'))
)
with check (
  organization_id = current_organization_id()
  and (is_admin() or has_permission('properties.manage'))
);

drop policy if exists team_read_property_owner_report_history on public.property_owner_report_history;
create policy team_read_property_owner_report_history
on public.property_owner_report_history for select
to authenticated
using (
  organization_id = current_organization_id()
  and (is_admin() or has_permission('properties.view'))
);

comment on column public.leads.property_feedback_code is 'Parecer inicial do cliente sobre o imóvel.';
comment on column public.leads.property_feedback_notes is 'Detalhes do parecer inicial do cliente.';
comment on column public.appointments.feedback_code is 'Parecer do cliente após visita ou atendimento.';
comment on column public.appointments.feedback_notes is 'Detalhes do parecer registrado na visita.';
comment on column public.proposals.feedback_code is 'Parecer do cliente relacionado à proposta.';
comment on column public.proposals.feedback_notes is 'Detalhes do parecer registrado na proposta.';
comment on column public.owner_captures.commercial_notes is 'Observações comerciais editáveis da etapa de captação.';
