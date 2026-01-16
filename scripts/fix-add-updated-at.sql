-- ============================================================================
-- FIX: Add missing updated_at column to imports table
-- ============================================================================

ALTER TABLE imports
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Success message
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ FIX APPLIED!';
  RAISE NOTICE 'Added updated_at column to imports table';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now test the status change again!';
END $$;
