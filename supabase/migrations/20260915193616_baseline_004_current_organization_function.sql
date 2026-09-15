create or replace function public.current_organization_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select m.organization_id
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'broker' then 3 else 4 end,
           m.created_at
  limit 1;
$function$;;
