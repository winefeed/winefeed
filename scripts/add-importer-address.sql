-- ============================================================================
-- Add address fields to importers table
-- ============================================================================

-- Add address columns
ALTER TABLE importers
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'SE';

-- Update test importer with address
UPDATE importers
SET
  address_line1 = 'Importörsgatan 45',
  postal_code = '11457',
  city = 'Stockholm',
  country_code = 'SE'
WHERE legal_name = 'Test Importer AB';

-- Verify
SELECT
  id,
  legal_name,
  org_number,
  address_line1,
  postal_code,
  city
FROM importers
WHERE legal_name = 'Test Importer AB';

-- Success message
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Importers table updated with address fields!';
  RAISE NOTICE 'Test Importer AB address added: Importörsgatan 45, 11457 Stockholm';
  RAISE NOTICE '';
END $$;
