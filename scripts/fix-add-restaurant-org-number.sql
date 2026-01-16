-- ============================================================================
-- FIX: Add missing org_number column to restaurants table
-- ============================================================================

-- Add org_number column to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS org_number TEXT NULL;

-- Add validation constraint for Swedish org numbers (format: XXXXXX-XXXX)
ALTER TABLE restaurants
ADD CONSTRAINT IF NOT EXISTS valid_restaurant_org_number
  CHECK (org_number IS NULL OR org_number ~ '^\d{6}-\d{4}$');

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_org_number ON restaurants(org_number);

-- Update test restaurant with org number
UPDATE restaurants
SET org_number = '556789-1234'
WHERE id = 'ad82ba05-3496-4c79-a25c-e2a591692820'
AND org_number IS NULL;

-- Success message
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ FIX APPLIED!';
  RAISE NOTICE 'Added org_number column to restaurants table';
  RAISE NOTICE 'Updated test restaurant with org_number: 556789-1234';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now test document generation again!';
END $$;
