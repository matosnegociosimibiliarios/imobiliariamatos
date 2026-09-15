drop policy if exists admin_delete_crm_documents_storage on storage.objects;
drop policy if exists admin_read_crm_documents_storage on storage.objects;
drop policy if exists admin_update_crm_documents_storage on storage.objects;
drop policy if exists admin_upload_crm_documents_storage on storage.objects;
drop policy if exists team_delete_crm_documents_storage on storage.objects;
drop policy if exists team_read_crm_documents_storage on storage.objects;
drop policy if exists team_update_crm_documents_storage on storage.objects;
drop policy if exists team_upload_crm_documents_storage on storage.objects;

drop policy if exists admin_delete_property_images_storage on storage.objects;
drop policy if exists admin_update_property_images_storage on storage.objects;
drop policy if exists admin_upload_property_images on storage.objects;
drop policy if exists team_delete_property_images_storage on storage.objects;
drop policy if exists team_update_property_images_storage on storage.objects;
drop policy if exists team_upload_property_images on storage.objects;

create policy crm_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id='crm-documents'
  and public.has_permission('documents.view')
  and exists (
    select 1
    from public.crm_documents d
    where d.storage_path = storage.objects.name
      and d.organization_id = public.current_organization_id()
  )
);

create policy crm_documents_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='crm-documents'
  and public.has_permission('documents.manage')
);

create policy crm_documents_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id='crm-documents'
  and public.has_permission('documents.manage')
  and exists (
    select 1
    from public.crm_documents d
    where d.storage_path = storage.objects.name
      and d.organization_id = public.current_organization_id()
  )
)
with check (
  bucket_id='crm-documents'
  and public.has_permission('documents.manage')
);

create policy crm_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='crm-documents'
  and public.has_permission('documents.manage')
  and exists (
    select 1
    from public.crm_documents d
    where d.storage_path = storage.objects.name
      and d.organization_id = public.current_organization_id()
  )
);

create policy property_images_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='property-images'
  and public.has_permission('properties.manage')
);

create policy property_images_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id='property-images'
  and public.has_permission('properties.manage')
  and exists (
    select 1
    from public.property_images i
    where i.storage_path = storage.objects.name
      and i.organization_id = public.current_organization_id()
  )
)
with check (
  bucket_id='property-images'
  and public.has_permission('properties.manage')
);

create policy property_images_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='property-images'
  and public.has_permission('properties.manage')
  and exists (
    select 1
    from public.property_images i
    where i.storage_path = storage.objects.name
      and i.organization_id = public.current_organization_id()
  )
);;
