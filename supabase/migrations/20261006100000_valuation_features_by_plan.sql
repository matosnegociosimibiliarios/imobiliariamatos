update public.saas_plans
set features = coalesce(features, '{}'::jsonb) || '{"valuation_quick": false, "valuation_complete": false}'::jsonb
where code = 'starter';

update public.saas_plans
set features = coalesce(features, '{}'::jsonb) || '{"valuation_quick": true, "valuation_complete": false}'::jsonb
where code = 'professional';

update public.saas_plans
set features = coalesce(features, '{}'::jsonb) || '{"valuation_quick": true, "valuation_complete": true}'::jsonb
where code = 'business';

update public.saas_plans
set features = coalesce(features, '{}'::jsonb) || '{"valuation_quick": true, "valuation_complete": true}'::jsonb
where code = 'internal';
