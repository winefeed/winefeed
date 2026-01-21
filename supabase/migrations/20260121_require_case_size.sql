/**
 * REQUIRE CASE_SIZE FOR LOGISTICS
 * Migration: 20260121_require_case_size
 *
 * Purpose: Make case_size mandatory for proper box/case handling
 *
 * Logic:
 * - stock_qty = total bottles in stock
 * - case_size = bottles per case (required, default 6)
 * - moq = minimum order quantity in bottles (default = case_size)
 * - Available cases = floor(stock_qty / case_size)
 * - Orders should be in multiples of case_size
 */

-- ============================================================================
-- STEP 1: Set default case_size where NULL
-- ============================================================================

UPDATE supplier_wines
SET case_size = 6
WHERE case_size IS NULL;

-- ============================================================================
-- STEP 2: Make case_size NOT NULL with default
-- ============================================================================

ALTER TABLE supplier_wines
ALTER COLUMN case_size SET NOT NULL,
ALTER COLUMN case_size SET DEFAULT 6;

-- ============================================================================
-- STEP 3: Add constraint to ensure valid case_size
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE supplier_wines
  DROP CONSTRAINT IF EXISTS valid_case_size;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE supplier_wines
ADD CONSTRAINT valid_case_size CHECK (case_size > 0 AND case_size <= 24);

-- ============================================================================
-- STEP 4: Ensure MOQ defaults to case_size if not set
-- ============================================================================

UPDATE supplier_wines
SET moq = case_size
WHERE moq IS NULL OR moq < case_size;

-- ============================================================================
-- STEP 5: Add helper function for available cases
-- ============================================================================

CREATE OR REPLACE FUNCTION get_available_cases(wine_id UUID)
RETURNS INTEGER AS $$
DECLARE
  wine RECORD;
BEGIN
  SELECT stock_qty, case_size INTO wine
  FROM supplier_wines
  WHERE id = wine_id;

  IF wine IS NULL THEN
    RETURN 0;
  END IF;

  RETURN FLOOR(wine.stock_qty::numeric / wine.case_size);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_cases IS 'Returns number of complete cases available for a wine';

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON COLUMN supplier_wines.case_size IS 'Bottles per case (Q/box) - required for logistics, default 6';
COMMENT ON COLUMN supplier_wines.stock_qty IS 'Total bottles in stock - only full cases are sellable';
COMMENT ON COLUMN supplier_wines.moq IS 'Minimum order quantity in bottles - should be multiple of case_size';
