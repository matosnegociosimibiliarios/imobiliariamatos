insert into storage.buckets(id,name,public) values
('crm-documents','crm-documents',false),
('property-images','property-images',true)
on conflict(id) do update set name=excluded.name, public=excluded.public;

CREATE POLICY admin_delete_crm_documents_storage ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'crm-documents'::text) AND public.is_admin());
CREATE POLICY admin_delete_property_images_storage ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'property-images'::text) AND public.is_admin());
CREATE POLICY admin_read_crm_documents_storage ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'crm-documents'::text) AND public.is_admin());
CREATE POLICY admin_update_crm_documents_storage ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'crm-documents'::text) AND public.is_admin()) WITH CHECK ((bucket_id = 'crm-documents'::text) AND public.is_admin());
CREATE POLICY admin_update_property_images_storage ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'property-images'::text) AND public.is_admin()) WITH CHECK ((bucket_id = 'property-images'::text) AND public.is_admin());
CREATE POLICY admin_upload_crm_documents_storage ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'crm-documents'::text) AND public.is_admin());
CREATE POLICY admin_upload_property_images ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'property-images'::text) AND public.is_admin());
CREATE POLICY team_delete_crm_documents_storage ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'crm-documents'::text) AND public.has_permission('documents.manage'::text));
CREATE POLICY team_delete_property_images_storage ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'property-images'::text) AND public.has_permission('properties.manage'::text));
CREATE POLICY team_read_crm_documents_storage ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'crm-documents'::text) AND public.has_permission('documents.view'::text));
CREATE POLICY team_update_crm_documents_storage ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'crm-documents'::text) AND public.has_permission('documents.manage'::text)) WITH CHECK ((bucket_id = 'crm-documents'::text) AND public.has_permission('documents.manage'::text));
CREATE POLICY team_update_property_images_storage ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'property-images'::text) AND public.has_permission('properties.manage'::text)) WITH CHECK ((bucket_id = 'property-images'::text) AND public.has_permission('properties.manage'::text));
CREATE POLICY team_upload_crm_documents_storage ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'crm-documents'::text) AND public.has_permission('documents.manage'::text));
CREATE POLICY team_upload_property_images ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'property-images'::text) AND public.has_permission('properties.manage'::text));;
