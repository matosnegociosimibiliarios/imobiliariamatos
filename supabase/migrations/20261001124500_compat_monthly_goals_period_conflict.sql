alter table public.crm_monthly_goals
  drop constraint if exists crm_monthly_goals_period_month_key;

alter table public.crm_monthly_goals
  add constraint crm_monthly_goals_period_month_key unique (period_month);