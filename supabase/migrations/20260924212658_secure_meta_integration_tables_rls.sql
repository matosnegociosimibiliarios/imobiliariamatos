create policy "team_manage_meta_instagram_connections"
on public.meta_instagram_connections
for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('integrations.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('integrations.manage')
);

create policy "team_manage_meta_oauth_states"
on public.meta_oauth_states
for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('integrations.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('integrations.manage')
);

create policy "team_manage_meta_whatsapp_connections"
on public.meta_whatsapp_connections
for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('integrations.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('integrations.manage')
);
