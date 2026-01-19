-- MOQ HANDLING & WINE CATALOG EXTENSION
-- Migration: 20260120_moq_and_wine_catalog (fixed)

-- ============================================================================
-- STEP 1: Add default MOQ settings to suppliers
-- ============================================================================

-- Add MOQ unit enum
DO $$ BEGIN
  CREATE TYPE moq_unit AS ENUM ('bottles', 'cases');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add shipping zone enum
DO $$ BEGIN
  CREATE TYPE shipping_zone AS ENUM ('sweden', 'eu', 'international');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend suppliers table with MOQ defaults
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS default_moq INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS moq_unit moq_unit DEFAULT 'bottles',
ADD COLUMN IF NOT EXISTS default_case_size INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS shipping_zone shipping_zone DEFAULT 'sweden';

-- Add constraints (drop first if exists)
DO $$ BEGIN
  ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS positive_default_moq;
  ALTER TABLE suppliers ADD CONSTRAINT positive_default_moq CHECK (default_moq > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS positive_case_size;
  ALTER TABLE suppliers ADD CONSTRAINT positive_case_size CHECK (default_case_size > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMENT ON COLUMN suppliers.default_moq IS 'Default minimum order quantity for this supplier';
COMMENT ON COLUMN suppliers.moq_unit IS 'Unit for MOQ: bottles or cases';
COMMENT ON COLUMN suppliers.default_case_size IS 'Default bottles per case (typically 6)';
COMMENT ON COLUMN suppliers.shipping_zone IS 'Shipping zone for delivery estimates';

-- ============================================================================
-- STEP 2: Add wine color enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE wine_color AS ENUM ('red', 'white', 'rose', 'sparkling', 'fortified', 'orange');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP 3: Extend supplier_wines with additional catalog fields
-- ============================================================================

ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS color wine_color,
ADD COLUMN IF NOT EXISTS alcohol_pct DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS bottle_size_ml INTEGER DEFAULT 750,
ADD COLUMN IF NOT EXISTS organic BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS biodynamic BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS case_size INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS appellation TEXT;

-- Rename min_order_qty to moq for consistency (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_wines' AND column_name = 'min_order_qty'
  ) THEN
    ALTER TABLE supplier_wines RENAME COLUMN min_order_qty TO moq;
  END IF;
END $$;

-- Ensure moq column exists
ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS moq INTEGER DEFAULT 6;

-- Add constraints for supplier_wines
DO $$ BEGIN
  ALTER TABLE supplier_wines DROP CONSTRAINT IF EXISTS positive_moq;
  ALTER TABLE supplier_wines ADD CONSTRAINT positive_moq CHECK (moq > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE supplier_wines DROP CONSTRAINT IF EXISTS positive_bottle_size;
  ALTER TABLE supplier_wines ADD CONSTRAINT positive_bottle_size CHECK (bottle_size_ml > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE supplier_wines DROP CONSTRAINT IF EXISTS positive_case_size_wine;
  ALTER TABLE supplier_wines ADD CONSTRAINT positive_case_size_wine CHECK (case_size > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE supplier_wines DROP CONSTRAINT IF EXISTS valid_alcohol;
  ALTER TABLE supplier_wines ADD CONSTRAINT valid_alcohol CHECK (alcohol_pct IS NULL OR (alcohol_pct >= 0 AND alcohol_pct <= 100));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_wines_sku ON supplier_wines(supplier_id, sku);
CREATE INDEX IF NOT EXISTS idx_supplier_wines_color ON supplier_wines(color);

COMMENT ON COLUMN supplier_wines.color IS 'Wine color: red, white, rose, sparkling, fortified, orange';
COMMENT ON COLUMN supplier_wines.moq IS 'Minimum order quantity in bottles (overrides supplier default)';
COMMENT ON COLUMN supplier_wines.case_size IS 'Bottles per case for this wine';
COMMENT ON COLUMN supplier_wines.sku IS 'Supplier article number';
COMMENT ON COLUMN supplier_wines.alcohol_pct IS 'Alcohol percentage';
COMMENT ON COLUMN supplier_wines.bottle_size_ml IS 'Bottle size in ml (default 750)';
COMMENT ON COLUMN supplier_wines.organic IS 'Certified organic';
COMMENT ON COLUMN supplier_wines.biodynamic IS 'Certified biodynamic';
COMMENT ON COLUMN supplier_wines.appellation IS 'Wine appellation (e.g. Saint-Julien, Barolo)';

-- ============================================================================
-- STEP 4: Create request_wines junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS request_wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  supplier_wine_id UUID REFERENCES supplier_wines(id) ON DELETE SET NULL,
  wine_name TEXT,
  producer TEXT,
  vintage TEXT,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  adjusted_quantity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint separately to handle existing table
DO $$ BEGIN
  ALTER TABLE request_wines ADD CONSTRAINT has_wine_info CHECK (
    supplier_wine_id IS NOT NULL OR wine_name IS NOT NULL
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_request_wines_request ON request_wines(request_id);
CREATE INDEX IF NOT EXISTS idx_request_wines_supplier_wine ON request_wines(supplier_wine_id);

ALTER TABLE request_wines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own request wines" ON request_wines;
CREATE POLICY "Users see own request wines" ON request_wines
  FOR ALL USING (
    request_id IN (SELECT id FROM requests WHERE restaurant_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role full access to request_wines" ON request_wines;
CREATE POLICY "Service role full access to request_wines" ON request_wines
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 5: Create wine_import_batches table
-- ============================================================================

CREATE TABLE IF NOT EXISTS wine_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  imported_by UUID REFERENCES auth.users(id),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'previewed', 'imported', 'failed')),
  error_message TEXT,
  validation_errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wine_import_batches_tenant ON wine_import_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wine_import_batches_supplier ON wine_import_batches(supplier_id);

ALTER TABLE wine_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access to wine_import_batches" ON wine_import_batches;
CREATE POLICY "Service role access to wine_import_batches" ON wine_import_batches
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 6: Helper function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_wine_moq(wine_id UUID)
RETURNS INTEGER AS $$
DECLARE
  wine_moq INTEGER;
  supplier_moq INTEGER;
BEGIN
  SELECT moq INTO wine_moq FROM supplier_wines WHERE id = wine_id;
  IF wine_moq IS NOT NULL THEN
    RETURN wine_moq;
  END IF;
  SELECT s.default_moq INTO supplier_moq
  FROM suppliers s
  JOIN supplier_wines sw ON sw.supplier_id = s.id
  WHERE sw.id = wine_id;
  RETURN COALESCE(supplier_moq, 6);
END;
$$ LANGUAGE plpgsql;
