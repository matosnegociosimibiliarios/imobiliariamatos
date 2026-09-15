CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER appointments_touch_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_appointments_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.log_team_activity();
CREATE TRIGGER trg_appointments_assignment BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.stamp_assignment();

CREATE TRIGGER crm_documents_business_rules BEFORE INSERT OR UPDATE ON public.crm_documents FOR EACH ROW EXECUTE FUNCTION public.apply_crm_document_rules();
CREATE TRIGGER crm_documents_checklist_pending AFTER DELETE ON public.crm_documents FOR EACH ROW EXECUTE FUNCTION public.crm_document_restore_checklist_pending();
CREATE TRIGGER crm_documents_checklist_received AFTER INSERT ON public.crm_documents FOR EACH ROW EXECUTE FUNCTION public.crm_document_mark_checklist_received();
CREATE TRIGGER crm_documents_sync_review AFTER UPDATE OF status ON public.crm_documents FOR EACH ROW EXECUTE FUNCTION public.crm_document_sync_review_to_checklist();
CREATE TRIGGER crm_documents_touch_updated_at BEFORE UPDATE ON public.crm_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_crm_documents_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.crm_documents FOR EACH ROW EXECUTE FUNCTION public.log_team_activity();
CREATE TRIGGER crm_monthly_goals_touch_updated_at BEFORE UPDATE ON public.crm_monthly_goals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER deal_documents_business_rules BEFORE UPDATE ON public.deal_documents FOR EACH ROW EXECUTE FUNCTION public.apply_deal_document_rules();
CREATE TRIGGER deal_documents_touch_updated_at BEFORE UPDATE ON public.deal_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER deals_business_rules BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.apply_deal_business_rules();
CREATE TRIGGER deals_seed_documents AFTER INSERT ON public.deals FOR EACH ROW EXECUTE FUNCTION public.seed_deal_documents();
CREATE TRIGGER deals_status_history_trigger AFTER INSERT OR UPDATE OF status ON public.deals FOR EACH ROW EXECUTE FUNCTION public.log_deal_status_change();
CREATE TRIGGER deals_sync_entities_trigger AFTER INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.sync_deal_entities();
CREATE TRIGGER deals_touch_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_deals_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.log_team_activity();
CREATE TRIGGER trg_deals_assignment BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.stamp_assignment();

CREATE TRIGGER lead_preferences_touch_updated_at BEFORE UPDATE ON public.lead_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lead_property_matches_touch_updated_at BEFORE UPDATE ON public.lead_property_matches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER leads_business_rules BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.apply_lead_business_rules();
CREATE TRIGGER leads_status_history_trigger AFTER UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_lead_status_change();
CREATE TRIGGER leads_touch_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER leads_track_source_change AFTER INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.track_lead_source_change();
CREATE TRIGGER trg_leads_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_team_activity();
CREATE TRIGGER trg_leads_assignment BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.stamp_assignment();

CREATE TRIGGER trg_protect_last_owner BEFORE DELETE OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();

CREATE TRIGGER owner_captures_business_rules BEFORE UPDATE ON public.owner_captures FOR EACH ROW EXECUTE FUNCTION public.apply_capture_business_rules();
CREATE TRIGGER owner_captures_status_history_trigger AFTER UPDATE OF status ON public.owner_captures FOR EACH ROW EXECUTE FUNCTION public.log_capture_status_change();
CREATE TRIGGER owner_captures_sync_property_management AFTER INSERT OR UPDATE OF converted_property_id, owner_name, whatsapp, email, commission_percent, status ON public.owner_captures FOR EACH ROW EXECUTE FUNCTION public.sync_capture_property_management();
CREATE TRIGGER owner_captures_touch_updated_at BEFORE UPDATE ON public.owner_captures FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_owner_captures_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.owner_captures FOR EACH ROW EXECUTE FUNCTION public.log_team_activity();
CREATE TRIGGER trg_owner_captures_assignment BEFORE INSERT OR UPDATE ON public.owner_captures FOR EACH ROW EXECUTE FUNCTION public.stamp_assignment();

CREATE TRIGGER properties_prepare_trigger BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.prepare_property();
CREATE TRIGGER properties_price_history_trigger AFTER UPDATE OF sale_price, rent_price ON public.properties FOR EACH ROW EXECUTE FUNCTION public.log_property_price_change();
CREATE TRIGGER properties_seed_management AFTER INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION public.seed_property_management();
CREATE TRIGGER properties_status_history_trigger AFTER UPDATE OF status ON public.properties FOR EACH ROW EXECUTE FUNCTION public.log_property_status_change();
CREATE TRIGGER trg_properties_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.log_team_activity();
CREATE TRIGGER trg_properties_assignment BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.stamp_assignment();

CREATE TRIGGER property_documents_business_rules BEFORE UPDATE ON public.property_documents FOR EACH ROW EXECUTE FUNCTION public.apply_property_document_rules();
CREATE TRIGGER property_documents_sync_summary AFTER INSERT OR DELETE OR UPDATE OF status ON public.property_documents FOR EACH ROW EXECUTE FUNCTION public.sync_property_documentation_summary();
CREATE TRIGGER property_documents_touch_updated_at BEFORE UPDATE ON public.property_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER property_management_seed_documents AFTER INSERT ON public.property_management FOR EACH ROW EXECUTE FUNCTION public.seed_property_documents();
CREATE TRIGGER property_management_touch_updated_at BEFORE UPDATE ON public.property_management FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER proposals_business_rules BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.apply_proposal_business_rules();
CREATE TRIGGER proposals_status_history_trigger AFTER INSERT OR UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.log_proposal_status_change();
CREATE TRIGGER proposals_sync_lead_trigger AFTER INSERT OR UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.sync_lead_from_proposal();
CREATE TRIGGER proposals_touch_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_proposals_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.log_team_activity();
CREATE TRIGGER trg_proposals_assignment BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.stamp_assignment();

CREATE TRIGGER social_message_sync_lead AFTER INSERT ON public.social_messages FOR EACH ROW EXECUTE FUNCTION public.sync_social_message_to_lead();;
