-- Fix "Function Search Path Mutable" warnings from Supabase Security Advisor
-- Sets explicit search_path on all custom functions (excludes pgvector internals)

ALTER FUNCTION public.auth_entity_id(text) SET search_path = public;
ALTER FUNCTION public.auth_has_role(text) SET search_path = public;
ALTER FUNCTION public.auto_expire_assignments() SET search_path = public;
ALTER FUNCTION public.can_accept_offer(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.category_has_available_slots(uuid) SET search_path = public;
ALTER FUNCTION public.check_item_same_importer() SET search_path = public;
ALTER FUNCTION public.check_request_accepted_for_item() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_wine_enrichment() SET search_path = public;
ALTER FUNCTION public.count_active_slots_in_category(uuid) SET search_path = public;
ALTER FUNCTION public.ensure_single_default_address() SET search_path = public;
ALTER FUNCTION public.get_supplier_remaining_slots(uuid) SET search_path = public;
ALTER FUNCTION public.get_wine_moq(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_supplier_user() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.ior_update_updated_at() SET search_path = public;
ALTER FUNCTION public.is_assignment_valid_for_offer(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.match_wine_knowledge(vector, double precision, integer) SET search_path = public;
ALTER FUNCTION public.update_ior_feedback_updated_at() SET search_path = public;
ALTER FUNCTION public.update_offer_lines_updated_at() SET search_path = public;
ALTER FUNCTION public.update_sponsored_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.validate_wine_import_row(text, text, text, integer, text, text, integer, integer, integer) SET search_path = public;
