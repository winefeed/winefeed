/**
 * COMPREHENSIVE RLS POLICIES
 * Migration: 20260121_enable_rls_all_tables
 *
 * Enables RLS with service role access on all tables
 */

-- ============================================================================
-- STEP 1: Drop ALL existing policies first (clean slate)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Enable RLS on all public tables
-- ============================================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma_%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Create service role policies for all tables
-- ============================================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma_%'
  ) LOOP
    EXECUTE format('
      CREATE POLICY "Service role full access" ON public.%I FOR ALL
      USING (auth.jwt() ->> ''role'' = ''service_role'')
      WITH CHECK (auth.jwt() ->> ''role'' = ''service_role'')
    ', t.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Run this to verify:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
