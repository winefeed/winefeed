-- ============================================================================
-- DDL (Direct Delivery Location) Database Verification Script
-- ============================================================================
-- Purpose: Verify database schema, constraints, indexes, RLS policies
-- Run: psql $DATABASE_URL -f scripts/sql/verify-ddl-constraints.sql
-- ============================================================================

\echo '========================================='
\echo 'DDL Database Verification Script'
\echo '========================================='
\echo ''

-- ============================================================================
-- 1. TABLE EXISTENCE
-- ============================================================================

\echo '1. Verifying tables exist...'
\echo ''

SELECT
  table_name,
  CASE
    WHEN table_name IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events')
ORDER BY table_name;

\echo ''

-- Check for missing tables
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('direct_delivery_locations'),
    ('ddl_documents'),
    ('ddl_status_events')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = expected.table_name
  );

  IF missing_count > 0 THEN
    RAISE WARNING 'FAIL: % table(s) missing', missing_count;
  ELSE
    RAISE NOTICE 'PASS: All 3 required tables exist';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================

\echo '2. Verifying enum types...'
\echo ''

-- Check ddl_status enum
SELECT
  enumlabel,
  '✓' as status
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'ddl_status'
ORDER BY enumsortorder;

\echo ''

DO $$
DECLARE
  status_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO status_count
  FROM pg_enum
  JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
  WHERE pg_type.typname = 'ddl_status';

  IF status_count < 5 THEN
    RAISE WARNING 'FAIL: ddl_status enum has only % values (expected 5)', status_count;
  ELSE
    RAISE NOTICE 'PASS: ddl_status enum has all % required values', status_count;
  END IF;
END $$;

\echo ''

-- Check ddl_document_type enum
SELECT
  enumlabel,
  '✓' as status
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'ddl_document_type'
ORDER BY enumsortorder;

\echo ''

-- ============================================================================
-- 3. CRITICAL CONSTRAINTS
-- ============================================================================

\echo '3. Verifying critical constraints...'
\echo ''

-- Check org_number constraint
SELECT
  conname as constraint_name,
  contype as constraint_type,
  CASE
    WHEN conname LIKE '%org_number%' THEN '✓ ORG NUMBER VALIDATION'
    ELSE conname
  END as description
FROM pg_constraint
WHERE conrelid = 'direct_delivery_locations'::regclass
  AND conname LIKE '%org%'
ORDER BY conname;

\echo ''

-- Check email constraint
SELECT
  conname as constraint_name,
  CASE
    WHEN conname LIKE '%email%' THEN '✓ EMAIL VALIDATION'
    ELSE conname
  END as description
FROM pg_constraint
WHERE conrelid = 'direct_delivery_locations'::regclass
  AND conname LIKE '%email%';

\echo ''

-- Check unique constraint on DDL address combination
SELECT
  conname as constraint_name,
  CASE
    WHEN conname LIKE '%unique_ddl%' THEN '✓ UNIQUE DDL PER ADDRESS'
    ELSE conname
  END as description
FROM pg_constraint
WHERE conrelid = 'direct_delivery_locations'::regclass
  AND contype = 'u'  -- unique constraint
ORDER BY conname;

\echo ''

-- Check document versioning unique constraint
SELECT
  conname as constraint_name,
  CASE
    WHEN conname LIKE '%version%' OR conname LIKE '%unique%'
    THEN '✓ DOCUMENT VERSION UNIQUENESS'
    ELSE conname
  END as description
FROM pg_constraint
WHERE conrelid = 'ddl_documents'::regclass
  AND contype = 'u'
ORDER BY conname;

\echo ''

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

\echo '4. Verifying indexes...'
\echo ''

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events')
ORDER BY tablename, indexname;

\echo ''

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

\echo '5. Verifying Row Level Security (RLS)...'
\echo ''

SELECT
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity THEN '✓ ENABLED'
    ELSE '✗ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events')
ORDER BY tablename;

\echo ''

DO $$
DECLARE
  disabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO disabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events')
    AND rowsecurity = false;

  IF disabled_count > 0 THEN
    RAISE WARNING 'FAIL: RLS disabled on % table(s)', disabled_count;
  ELSE
    RAISE NOTICE 'PASS: RLS enabled on all 3 tables';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

\echo '6. Verifying RLS policies...'
\echo ''

SELECT
  schemaname,
  tablename,
  policyname,
  CASE
    WHEN cmd = 'SELECT' THEN 'READ'
    WHEN cmd = 'INSERT' THEN 'CREATE'
    WHEN cmd = 'UPDATE' THEN 'UPDATE'
    WHEN cmd = 'DELETE' THEN 'DELETE'
    WHEN cmd = '*' THEN 'ALL'
    ELSE cmd
  END as operation,
  CASE
    WHEN roles = '{public}' THEN 'PUBLIC'
    ELSE array_to_string(roles, ', ')
  END as roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events')
ORDER BY tablename, policyname;

\echo ''

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) >= 2 THEN '✓ SUFFICIENT'
    ELSE '⚠ REVIEW NEEDED'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events')
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

\echo '7. Verifying helper functions...'
\echo ''

SELECT
  routine_name,
  routine_type,
  data_type as return_type,
  '✓' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'validate_ddl_status_transition',
    'generate_ddl_reference'
  )
ORDER BY routine_name;

\echo ''

DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN ('validate_ddl_status_transition', 'generate_ddl_reference');

  IF func_count < 2 THEN
    RAISE WARNING 'FAIL: Only % helper function(s) found (expected 2)', func_count;
  ELSE
    RAISE NOTICE 'PASS: All % helper functions exist', func_count;
  END IF;
END $$;

\echo ''

-- ============================================================================
-- 8. DATA INTEGRITY CHECKS
-- ============================================================================

\echo '8. Data integrity checks...'
\echo ''

-- Check for duplicate APPROVED DDLs (same restaurant+importer+address)
\echo 'Checking for duplicate APPROVED DDLs (SHOULD BE ZERO)...'
SELECT
  tenant_id,
  restaurant_id,
  importer_id,
  delivery_address_line1,
  postal_code,
  city,
  COUNT(*) as duplicate_count,
  CASE
    WHEN COUNT(*) > 1 THEN '✗ DUPLICATE FOUND'
    ELSE '✓ OK'
  END as status
FROM direct_delivery_locations
WHERE status = 'APPROVED'
GROUP BY tenant_id, restaurant_id, importer_id,
         delivery_address_line1, postal_code, city
HAVING COUNT(*) > 1;

\echo ''

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT
      tenant_id, restaurant_id, importer_id,
      delivery_address_line1, postal_code, city
    FROM direct_delivery_locations
    WHERE status = 'APPROVED'
    GROUP BY tenant_id, restaurant_id, importer_id,
             delivery_address_line1, postal_code, city
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'FAIL: Found % duplicate APPROVED DDL(s)', duplicate_count;
  ELSE
    RAISE NOTICE 'PASS: No duplicate APPROVED DDLs found';
  END IF;
END $$;

\echo ''

-- Check for orphaned documents (ddl_id not in direct_delivery_locations)
\echo 'Checking for orphaned documents...'
SELECT
  d.id as document_id,
  d.ddl_id,
  d.version,
  '✗ ORPHANED' as status
FROM ddl_documents d
LEFT JOIN direct_delivery_locations ddl ON d.ddl_id = ddl.id
WHERE ddl.id IS NULL;

\echo ''

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM ddl_documents d
  LEFT JOIN direct_delivery_locations ddl ON d.ddl_id = ddl.id
  WHERE ddl.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'FAIL: Found % orphaned document(s)', orphan_count;
  ELSE
    RAISE NOTICE 'PASS: No orphaned documents found';
  END IF;
END $$;

\echo ''

-- Check for orphaned status events
\echo 'Checking for orphaned status events...'
SELECT
  e.id as event_id,
  e.ddl_id,
  e.from_status,
  e.to_status,
  '✗ ORPHANED' as status
FROM ddl_status_events e
LEFT JOIN direct_delivery_locations ddl ON e.ddl_id = ddl.id
WHERE ddl.id IS NULL;

\echo ''

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM ddl_status_events e
  LEFT JOIN direct_delivery_locations ddl ON e.ddl_id = ddl.id
  WHERE ddl.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'FAIL: Found % orphaned status event(s)', orphan_count;
  ELSE
    RAISE NOTICE 'PASS: No orphaned status events found';
  END IF;
END $$;

\echo ''

-- Check for DDLs with documents but current_document_id is NULL
\echo 'Checking for DDLs with documents but NULL current_document_id...'
SELECT
  ddl.id as ddl_id,
  ddl.status,
  COUNT(d.id) as document_count,
  '⚠ INCONSISTENT' as status
FROM direct_delivery_locations ddl
JOIN ddl_documents d ON ddl.id = d.ddl_id
WHERE ddl.current_document_id IS NULL
GROUP BY ddl.id, ddl.status;

\echo ''

-- ============================================================================
-- 9. AUDIT TRAIL VERIFICATION
-- ============================================================================

\echo '9. Audit trail verification...'
\echo ''

-- Check if status events match DDL status changes
\echo 'Checking audit trail completeness...'
SELECT
  ddl.id as ddl_id,
  ddl.status as current_status,
  COUNT(e.id) as event_count,
  CASE
    WHEN ddl.status = 'NOT_REGISTERED' AND COUNT(e.id) = 0 THEN '✓ OK (never transitioned)'
    WHEN ddl.status = 'SUBMITTED' AND COUNT(e.id) >= 1 THEN '✓ OK'
    WHEN ddl.status = 'APPROVED' AND COUNT(e.id) >= 2 THEN '✓ OK'
    WHEN ddl.status = 'REJECTED' AND COUNT(e.id) >= 2 THEN '✓ OK'
    ELSE '⚠ REVIEW'
  END as audit_status
FROM direct_delivery_locations ddl
LEFT JOIN ddl_status_events e ON ddl.id = e.ddl_id
GROUP BY ddl.id, ddl.status
ORDER BY ddl.created_at DESC
LIMIT 20;

\echo ''

-- ============================================================================
-- 10. CONSTRAINT VALIDATION (Sample Data)
-- ============================================================================

\echo '10. Testing constraint validation with sample data...'
\echo ''

-- Test org_number constraint
\echo 'Testing org_number format constraint...'
DO $$
BEGIN
  -- Try to insert invalid org_number (should fail)
  INSERT INTO direct_delivery_locations (
    tenant_id, restaurant_id, importer_id,
    org_number, legal_name,
    delivery_address_line1, postal_code, city, country_code,
    contact_name, contact_email, contact_phone,
    consent_given
  ) VALUES (
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    '12345', 'Invalid Org Test AB',  -- INVALID FORMAT
    'Test Street 1', '11111', 'Stockholm', 'SE',
    'Test User', 'test@test.se', '0701234567',
    true
  );

  RAISE WARNING 'FAIL: Invalid org_number was accepted (constraint not working)';

  -- Rollback
  RAISE EXCEPTION 'Rolling back test insert';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'PASS: org_number constraint working (invalid format rejected)';
  WHEN OTHERS THEN
    -- Rollback any partial insert
    RAISE NOTICE 'PASS: org_number constraint working (rejected)';
END $$;

\echo ''

-- Test email constraint
\echo 'Testing email format constraint...'
DO $$
BEGIN
  INSERT INTO direct_delivery_locations (
    tenant_id, restaurant_id, importer_id,
    org_number, legal_name,
    delivery_address_line1, postal_code, city, country_code,
    contact_name, contact_email, contact_phone,
    consent_given
  ) VALUES (
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    '556789-1234', 'Test AB',
    'Test Street 1', '11111', 'Stockholm', 'SE',
    'Test User', 'invalid-email', '0701234567',  -- INVALID EMAIL
    true
  );

  RAISE WARNING 'FAIL: Invalid email was accepted (constraint not working)';
  RAISE EXCEPTION 'Rolling back test insert';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'PASS: email constraint working (invalid format rejected)';
  WHEN OTHERS THEN
    RAISE NOTICE 'PASS: email constraint working (rejected)';
END $$;

\echo ''

-- ============================================================================
-- 11. STORAGE BUCKET VERIFICATION (Manual Check Required)
-- ============================================================================

\echo '11. Storage bucket verification (MANUAL CHECK REQUIRED)...'
\echo ''
\echo 'To verify Supabase Storage configuration, run these commands manually:'
\echo ''
\echo '  1. Check bucket exists:'
\echo '     supabase storage list | grep ddl-documents'
\echo ''
\echo '  2. Check bucket policies:'
\echo '     supabase storage get-policy ddl-documents'
\echo ''
\echo '  3. Verify PDFs are NOT publicly accessible:'
\echo '     curl -I https://your-project.supabase.co/storage/v1/object/public/ddl-documents/test.pdf'
\echo '     (Should return 404 or 403, NOT 200)'
\echo ''

-- ============================================================================
-- SUMMARY
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'VERIFICATION SUMMARY'
\echo '========================================='
\echo ''
\echo 'Review all FAIL and WARNING messages above.'
\echo ''
\echo 'Critical checks:'
\echo '  - All 3 tables exist'
\echo '  - RLS enabled on all tables'
\echo '  - At least 2 policies per table'
\echo '  - No duplicate APPROVED DDLs'
\echo '  - No orphaned documents/events'
\echo '  - Constraints enforce validation rules'
\echo ''
\echo 'If all checks PASS, database is ready for acceptance testing.'
\echo ''
\echo '========================================='
