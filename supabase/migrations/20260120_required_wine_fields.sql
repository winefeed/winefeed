-- REQUIRED WINE CATALOG FIELDS
-- Migration: 20260120_required_wine_fields
-- Purpose: Enforce required fields for wine import based on pilot requirements

-- ============================================================================
-- DECISION: These fields are required for wine catalog import:
-- - sku (Reference/article_number) - unique identifier per supplier
-- - vintage - wine vintage year
-- - color (Type) - wine type (red, white, etc.)
-- - bottle_size_ml (Volume) - bottle size in ml
-- - stock_qty (Quantity) - available stock
-- ============================================================================

-- STEP 1: Update existing NULL values with placeholders before adding constraints
-- This allows the migration to run on existing data

-- Set default vintage to 0 (NV wines) where NULL
UPDATE supplier_wines SET vintage = 0 WHERE vintage IS NULL;

-- Set default color to 'red' where NULL (most common)
UPDATE supplier_wines SET color = 'red' WHERE color IS NULL;

-- Set default bottle_size_ml to 750 where NULL
UPDATE supplier_wines SET bottle_size_ml = 750 WHERE bottle_size_ml IS NULL;

-- Set default stock_qty to 0 where NULL
UPDATE supplier_wines SET stock_qty = 0 WHERE stock_qty IS NULL;

-- Set default sku to generated value where NULL
UPDATE supplier_wines
SET sku = 'AUTO-' || SUBSTRING(id::text, 1, 8)
WHERE sku IS NULL OR sku = '';

-- ============================================================================
-- STEP 2: Add NOT NULL constraints
-- ============================================================================

-- Make vintage required (0 = NV/Non-Vintage)
ALTER TABLE supplier_wines
ALTER COLUMN vintage SET NOT NULL;

-- Make color (wine type) required
ALTER TABLE supplier_wines
ALTER COLUMN color SET NOT NULL;

-- Make bottle_size_ml required with default
ALTER TABLE supplier_wines
ALTER COLUMN bottle_size_ml SET NOT NULL,
ALTER COLUMN bottle_size_ml SET DEFAULT 750;

-- Make stock_qty required with default 0
ALTER TABLE supplier_wines
ALTER COLUMN stock_qty SET NOT NULL,
ALTER COLUMN stock_qty SET DEFAULT 0;

-- Make sku required
ALTER TABLE supplier_wines
ALTER COLUMN sku SET NOT NULL;

-- ============================================================================
-- STEP 3: Add unique constraint for sku per supplier
-- ============================================================================

-- Each supplier's article numbers must be unique
DO $$ BEGIN
  ALTER TABLE supplier_wines
  ADD CONSTRAINT unique_supplier_sku UNIQUE (supplier_id, sku);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP 4: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN supplier_wines.sku IS 'Supplier article number (Reference) - required, unique per supplier';
COMMENT ON COLUMN supplier_wines.vintage IS 'Wine vintage year - required (use 0 for NV/Non-Vintage wines)';
COMMENT ON COLUMN supplier_wines.color IS 'Wine type (red, white, rose, sparkling, fortified, orange) - required';
COMMENT ON COLUMN supplier_wines.bottle_size_ml IS 'Bottle volume in ml (default 750) - required';
COMMENT ON COLUMN supplier_wines.stock_qty IS 'Available stock quantity in bottles - required (0 if out of stock)';

-- ============================================================================
-- STEP 5: Validation function for imports
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_wine_import_row(
  p_sku TEXT,
  p_name TEXT,
  p_producer TEXT,
  p_vintage INTEGER,
  p_country TEXT,
  p_color TEXT,
  p_bottle_size_ml INTEGER,
  p_price INTEGER,
  p_stock_qty INTEGER
) RETURNS TABLE (is_valid BOOLEAN, errors TEXT[]) AS $$
DECLARE
  error_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check required fields
  IF p_sku IS NULL OR p_sku = '' THEN
    error_list := array_append(error_list, 'Reference (sku) is required');
  END IF;

  IF p_name IS NULL OR p_name = '' THEN
    error_list := array_append(error_list, 'Cuvée (name) is required');
  END IF;

  IF p_producer IS NULL OR p_producer = '' THEN
    error_list := array_append(error_list, 'Producer is required');
  END IF;

  IF p_vintage IS NULL THEN
    error_list := array_append(error_list, 'Vintage is required (use 0 for NV)');
  ELSIF p_vintage < 0 OR (p_vintage > 0 AND p_vintage < 1900) OR p_vintage > 2100 THEN
    error_list := array_append(error_list, 'Vintage must be 0 (NV) or between 1900-2100');
  END IF;

  IF p_country IS NULL OR p_country = '' THEN
    error_list := array_append(error_list, 'Country is required');
  END IF;

  IF p_color IS NULL OR p_color = '' THEN
    error_list := array_append(error_list, 'Type (color) is required');
  ELSIF p_color NOT IN ('red', 'white', 'rose', 'sparkling', 'fortified', 'orange') THEN
    error_list := array_append(error_list, 'Type must be: red, white, rose, sparkling, fortified, or orange');
  END IF;

  IF p_bottle_size_ml IS NULL OR p_bottle_size_ml <= 0 THEN
    error_list := array_append(error_list, 'Volume (bottle_size_ml) is required and must be > 0');
  END IF;

  IF p_price IS NULL OR p_price <= 0 THEN
    error_list := array_append(error_list, 'List price is required and must be > 0');
  END IF;

  IF p_stock_qty IS NULL OR p_stock_qty < 0 THEN
    error_list := array_append(error_list, 'Quantity (stock_qty) is required and must be >= 0');
  END IF;

  RETURN QUERY SELECT array_length(error_list, 1) IS NULL OR array_length(error_list, 1) = 0, error_list;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_wine_import_row IS 'Validates a wine import row against required field rules';
