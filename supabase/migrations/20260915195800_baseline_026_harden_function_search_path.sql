alter function public.role_permissions_json(text) set search_path = public, pg_temp;
alter function public.prepare_property() set search_path = public, pg_temp;
alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.apply_lead_business_rules() set search_path = public, pg_temp;
alter function public.apply_capture_business_rules() set search_path = public, pg_temp;;
