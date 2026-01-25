-- ============================================================================
-- RESTAURANT ONBOARDING FIELDS
--
-- Adds fields for restaurant onboarding:
-- - Address fields (from org number lookup or manual input)
-- - License/permit fields (serveringstillstånd) for compliance
-- - Onboarding status tracking
-- ============================================================================

-- Add address fields to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add license fields (serveringstillstånd)
-- These are collected in step 2 (when placing first order)
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS license_municipality TEXT,      -- Utfärdande kommun
ADD COLUMN IF NOT EXISTS license_case_number TEXT,       -- Diarienummer
ADD COLUMN IF NOT EXISTS license_decision_date DATE,     -- Beslutsdatum
ADD COLUMN IF NOT EXISTS license_valid_from DATE,        -- Giltig från
ADD COLUMN IF NOT EXISTS license_valid_until DATE,       -- Giltig till
ADD COLUMN IF NOT EXISTS license_category TEXT;          -- Kategorikod

-- Add onboarding tracking
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_verified_at TIMESTAMPTZ;

-- Note: org_number already exists (added via earlier fix script)

-- Add index for city (used for prefilling delivery location)
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);

-- Add comment
COMMENT ON COLUMN restaurants.city IS 'City for prefilling delivery location in requests';
COMMENT ON COLUMN restaurants.license_municipality IS 'Municipality that issued the alcohol license (serveringstillstånd)';
COMMENT ON COLUMN restaurants.license_case_number IS 'Case number (diarienummer) for traceability';
COMMENT ON COLUMN restaurants.license_valid_until IS 'License expiry date - must be current for orders';
