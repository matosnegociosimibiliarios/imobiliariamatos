revoke execute on function public.property_valuation_advanced_analysis(uuid) from anon;
revoke execute on function public.property_valuation_advanced_analysis(uuid) from public;
grant execute on function public.property_valuation_advanced_analysis(uuid) to authenticated;
