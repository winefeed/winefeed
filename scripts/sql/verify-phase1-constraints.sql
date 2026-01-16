-- ============================================================================
-- PHASE 1 DATABASE VERIFICATION
-- ============================================================================
-- Purpose: Verify all required tables, constraints, and indexes exist
-- Usage: psql $DATABASE_URL -f scripts/sql/verify-phase1-constraints.sql
-- ============================================================================

\echo '════════════════════════════════════════════════════════════════════════'
\echo '📊 PHASE 1 DATABASE VERIFICATION'
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 1. TABLE EXISTENCE CHECKS
-- ============================================================================

\echo '✓ Checking required tables exist...'
\echo ''

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supplier_imports')
    THEN '✅ supplier_imports'
    ELSE '❌ supplier_imports MISSING'
  END as table_check
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supplier_import_lines')
    THEN '✅ supplier_import_lines'
    ELSE '❌ supplier_import_lines MISSING'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supplier_product_mappings')
    THEN '✅ supplier_product_mappings'
    ELSE '❌ supplier_product_mappings MISSING'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_match_review_queue')
    THEN '✅ product_match_review_queue'
    ELSE '❌ product_match_review_queue MISSING'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_audit_log')
    THEN '✅ product_audit_log'
    ELSE '❌ product_audit_log MISSING'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_products')
    THEN '✅ master_products'
    ELSE '❌ master_products MISSING'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_families')
    THEN '✅ product_families'
    ELSE '❌ product_families MISSING'
  END;

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 2. UNIQUE CONSTRAINT CHECKS (Critical for Idempotency)
-- ============================================================================

\echo '✓ Checking unique constraints (idempotency protection)...'
\echo ''

-- Check unique constraint on supplier_product_mappings (supplier_id, supplier_sku)
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'supplier_product_mappings'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%supplier_id%supplier_sku%'
    ) OR EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'supplier_product_mappings'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%supplier_id%'
        AND indexdef LIKE '%supplier_sku%'
    )
    THEN '✅ UNIQUE(supplier_id, supplier_sku) on supplier_product_mappings'
    ELSE '❌ MISSING: UNIQUE(supplier_id, supplier_sku) on supplier_product_mappings'
  END as constraint_check
UNION ALL
-- Check unique constraint on supplier_import_lines (import_id, line_number)
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'supplier_import_lines'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%import_id%line_number%'
    )
    THEN '✅ UNIQUE(import_id, line_number) on supplier_import_lines'
    ELSE '❌ MISSING: UNIQUE(import_id, line_number) on supplier_import_lines'
  END
UNION ALL
-- Check primary key on product_match_review_queue prevents duplicate queue items
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'product_match_review_queue'
        AND constraint_type = 'PRIMARY KEY'
    )
    THEN '✅ PRIMARY KEY on product_match_review_queue'
    ELSE '❌ MISSING: PRIMARY KEY on product_match_review_queue'
  END
UNION ALL
-- Check for import_line_id uniqueness to prevent duplicate queue entries
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'product_match_review_queue'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%import_line_id%'
    ) OR EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'product_match_review_queue'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%import_line_id%'
    )
    THEN '✅ UNIQUE(import_line_id) on product_match_review_queue (or implicit via FK)'
    ELSE '⚠️  WARNING: No explicit UNIQUE constraint on import_line_id (check if business logic prevents duplicates)'
  END;

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 3. INDEX CHECKS (Performance)
-- ============================================================================

\echo '✓ Checking required indexes...'
\echo ''

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'supplier_imports'
        AND indexdef LIKE '%supplier_id%'
    )
    THEN '✅ INDEX on supplier_imports(supplier_id)'
    ELSE '⚠️  MISSING: INDEX on supplier_imports(supplier_id)'
  END as index_check
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'supplier_imports'
        AND indexdef LIKE '%status%'
    )
    THEN '✅ INDEX on supplier_imports(status)'
    ELSE '⚠️  MISSING: INDEX on supplier_imports(status)'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'supplier_import_lines'
        AND indexdef LIKE '%import_id%'
    )
    THEN '✅ INDEX on supplier_import_lines(import_id)'
    ELSE '⚠️  MISSING: INDEX on supplier_import_lines(import_id)'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'supplier_import_lines'
        AND indexdef LIKE '%match_status%'
    )
    THEN '✅ INDEX on supplier_import_lines(match_status)'
    ELSE '⚠️  MISSING: INDEX on supplier_import_lines(match_status)'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'supplier_import_lines'
        AND indexdef LIKE '%supplier_sku%'
    )
    THEN '✅ INDEX on supplier_import_lines(supplier_sku)'
    ELSE '⚠️  MISSING: INDEX on supplier_import_lines(supplier_sku)'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'product_match_review_queue'
        AND indexdef LIKE '%status%'
    )
    THEN '✅ INDEX on product_match_review_queue(status)'
    ELSE '⚠️  MISSING: INDEX on product_match_review_queue(status)'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'product_match_review_queue'
        AND indexdef LIKE '%import_line_id%'
    )
    THEN '✅ INDEX on product_match_review_queue(import_line_id)'
    ELSE '⚠️  MISSING: INDEX on product_match_review_queue(import_line_id)'
  END
UNION ALL
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'supplier_product_mappings'
        AND indexdef LIKE '%supplier_id%'
    )
    THEN '✅ INDEX on supplier_product_mappings(supplier_id)'
    ELSE '⚠️  MISSING: INDEX on supplier_product_mappings(supplier_id)'
  END;

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 4. DUPLICATE DETECTION (Should return 0 rows)
-- ============================================================================

\echo '✓ Checking for duplicate mappings (MUST be 0)...'
\echo ''

SELECT
  supplier_id,
  supplier_sku,
  COUNT(*) as duplicate_count,
  '❌ DUPLICATE MAPPING DETECTED' as status
FROM supplier_product_mappings
GROUP BY supplier_id, supplier_sku
HAVING COUNT(*) > 1;

-- If no rows returned, show success message
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM supplier_product_mappings
    GROUP BY supplier_id, supplier_sku
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE '✅ No duplicate mappings found (PASS)';
  END IF;
END $$;

\echo ''

\echo '✓ Checking for duplicate queue items (MUST be 0)...'
\echo ''

SELECT
  import_line_id,
  COUNT(*) as duplicate_count,
  '❌ DUPLICATE QUEUE ITEM DETECTED' as status
FROM product_match_review_queue
WHERE import_line_id IS NOT NULL
GROUP BY import_line_id
HAVING COUNT(*) > 1;

-- If no rows returned, show success message
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM product_match_review_queue
    WHERE import_line_id IS NOT NULL
    GROUP BY import_line_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE '✅ No duplicate queue items found (PASS)';
  END IF;
END $$;

\echo ''

\echo '✓ Checking for duplicate import lines (MUST be 0)...'
\echo ''

SELECT
  import_id,
  line_number,
  COUNT(*) as duplicate_count,
  '❌ DUPLICATE IMPORT LINE DETECTED' as status
FROM supplier_import_lines
GROUP BY import_id, line_number
HAVING COUNT(*) > 1;

-- If no rows returned, show success message
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM supplier_import_lines
    GROUP BY import_id, line_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE '✅ No duplicate import lines found (PASS)';
  END IF;
END $$;

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 5. DATA INTEGRITY CHECKS
-- ============================================================================

\echo '✓ Checking data integrity...'
\echo ''

-- Check for orphaned import lines (import record deleted but lines remain)
SELECT
  COUNT(*) as orphaned_lines,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No orphaned import lines'
    ELSE '❌ ORPHANED IMPORT LINES DETECTED'
  END as status
FROM supplier_import_lines sil
WHERE NOT EXISTS (
  SELECT 1 FROM supplier_imports WHERE id = sil.import_id
);

\echo ''

-- Check for orphaned queue items (import line deleted but queue item remains)
SELECT
  COUNT(*) as orphaned_queue_items,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No orphaned queue items'
    ELSE '❌ ORPHANED QUEUE ITEMS DETECTED'
  END as status
FROM product_match_review_queue pmrq
WHERE import_line_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM supplier_import_lines WHERE id = pmrq.import_line_id
  );

\echo ''

-- Check for mappings referencing non-existent products
SELECT
  COUNT(*) as invalid_mappings,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ All mappings reference valid products'
    ELSE '❌ INVALID PRODUCT REFERENCES DETECTED'
  END as status
FROM supplier_product_mappings spm
WHERE master_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_products WHERE id = spm.master_product_id
  );

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 6. SUMMARY STATISTICS
-- ============================================================================

\echo '✓ Database statistics...'
\echo ''

SELECT
  'supplier_imports' as table_name,
  COUNT(*) as row_count
FROM supplier_imports
UNION ALL
SELECT
  'supplier_import_lines',
  COUNT(*)
FROM supplier_import_lines
UNION ALL
SELECT
  'supplier_product_mappings',
  COUNT(*)
FROM supplier_product_mappings
UNION ALL
SELECT
  'product_match_review_queue',
  COUNT(*)
FROM product_match_review_queue
UNION ALL
SELECT
  'product_audit_log',
  COUNT(*)
FROM product_audit_log;

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 7. FINAL GATE
-- ============================================================================

\echo '📋 VERIFICATION SUMMARY'
\echo ''
\echo 'Check the output above for:'
\echo '  ✅ All tables exist (7 checks)'
\echo '  ✅ All unique constraints present (4 checks)'
\echo '  ✅ All indexes present (8 checks)'
\echo '  ✅ Zero duplicate mappings'
\echo '  ✅ Zero duplicate queue items'
\echo '  ✅ Zero duplicate import lines'
\echo '  ✅ No orphaned records'
\echo ''
\echo 'If ALL checks pass → Database is ready for Phase 1'
\echo 'If ANY check fails → Fix constraints/indexes before proceeding'
\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
