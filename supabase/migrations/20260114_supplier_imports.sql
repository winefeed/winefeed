-- SUPPLIER IMPORTS & MATCHING FLOW
-- Migration: 20260114_supplier_imports
-- Purpose: Track CSV imports and matching results for Phase 1 vertical slice

-- ============================================================================
-- STEP 1: Supplier Imports Table (one record per CSV upload)
-- ============================================================================

CREATE TYPE import_status AS ENUM (
  'UPLOADED',      -- CSV uploaded, not parsed yet
  'PARSED',        -- CSV parsed into lines
  'MATCHING',      -- Matching in progress
  'MATCHED',       -- Matching complete
  'FAILED'         -- Import failed
);

CREATE TABLE supplier_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Upload metadata
  filename TEXT,
  uploaded_by UUID,  -- User who uploaded (NULL = system)

  -- Status tracking
  status import_status DEFAULT 'UPLOADED',

  -- Matching summary (populated after matching)
  total_lines INTEGER DEFAULT 0,
  auto_matched INTEGER DEFAULT 0,
  sampling_review INTEGER DEFAULT 0,
  needs_review INTEGER DEFAULT 0,
  no_match INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  matched_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT positive_totals CHECK (
    total_lines >= 0 AND
    auto_matched >= 0 AND
    sampling_review >= 0 AND
    needs_review >= 0 AND
    no_match >= 0 AND
    errors >= 0
  )
);

CREATE INDEX idx_imports_supplier ON supplier_imports(supplier_id);
CREATE INDEX idx_imports_status ON supplier_imports(status);
CREATE INDEX idx_imports_created ON supplier_imports(created_at DESC);

COMMENT ON TABLE supplier_imports IS 'One record per CSV price list upload';

-- ============================================================================
-- STEP 2: Supplier Import Lines Table (one record per CSV row)
-- ============================================================================

CREATE TYPE line_match_status AS ENUM (
  'PENDING',            -- Not matched yet
  'AUTO_MATCHED',       -- Auto-matched (confidence ≥90)
  'SAMPLING_REVIEW',    -- Auto-matched with sampling flag
  'NEEDS_REVIEW',       -- In review queue
  'NO_MATCH',           -- No match found (create new product)
  'ERROR'               -- Parsing or validation error
);

CREATE TABLE supplier_import_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES supplier_imports(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,

  -- Raw CSV data
  raw_data JSONB NOT NULL,  -- Original CSV row

  -- Normalized data (parsed from CSV)
  supplier_sku TEXT NOT NULL,
  gtin_each TEXT,
  gtin_case TEXT,
  producer_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  vintage INTEGER,
  volume_ml INTEGER NOT NULL,
  abv_percent DECIMAL(4,2),
  pack_type TEXT NOT NULL,
  units_per_case INTEGER,
  country_of_origin TEXT,
  region TEXT,
  grape_variety TEXT,

  -- Pricing (from CSV)
  price_ex_vat_sek DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'SEK',

  -- Matching result
  match_status line_match_status DEFAULT 'PENDING',
  match_decision TEXT,  -- AUTO_MATCH | SAMPLING_REVIEW | REVIEW_QUEUE | NO_MATCH
  confidence_score INTEGER,
  match_reasons TEXT[],
  guardrail_failures TEXT[],

  -- Matched product (if auto-matched)
  matched_product_id UUID REFERENCES master_products(id),
  matched_family_id UUID REFERENCES product_families(id),

  -- Content hash for deduplication
  content_hash TEXT,  -- hash(supplier_sku, producer, product, vintage, volume, pack)

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_import_line UNIQUE (import_id, line_number),
  CONSTRAINT positive_line_number CHECK (line_number > 0),
  CONSTRAINT valid_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))
);

CREATE INDEX idx_import_lines_import ON supplier_import_lines(import_id);
CREATE INDEX idx_import_lines_status ON supplier_import_lines(match_status);
CREATE INDEX idx_import_lines_sku ON supplier_import_lines(supplier_sku);
CREATE INDEX idx_import_lines_hash ON supplier_import_lines(content_hash);
CREATE INDEX idx_import_lines_matched_product ON supplier_import_lines(matched_product_id);

COMMENT ON TABLE supplier_import_lines IS 'One record per CSV row with matching results';
COMMENT ON COLUMN supplier_import_lines.content_hash IS 'Hash for deduplication (md5 of key fields)';

-- ============================================================================
-- STEP 3: Update product_match_review_queue to reference import lines
-- ============================================================================

-- Add import line reference to review queue (if table exists)
ALTER TABLE product_match_review_queue
ADD COLUMN IF NOT EXISTS import_line_id UUID REFERENCES supplier_import_lines(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_queue_import_line ON product_match_review_queue(import_line_id);

-- ============================================================================
-- STEP 4: Helper Functions
-- ============================================================================

-- Function to generate content hash for deduplication
CREATE OR REPLACE FUNCTION generate_line_hash(
  p_supplier_sku TEXT,
  p_producer TEXT,
  p_product TEXT,
  p_vintage INTEGER,
  p_volume_ml INTEGER,
  p_pack_type TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN md5(
    COALESCE(p_supplier_sku, '') || '|' ||
    COALESCE(p_producer, '') || '|' ||
    COALESCE(p_product, '') || '|' ||
    COALESCE(p_vintage::TEXT, 'NV') || '|' ||
    COALESCE(p_volume_ml::TEXT, '') || '|' ||
    COALESCE(p_pack_type, '')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_imports_updated_at BEFORE UPDATE ON supplier_imports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Row Level Security (RLS)
-- ============================================================================

ALTER TABLE supplier_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_import_lines ENABLE ROW LEVEL SECURITY;

-- Suppliers can only see their own imports
CREATE POLICY "Suppliers see own imports"
  ON supplier_imports FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Suppliers can create imports
CREATE POLICY "Suppliers create own imports"
  ON supplier_imports FOR INSERT
  WITH CHECK (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Suppliers can see their own import lines
CREATE POLICY "Suppliers see own import lines"
  ON supplier_import_lines FOR SELECT
  USING (
    import_id IN (
      SELECT id FROM supplier_imports WHERE supplier_id IN (
        SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
      )
    )
  );

-- Admin users can see all (implement based on your auth system)
-- Example placeholder:
-- CREATE POLICY "Admins see all imports" ON supplier_imports FOR ALL
--   USING (auth.jwt() ->> 'role' = 'admin');

COMMENT ON SCHEMA public IS 'Supplier imports tracking for CSV price list uploads';
