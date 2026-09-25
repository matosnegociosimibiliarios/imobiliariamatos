revoke execute on function public.commercial_funnel_metrics(integer) from anon;
revoke execute on function public.commercial_funnel_metrics(integer) from public;
grant execute on function public.commercial_funnel_metrics(integer) to authenticated;
