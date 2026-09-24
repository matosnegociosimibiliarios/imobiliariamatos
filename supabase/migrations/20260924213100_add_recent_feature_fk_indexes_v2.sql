create index if not exists property_transactions_property_id_idx
  on public.property_transactions(property_id);

create index if not exists property_valuations_evaluator_id_idx
  on public.property_valuations(evaluator_id);

create index if not exists valuation_comparables_city_id_idx
  on public.valuation_comparables(city_id);

create index if not exists valuation_comparables_neighborhood_id_idx
  on public.valuation_comparables(neighborhood_id);

create index if not exists meta_oauth_states_organization_id_idx
  on public.meta_oauth_states(organization_id);

create index if not exists meta_oauth_states_user_id_idx
  on public.meta_oauth_states(user_id);
