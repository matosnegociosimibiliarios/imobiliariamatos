create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path='public'
as $$
  select
    (
      coalesce((public.effective_permissions_json()->>p_permission)::boolean, false)
      or public.is_admin()
    )
    and case
      when p_permission like 'financial.%' then public.saas_feature_allowed('finance')
      when p_permission like 'rentals.%' then public.saas_feature_allowed('rentals')
      when p_permission like 'integrations.%' then public.saas_feature_allowed('integrations')
      when p_permission like 'messages.%' then public.saas_feature_allowed('integrations')
      else true
    end;
$$;
