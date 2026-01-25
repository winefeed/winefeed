/**
 * MIGRATION: Wine Catalog Status Enhancement
 *
 * Pilot Loop 2.0 - Supplier Catalog UX
 *
 * Adds:
 * - status column with ACTIVE, TEMPORARILY_UNAVAILABLE, END_OF_VINTAGE
 * - Replaces simple is_active boolean with richer status
 */

-- ============================================================================
-- ADD STATUS ENUM
-- ============================================================================

CREATE TYPE wine_availability_status AS ENUM (
  'ACTIVE',                    -- Available for sale
  'TEMPORARILY_UNAVAILABLE',   -- Out of stock but will return
  'END_OF_VINTAGE'             -- This vintage is finished, won't return
);

COMMENT ON TYPE wine_availability_status IS 'Wine availability status for supplier catalog';

-- ============================================================================
-- ADD STATUS COLUMN TO SUPPLIER_WINES
-- ============================================================================

ALTER TABLE supplier_wines
ADD COLUMN status wine_availability_status NOT NULL DEFAULT 'ACTIVE';

-- Migrate existing data: is_active=false -> TEMPORARILY_UNAVAILABLE
UPDATE supplier_wines
SET status = 'TEMPORARILY_UNAVAILABLE'
WHERE is_active = FALSE;

-- Add index for status filtering
CREATE INDEX idx_supplier_wines_status ON supplier_wines(supplier_id, status);

COMMENT ON COLUMN supplier_wines.status IS 'Wine availability: ACTIVE, TEMPORARILY_UNAVAILABLE, END_OF_VINTAGE';

-- ============================================================================
-- KEEP is_active AS COMPUTED (for backwards compatibility)
-- ============================================================================

-- Create a trigger to sync is_active with status
CREATE OR REPLACE FUNCTION sync_wine_is_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_active = (NEW.status = 'ACTIVE');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_wine_is_active
  BEFORE INSERT OR UPDATE OF status ON supplier_wines
  FOR EACH ROW
  EXECUTE FUNCTION sync_wine_is_active();

-- ============================================================================
-- ADD updated_at TRIGGER (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_supplier_wines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to avoid error
DROP TRIGGER IF EXISTS trigger_supplier_wines_updated_at ON supplier_wines;

CREATE TRIGGER trigger_supplier_wines_updated_at
  BEFORE UPDATE ON supplier_wines
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_wines_updated_at();
