-- ============================================================================
-- FIX: Add org_number to restaurants (SIMPLE VERSION)
-- ============================================================================

-- Drop constraint if it exists (might be blocking)
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS valid_restaurant_org_number;

-- Add org_number column
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS org_number TEXT;

-- Update test restaurant
UPDATE restaurants
SET org_number = '556789-1234'
WHERE id = 'ad82ba05-3496-4c79-a25c-e2a591692820';

-- Verify
SELECT id, name, org_number FROM restaurants WHERE id = 'ad82ba05-3496-4c79-a25c-e2a591692820';
