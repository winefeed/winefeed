-- ============================================================================
-- FIX SUPABASE SECURITY ADVISOR WARNINGS
--
-- 1. Enable RLS on tables missing it
-- 2. Add service_role policies where missing
-- 3. Fix views: security_invoker = true (respects caller's RLS)
-- ============================================================================

-- ============================================================================
-- PART 1: Enable RLS on tables that have policies but RLS disabled
-- (Security Advisor: "Policy Exists RLS Disabled")
-- ============================================================================

ALTER TABLE IF EXISTS access_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_wines ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: Enable RLS + add service_role policy on tables without any RLS
-- (Security Advisor: "RLS Disabled in Public")
-- ============================================================================

-- wine_recommendations
ALTER TABLE IF EXISTS wine_recommendations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON wine_recommendations FOR ALL
    TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- food_scan_results
ALTER TABLE IF EXISTS food_scan_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON food_scan_results FOR ALL
    TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- food_pairing_suggestions
ALTER TABLE IF EXISTS food_pairing_suggestions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON food_pairing_suggestions FOR ALL
    TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- access_importers (if exists)
ALTER TABLE IF EXISTS access_importers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'access_importers') THEN
    EXECUTE 'CREATE POLICY "service_role_all" ON access_importers FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- supplier_market_intelligence (if exists)
ALTER TABLE IF EXISTS supplier_market_intelligence ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supplier_market_intelligence') THEN
    EXECUTE 'CREATE POLICY "service_role_all" ON supplier_market_intelligence FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PART 3: Fix Security Definer Views → security_invoker = true
-- (Security Advisor: "Security Definer View")
--
-- Uses ALTER VIEW to preserve existing column definitions.
-- security_invoker makes views respect the caller's RLS
-- instead of the view owner's (postgres) permissions.
-- ============================================================================

ALTER VIEW IF EXISTS active_assignments SET (security_invoker = true);
ALTER VIEW IF EXISTS supplier_assignment_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS user_roles_computed SET (security_invoker = true);
ALTER VIEW IF EXISTS supplier_wines_with_ior SET (security_invoker = true);
ALTER VIEW IF EXISTS access_request_totals SET (security_invoker = true);
ALTER VIEW IF EXISTS event_stats SET (security_invoker = true);

-- ============================================================================
-- DONE
-- ============================================================================
