-- PART 3 — Continue from: -- SECTION: 20260114_supplier_imports.sql

-- SECTION: 20260114_supplier_imports.sql
-- ============================================================================

-- SUPPLIER IMPORTS & MATCHING FLOW
-- Migration: 20260114_supplier_imports
-- Purpose: Track CSV imports and matching results for Phase 1 vertical slice

-- ============================================================================
-- STEP 1: Supplier Imports Table (one record per CSV upload)
-- ============================================================================

-- NOTE: import_status enum already exists (from create_imports_table).
-- This creates a SEPARATE type for supplier_imports with different values.
DO $$ BEGIN
  CREATE TYPE supplier_import_status AS ENUM (
    'UPLOADED',      -- CSV uploaded, not parsed yet
    'PARSED',        -- CSV parsed into lines
    'MATCHING',      -- Matching in progress
    'MATCHED',       -- Matching complete
    'FAILED'         -- Import failed
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE supplier_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Upload metadata
  filename TEXT,
  uploaded_by UUID,  -- User who uploaded (NULL = system)

  -- Status tracking
  status supplier_import_status DEFAULT 'UPLOADED',

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


-- ============================================================================
-- SECTION: 20260115_add_import_id_to_supplier_imports.sql
-- ============================================================================

-- Add import_id column to supplier_imports
-- Links CSV uploads (supplier_imports) to import cases (imports)
-- Nullable to maintain backwards compatibility with standalone CSV workflow

ALTER TABLE supplier_imports
ADD COLUMN import_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL;

-- SKIPPED: supplier_imports has no tenant_id column
-- CREATE INDEX idx_supplier_imports_tenant_import ON supplier_imports(tenant_id, import_id);

COMMENT ON COLUMN supplier_imports.import_id IS 'Optional link to import case (nullable for standalone CSV uploads)';


-- ============================================================================
-- SECTION: 20260115_create_wine_enrichment_table.sql
-- ============================================================================

-- ============================================================================
-- Wine Enrichment Table
-- ============================================================================
-- Purpose: Cache Wine-Searcher "Wine Check" results for normalization
-- Policy: NO PRICE DATA - only canonical name, producer, region, match score
-- ============================================================================

CREATE TYPE match_status_enum AS ENUM (
  'EXACT',      -- Perfect match found
  'FUZZY',      -- Close match found
  'MULTIPLE',   -- Multiple candidates found
  'NOT_FOUND',  -- No match found
  'ERROR'       -- API error
);

CREATE TABLE IF NOT EXISTS wine_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Query parameters (what user searched for)
  query_name TEXT NOT NULL,
  query_vintage TEXT,

  -- Normalized result (allowlist only)
  canonical_name TEXT,
  producer TEXT,
  region TEXT,
  appellation TEXT,
  match_score INTEGER, -- 0-100
  match_status match_status_enum NOT NULL,

  -- Candidates (for MULTIPLE/FUZZY matches)
  -- JSONB array of max 3 objects: { name, producer, region, appellation, score }
  candidates JSONB DEFAULT '[]'::jsonb,

  -- Wine-Searcher ID (optional, for future reference)
  ws_id TEXT,

  -- Cache metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Raw API response (DEV ONLY - never sent to client)
  -- CRITICAL: Must not contain price/offer/currency fields
  raw_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_match_score CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
  CONSTRAINT valid_candidates CHECK (jsonb_array_length(candidates) <= 3)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Lookup by tenant + query (cache hit)
CREATE UNIQUE INDEX idx_wine_enrichment_cache_key
  ON wine_enrichment(tenant_id, query_name, COALESCE(query_vintage, ''));

-- Query by tenant + status
CREATE INDEX idx_wine_enrichment_tenant_status
  ON wine_enrichment(tenant_id, match_status);

-- Cleanup expired entries
CREATE INDEX idx_wine_enrichment_expires
  ON wine_enrichment(expires_at);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE wine_enrichment ENABLE ROW LEVEL SECURITY;

-- Service role full access (for API routes)
CREATE POLICY "Service role full access" ON wine_enrichment FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation (for SELECT queries)
CREATE POLICY "Tenant isolation" ON wine_enrichment FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE wine_enrichment IS
  'Wine-Searcher Wine Check cache - NO PRICE DATA allowed';

COMMENT ON COLUMN wine_enrichment.raw_response IS
  'Raw API response (DEV ONLY) - never sent to client, must not contain price fields';

COMMENT ON COLUMN wine_enrichment.candidates IS
  'Max 3 alternative matches (JSONB array) - only name, producer, region, appellation, score';

-- ============================================================================
-- Cleanup Function (optional - remove expired entries)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_wine_enrichment()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM wine_enrichment
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_wine_enrichment IS
  'Removes expired wine enrichment cache entries. Can be run manually or via cron.';


-- ============================================================================
-- SECTION: 20260116_create_wine_masters.sql
-- ============================================================================

/**
 * WINE MASTERS TABLE
 *
 * Represents canonical wine identity (NOT a sellable variant)
 * A wine_master is the "Platonic ideal" of a wine - its core identity.
 *
 * Examples:
 * - "Château Margaux" from Bordeaux
 * - "Barolo Cannubi" from Piedmont
 *
 * NOT: vintage-specific or bottle-size-specific (those are wine_skus)
 *
 * Purpose:
 * - Central reference for LWIN identifiers
 * - Canonical naming authority
 * - Foundation for matching/deduplication
 */

CREATE TABLE IF NOT EXISTS wine_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core identity (from Wine-Searcher or manual)
  canonical_name TEXT,
  producer TEXT,
  country TEXT,
  region TEXT,
  appellation TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wine_masters_tenant ON wine_masters(tenant_id);
CREATE INDEX idx_wine_masters_canonical ON wine_masters(tenant_id, canonical_name);
CREATE INDEX idx_wine_masters_producer ON wine_masters(tenant_id, producer);

-- Comments
COMMENT ON TABLE wine_masters IS 'Canonical wine identities (not sellable variants)';
COMMENT ON COLUMN wine_masters.canonical_name IS 'Normalized wine name from Wine-Searcher or manual entry';
COMMENT ON COLUMN wine_masters.producer IS 'Canonical producer name';
COMMENT ON COLUMN wine_masters.region IS 'Wine region (e.g. Bordeaux, Tuscany)';
COMMENT ON COLUMN wine_masters.appellation IS 'Specific appellation/denomination (e.g. Margaux, Barolo DOCG)';


-- ============================================================================
-- SECTION: 20260116_create_wine_skus.sql
-- ============================================================================

/**
 * WINE SKUS TABLE
 *
 * Represents sellable wine variants (vintage + bottle size + packaging)
 * A wine_sku is a specific, orderable product.
 *
 * Examples:
 * - "Château Margaux 2015, 750ml bottle" (SKU 1)
 * - "Château Margaux 2015, 6x750ml case" (SKU 2)
 * - "Château Margaux 2016, 750ml bottle" (SKU 3)
 *
 * Relationship:
 * - wine_sku belongs to ONE wine_master
 * - wine_master can have MANY wine_skus
 *
 * Purpose:
 * - Central reference for GTIN identifiers
 * - Inventory/pricing/ordering unit
 * - Foundation for supplier catalog mapping
 */

CREATE TABLE IF NOT EXISTS wine_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Identity (belongs to wine_master)
  wine_master_id UUID NOT NULL REFERENCES wine_masters(id) ON DELETE CASCADE,

  -- Variant attributes
  vintage INTEGER CHECK (vintage IS NULL OR (vintage >= 1800 AND vintage <= 2100)),
  bottle_ml INTEGER CHECK (bottle_ml IS NULL OR bottle_ml > 0),  -- e.g. 750, 1500, 375
  packaging TEXT,  -- e.g. "6x750ml", "12x750ml", "single", "magnum"

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_wine_sku UNIQUE (tenant_id, wine_master_id, COALESCE(vintage, 0), COALESCE(bottle_ml, 0), COALESCE(packaging, ''))
);

-- Indexes
CREATE INDEX idx_wine_skus_tenant ON wine_skus(tenant_id);
CREATE INDEX idx_wine_skus_master ON wine_skus(wine_master_id);
CREATE INDEX idx_wine_skus_tenant_master_vintage ON wine_skus(tenant_id, wine_master_id, vintage, bottle_ml);

-- Comments
COMMENT ON TABLE wine_skus IS 'Sellable wine variants (vintage + bottle size + packaging)';
COMMENT ON COLUMN wine_skus.wine_master_id IS 'Reference to canonical wine identity';
COMMENT ON COLUMN wine_skus.vintage IS 'Wine vintage year (NULL for NV/multi-vintage)';
COMMENT ON COLUMN wine_skus.bottle_ml IS 'Bottle volume in milliliters (750, 1500, etc.)';
COMMENT ON COLUMN wine_skus.packaging IS 'Packaging description (case size, single bottle, etc.)';


-- ============================================================================
-- SECTION: 20260116_create_match_results.sql
-- ============================================================================

/**
 * MATCH RESULTS TABLE
 *
 * Audit trail for all product matching operations
 * Tracks how incoming products were matched to internal entities
 *
 * Purpose:
 * - Debuggability: trace why a match was made
 * - Quality control: review low-confidence matches
 * - Analytics: understand matching patterns
 * - Audit: compliance and traceability
 *
 * Match Methods (Hierarchy):
 * 1. GTIN_EXACT - GTIN barcode exact match
 * 2. LWIN_EXACT - LWIN identifier exact match
 * 3. SKU_EXACT - Producer/Importer SKU exact match
 * 4. CANONICAL_SUGGEST - Wine-Searcher canonicalization fallback
 * 5. MANUAL - User manually linked
 *
 * Match Status:
 * - AUTO_MATCH: High confidence, auto-accepted
 * - AUTO_MATCH_WITH_GUARDS: Medium confidence, auto-accepted with validation
 * - SUGGESTED: Low-medium confidence, needs review
 * - CONFIRMED: User confirmed suggested match
 * - REJECTED: User rejected match
 */

CREATE TYPE match_method_enum AS ENUM (
  'GTIN_EXACT',
  'LWIN_EXACT',
  'SKU_EXACT',
  'CANONICAL_SUGGEST',
  'MANUAL',
  'NO_MATCH'
);

-- NOTE: match_status_enum already exists (from wine_enrichment).
-- This creates a SEPARATE type for match_results with different values.
DO $$ BEGIN
  CREATE TYPE match_result_status AS ENUM (
    'AUTO_MATCH',
    'AUTO_MATCH_WITH_GUARDS',
    'SUGGESTED',
    'CONFIRMED',
    'REJECTED',
    'PENDING_REVIEW'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Source (what triggered this match attempt)
  source_type TEXT NOT NULL CHECK (source_type IN ('supplier_import_row', 'offer_line', 'importcase_line', 'manual')),
  source_id UUID NOT NULL,

  -- Match result
  matched_entity_type TEXT CHECK (matched_entity_type IS NULL OR matched_entity_type IN ('wine_sku', 'wine_master')),
  matched_entity_id UUID,

  -- Match metadata
  match_method match_method_enum NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status match_result_status NOT NULL,

  -- Explanation (human-readable reason)
  explanation TEXT,

  -- Candidates (top alternatives, max 5)
  candidates JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT match_requires_entity CHECK (
    (status IN ('AUTO_MATCH', 'AUTO_MATCH_WITH_GUARDS', 'CONFIRMED') AND matched_entity_id IS NOT NULL)
    OR
    (status IN ('SUGGESTED', 'REJECTED', 'PENDING_REVIEW'))
  ),
  CONSTRAINT candidates_array CHECK (
    candidates IS NULL OR jsonb_typeof(candidates) = 'array'
  )
);

-- Indexes
CREATE INDEX idx_match_results_tenant ON match_results(tenant_id);
CREATE INDEX idx_match_results_source ON match_results(tenant_id, source_type, source_id);
CREATE INDEX idx_match_results_status ON match_results(tenant_id, status);
CREATE INDEX idx_match_results_method ON match_results(tenant_id, match_method);
CREATE INDEX idx_match_results_entity ON match_results(matched_entity_type, matched_entity_id);

-- Comments
COMMENT ON TABLE match_results IS 'Audit trail for product matching operations';
COMMENT ON COLUMN match_results.source_type IS 'What triggered this match: supplier_import_row, offer_line, importcase_line, manual';
COMMENT ON COLUMN match_results.source_id IS 'UUID of the source entity';
COMMENT ON COLUMN match_results.matched_entity_type IS 'Type of matched entity: wine_sku or wine_master';
COMMENT ON COLUMN match_results.matched_entity_id IS 'UUID of matched wine_sku or wine_master';
COMMENT ON COLUMN match_results.match_method IS 'How the match was found: GTIN_EXACT, LWIN_EXACT, SKU_EXACT, etc.';
COMMENT ON COLUMN match_results.confidence IS 'Match confidence 0-1 (1 = certain, <1 = review recommended)';
COMMENT ON COLUMN match_results.status IS 'Match status: AUTO_MATCH, SUGGESTED, CONFIRMED, REJECTED, etc.';
COMMENT ON COLUMN match_results.explanation IS 'Human-readable explanation of why this match was made';
COMMENT ON COLUMN match_results.candidates IS 'Top alternative matches (max 5) as JSON array';


-- ============================================================================
-- SECTION: 20260116_create_product_identifiers.sql
-- ============================================================================

/**
 * PRODUCT IDENTIFIERS TABLE
 *
 * Multi-tenant registry of product identifiers (GTIN, LWIN, SKUs, etc.)
 * Links external identifiers to internal entities (wine_masters, wine_skus)
 *
 * Purpose:
 * - Central lookup for matching incoming products
 * - Support multiple identifier types per entity
 * - Track identifier provenance (source, issuer, confidence)
 *
 * Identifier Types:
 * - GTIN: Global Trade Item Number (barcode) → wine_sku
 * - LWIN: Liv-ex Wine Identification Number → wine_master
 * - PRODUCER_SKU: Producer's internal SKU → wine_sku or wine_master
 * - IMPORTER_SKU: Importer's internal SKU → wine_sku or wine_master
 * - WS_ID: Wine-Searcher internal ID → wine_master
 *
 * Hierarchy:
 * 1. GTIN (strongest) → wine_sku
 * 2. LWIN (strong) → wine_master
 * 3. PRODUCER_SKU (medium, requires issuer match) → entity
 * 4. IMPORTER_SKU (medium, requires issuer match) → entity
 * 5. WS_ID (weak, for reference) → wine_master
 */

CREATE TABLE IF NOT EXISTS product_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('wine_master', 'wine_sku')),
  entity_id UUID NOT NULL,

  -- Identifier details
  id_type TEXT NOT NULL CHECK (id_type IN ('GTIN', 'LWIN', 'PRODUCER_SKU', 'IMPORTER_SKU', 'WS_ID')),
  id_value TEXT NOT NULL,

  -- Issuer context (for scoped identifiers like PRODUCER_SKU)
  issuer_type TEXT CHECK (issuer_type IS NULL OR issuer_type IN ('producer', 'importer')),
  issuer_id UUID,  -- Reference to suppliers.id or importers.id

  -- Provenance
  source TEXT,  -- 'manual' | 'supplier_csv' | 'wine_searcher' | 'importer_csv'
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_identifier UNIQUE (
    tenant_id,
    id_type,
    id_value,
    COALESCE(issuer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ),

  -- Validation rules
  CONSTRAINT gtin_requires_sku CHECK (
    id_type != 'GTIN' OR entity_type = 'wine_sku'
  ),
  CONSTRAINT lwin_requires_master CHECK (
    id_type != 'LWIN' OR entity_type = 'wine_master'
  ),
  CONSTRAINT producer_sku_requires_issuer CHECK (
    id_type != 'PRODUCER_SKU' OR (issuer_type = 'producer' AND issuer_id IS NOT NULL)
  ),
  CONSTRAINT importer_sku_requires_issuer CHECK (
    id_type != 'IMPORTER_SKU' OR (issuer_type = 'importer' AND issuer_id IS NOT NULL)
  )
);

-- Indexes for fast lookups
CREATE INDEX idx_product_identifiers_tenant ON product_identifiers(tenant_id);
CREATE INDEX idx_product_identifiers_lookup ON product_identifiers(tenant_id, id_type, id_value);
CREATE INDEX idx_product_identifiers_issuer_lookup ON product_identifiers(tenant_id, issuer_id, id_type, id_value);
CREATE INDEX idx_product_identifiers_entity ON product_identifiers(entity_type, entity_id);

-- Comments
COMMENT ON TABLE product_identifiers IS 'Registry of external identifiers mapped to internal wine entities';
COMMENT ON COLUMN product_identifiers.entity_type IS 'Type of entity: wine_master (identity) or wine_sku (sellable variant)';
COMMENT ON COLUMN product_identifiers.entity_id IS 'UUID of wine_master or wine_sku';
COMMENT ON COLUMN product_identifiers.id_type IS 'Type of identifier: GTIN, LWIN, PRODUCER_SKU, IMPORTER_SKU, WS_ID';
COMMENT ON COLUMN product_identifiers.id_value IS 'Actual identifier value (barcode, SKU code, etc.)';
COMMENT ON COLUMN product_identifiers.issuer_type IS 'Who issued this identifier (producer or importer)';
COMMENT ON COLUMN product_identifiers.issuer_id IS 'Reference to suppliers or importers table';
COMMENT ON COLUMN product_identifiers.source IS 'How this identifier was registered (manual, CSV import, Wine-Searcher)';
COMMENT ON COLUMN product_identifiers.confidence IS 'Match confidence 0-1 (1 = certain, <1 = needs review)';


-- ============================================================================
-- SECTION: 20260116_enable_rls_matching_tables.sql
-- ============================================================================

/**
 * ROW LEVEL SECURITY (RLS) POLICIES
 *
 * Enable RLS and create tenant isolation policies for matching tables
 * Follows same pattern as existing tables (imports, import_documents, etc.)
 */

-- ============================================================================
-- Enable RLS on all matching tables
-- ============================================================================

ALTER TABLE wine_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Service role full access (for API routes)
-- ============================================================================

-- wine_masters
CREATE POLICY "Service role full access on wine_masters"
  ON wine_masters FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- wine_skus
CREATE POLICY "Service role full access on wine_skus"
  ON wine_skus FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- product_identifiers
CREATE POLICY "Service role full access on product_identifiers"
  ON product_identifiers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- match_results
CREATE POLICY "Service role full access on match_results"
  ON match_results FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Tenant isolation (if using custom JWT claims)
-- ============================================================================

-- wine_masters: tenant isolation for SELECT
CREATE POLICY "Tenant isolation on wine_masters"
  ON wine_masters FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- wine_skus: tenant isolation for SELECT
CREATE POLICY "Tenant isolation on wine_skus"
  ON wine_skus FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- product_identifiers: tenant isolation for SELECT
CREATE POLICY "Tenant isolation on product_identifiers"
  ON product_identifiers FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- match_results: tenant isolation for SELECT
CREATE POLICY "Tenant isolation on match_results"
  ON match_results FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Service role full access on wine_masters" ON wine_masters IS 'API routes use service role to bypass RLS';
COMMENT ON POLICY "Service role full access on wine_skus" ON wine_skus IS 'API routes use service role to bypass RLS';
COMMENT ON POLICY "Service role full access on product_identifiers" ON product_identifiers IS 'API routes use service role to bypass RLS';
COMMENT ON POLICY "Service role full access on match_results" ON match_results IS 'API routes use service role to bypass RLS';

COMMENT ON POLICY "Tenant isolation on wine_masters" ON wine_masters IS 'Users can only see wine_masters from their tenant';
COMMENT ON POLICY "Tenant isolation on wine_skus" ON wine_skus IS 'Users can only see wine_skus from their tenant';
COMMENT ON POLICY "Tenant isolation on product_identifiers" ON product_identifiers IS 'Users can only see product_identifiers from their tenant';
COMMENT ON POLICY "Tenant isolation on match_results" ON match_results IS 'Users can only see match_results from their tenant';


-- ============================================================================
-- SECTION: 20260117_add_match_results_source_created_index.sql
-- ============================================================================

/**
 * ADD INDEX FOR EFFICIENT LATEST MATCH LOOKUP
 *
 * Purpose: Enable efficient queries for "latest match per source"
 * Used by: GET /api/offers/[id] to fetch latest_match per offer_line
 *
 * Query pattern:
 * SELECT DISTINCT ON (source_id) *
 * FROM match_results
 * WHERE tenant_id = ? AND source_type = 'offer_line' AND source_id IN (...)
 * ORDER BY source_id, created_at DESC;
 *
 * This index supports the ORDER BY created_at DESC for fast retrieval
 */

-- Add index for (tenant_id, source_type, source_id, created_at DESC)
-- Note: Keep existing idx_match_results_source as it's still useful for other queries
CREATE INDEX IF NOT EXISTS idx_match_results_source_created
  ON match_results(tenant_id, source_type, source_id, created_at DESC);

-- Comment
COMMENT ON INDEX idx_match_results_source_created IS 'Efficient lookup of latest match per source (DISTINCT ON pattern)';


-- ============================================================================
-- SECTION: 20260117_create_match_health_pings.sql
-- ============================================================================

/**
 * MATCH HEALTH PINGS TABLE
 *
 * Minimal table for safe write-test in health checks
 * Used to verify database write permissions without touching match_results
 *
 * Policy:
 * - DEV: Allow insert 1 ping per request
 * - PROD: Skip write test entirely (read-only mode)
 */

CREATE TABLE IF NOT EXISTS match_health_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT NULL
);

-- Index for tenant isolation and cleanup queries
CREATE INDEX idx_match_health_pings_tenant ON match_health_pings(tenant_id);
CREATE INDEX idx_match_health_pings_created ON match_health_pings(created_at DESC);

-- Enable RLS
ALTER TABLE match_health_pings ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access (API routes use service role)
CREATE POLICY "Service role full access" ON match_health_pings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Tenant isolation for direct access
CREATE POLICY "Tenant isolation" ON match_health_pings FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

COMMENT ON TABLE match_health_pings IS 'Health check write test table - minimal footprint, safe for dev write tests';
COMMENT ON COLUMN match_health_pings.note IS 'Optional context for health check (e.g., "healthcheck", "status-api")';


-- ============================================================================
-- END OF PART 3
