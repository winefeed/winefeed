-- ============================================================================
-- SUPPLIER IOR & WINE LOCATION
--
-- Adds support for:
-- 1. Linking suppliers to their IOR (Importer of Record)
-- 2. Marking wine location (domestic Sweden, EU, non-EU)
-- ============================================================================

-- Create wine location enum
DO $$ BEGIN
  CREATE TYPE wine_location AS ENUM ('domestic', 'eu', 'non_eu');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add importer_id to suppliers (which IOR handles their imports)
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS importer_id UUID REFERENCES importers(id);

-- Add index for importer lookup
CREATE INDEX IF NOT EXISTS idx_suppliers_importer_id ON suppliers(importer_id);

-- Add comment explaining the field
COMMENT ON COLUMN suppliers.importer_id IS 'The IOR (Importer of Record) that handles imports for this supplier. NULL for domestic Swedish suppliers.';

-- Add location to supplier_wines
ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS location wine_location DEFAULT 'domestic';

-- Add index for location filtering
CREATE INDEX IF NOT EXISTS idx_supplier_wines_location ON supplier_wines(location);

-- Add comment explaining the field
COMMENT ON COLUMN supplier_wines.location IS 'Where the wine is stored: domestic (Sweden), eu (EU warehouse), non_eu (outside EU)';

-- ============================================================================
-- HELPER VIEW: Wines with IOR info
-- ============================================================================
CREATE OR REPLACE VIEW supplier_wines_with_ior AS
SELECT
  sw.*,
  s.namn AS supplier_name,
  s.importer_id,
  i.legal_name AS importer_name,
  CASE
    WHEN sw.location = 'domestic' THEN 'Leverans från Sverige'
    WHEN sw.location = 'eu' AND i.id IS NOT NULL THEN 'Import via ' || i.legal_name
    WHEN sw.location = 'eu' THEN 'Import från EU'
    WHEN sw.location = 'non_eu' THEN 'Import från land utanför EU'
    ELSE 'Okänd'
  END AS delivery_info
FROM supplier_wines sw
JOIN suppliers s ON sw.supplier_id = s.id
LEFT JOIN importers i ON s.importer_id = i.id;
