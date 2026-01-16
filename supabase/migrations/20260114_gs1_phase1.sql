-- GS1 PHASE 1: MINIMAL MASTER DATA + GTIN VERIFICATION
-- Migration: 20260114_gs1_phase1
-- Purpose: Enable automatic product matching via GTIN with manual review queue

-- ============================================================================
-- STEP 1: Product Families (vintage-agnostic wine groups)
-- ============================================================================

CREATE TABLE product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wf_family_id TEXT UNIQUE NOT NULL,  -- WF-FAM-00001 (immutable)

  -- Wine identity
  producer TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_wine_identity UNIQUE (producer, wine_name, country)
);

CREATE INDEX idx_families_producer ON product_families(producer);
CREATE INDEX idx_families_country ON product_families(country);

COMMENT ON TABLE product_families IS 'Vintage-agnostic wine groups (e.g., "Château Margaux" = one family, multiple vintages)';

-- ============================================================================
-- STEP 2: Master Products (stable product records)
-- ============================================================================

CREATE TYPE pack_type AS ENUM ('bottle', 'case', 'magnum', 'other');
CREATE TYPE data_source AS ENUM ('gtin_verified', 'manual', 'fuzzy_match', 'supplier_import');

CREATE TABLE master_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wf_product_id TEXT UNIQUE NOT NULL,  -- WF-PROD-00001 (immutable, never reused)
  family_id UUID REFERENCES product_families(id) ON DELETE SET NULL,

  -- Product specs
  vintage INTEGER,  -- NULL = NV
  volume_ml INTEGER NOT NULL,
  pack_type pack_type NOT NULL DEFAULT 'bottle',
  units_per_case INTEGER DEFAULT 1,

  -- Provenance
  data_source data_source NOT NULL DEFAULT 'manual',
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_volume CHECK (volume_ml > 0),
  CONSTRAINT positive_units CHECK (units_per_case > 0)
);

CREATE INDEX idx_products_family ON master_products(family_id);
CREATE INDEX idx_products_vintage ON master_products(vintage);
CREATE INDEX idx_products_active ON master_products(is_active);
CREATE INDEX idx_products_data_source ON master_products(data_source);

COMMENT ON TABLE master_products IS 'Stable product records with immutable wf_product_id (never reused)';
COMMENT ON COLUMN master_products.wf_product_id IS 'Immutable golden key, never reused even if product deleted';

-- ============================================================================
-- STEP 3: Product GTIN Registry (GTIN → master_product mapping)
-- ============================================================================

CREATE TYPE gtin_level AS ENUM ('each', 'case', 'pallet');

CREATE TABLE product_gtin_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_product_id UUID NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,

  -- GTIN details
  gtin TEXT NOT NULL,  -- 14-digit GTIN-14 (padded)
  gtin_level gtin_level NOT NULL DEFAULT 'each',

  -- Verification status
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_source TEXT,  -- 'gs1_sweden' | 'manual' | 'supplier'

  -- Cached GS1 data
  gs1_data JSONB,  -- Full GS1 API response

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_gtin UNIQUE (gtin),
  CONSTRAINT valid_gtin_length CHECK (char_length(gtin) IN (8, 12, 13, 14))
);

CREATE INDEX idx_gtin_product ON product_gtin_registry(master_product_id);
CREATE INDEX idx_gtin_verified ON product_gtin_registry(is_verified);

COMMENT ON TABLE product_gtin_registry IS 'GTIN → master_product mapping with GS1 verification';
COMMENT ON COLUMN product_gtin_registry.gtin IS '14-digit GTIN-14 (zero-padded from shorter formats)';

-- ============================================================================
-- STEP 4: Supplier Product Mappings (supplier SKU → master_product)
-- ============================================================================

CREATE TYPE match_method AS ENUM ('gtin_exact', 'sku_existing', 'fuzzy_match', 'manual_override');

CREATE TABLE supplier_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku TEXT NOT NULL,
  master_product_id UUID NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,

  -- Match confidence
  match_confidence DECIMAL(3,2) NOT NULL,  -- 0.00-1.00
  match_method match_method NOT NULL,
  match_reasons TEXT[],  -- ['gtin_exact', 'volume_match', 'producer_match']

  -- Approval tracking
  approved_by_user_id UUID,  -- NULL = auto-approved (confidence >= 0.85)
  approved_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_supplier_sku UNIQUE (supplier_id, supplier_sku),
  CONSTRAINT valid_confidence CHECK (match_confidence >= 0 AND match_confidence <= 1)
);

CREATE INDEX idx_mappings_supplier ON supplier_product_mappings(supplier_id);
CREATE INDEX idx_mappings_product ON supplier_product_mappings(master_product_id);
CREATE INDEX idx_mappings_confidence ON supplier_product_mappings(match_confidence);

COMMENT ON TABLE supplier_product_mappings IS 'Supplier SKU → master_product mapping with confidence scoring';
COMMENT ON COLUMN supplier_product_mappings.match_confidence IS 'GTIN exact = 1.00, SKU existing = 0.90, fuzzy = 0.50-0.80';

-- ============================================================================
-- STEP 5: Product Match Review Queue (pending matches for human review)
-- ============================================================================

CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected', 'create_new');

CREATE TABLE product_match_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku TEXT NOT NULL,

  -- Raw supplier data
  supplier_data JSONB NOT NULL,  -- Full CSV row for context

  -- Match candidates (top 3)
  match_candidates JSONB,  -- [{master_product_id, confidence, reasons: []}]

  -- Review status
  status review_status DEFAULT 'pending',
  reviewed_by_user_id UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Resolution (if approved)
  approved_master_product_id UUID REFERENCES master_products(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_pending_sku UNIQUE (supplier_id, supplier_sku, status)
);

CREATE INDEX idx_queue_status ON product_match_review_queue(status);
CREATE INDEX idx_queue_supplier ON product_match_review_queue(supplier_id);
CREATE INDEX idx_queue_created ON product_match_review_queue(created_at);

COMMENT ON TABLE product_match_review_queue IS 'Pending product matches requiring human review (confidence < 0.85)';

-- ============================================================================
-- STEP 6: GTIN Verification Cache (GS1 API response cache)
-- ============================================================================

CREATE TABLE gtin_verification_cache (
  gtin TEXT PRIMARY KEY,  -- 14-digit GTIN-14

  -- Verification result
  verified BOOLEAN NOT NULL,  -- true if found in GS1, false if not found
  gs1_response JSONB,  -- Full GS1 API response

  -- Cache metadata
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,  -- TTL = 30 days for verified, 7 days for not found
  hit_count INTEGER DEFAULT 0,

  -- Constraints
  CONSTRAINT valid_cache_expiry CHECK (expires_at > cached_at)
);

CREATE INDEX idx_cache_expires ON gtin_verification_cache(expires_at);
CREATE INDEX idx_cache_verified ON gtin_verification_cache(verified);

COMMENT ON TABLE gtin_verification_cache IS 'GS1 API response cache (30-day TTL) to avoid real-time calls';

-- ============================================================================
-- STEP 7: Product Audit Log (append-only audit trail)
-- ============================================================================

CREATE TYPE audit_event_type AS ENUM (
  'product_created',
  'product_updated',
  'mapping_created',
  'mapping_approved',
  'mapping_rejected',
  'gtin_verified',
  'review_approved',
  'review_rejected'
);

CREATE TABLE product_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event metadata
  event_type audit_event_type NOT NULL,
  entity_type TEXT NOT NULL,  -- 'master_product' | 'supplier_mapping' | 'gtin_registry'
  entity_id UUID NOT NULL,

  -- Actor
  user_id UUID,  -- NULL = system action
  user_email TEXT,

  -- State snapshots
  before_state JSONB,
  after_state JSONB,

  -- Additional context
  metadata JSONB,  -- {import_batch_id, confidence, match_method, etc.}

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints (immutable)
  CONSTRAINT immutable_log CHECK (created_at = created_at)  -- Prevent updates
);

CREATE INDEX idx_audit_entity ON product_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_event ON product_audit_log(event_type);
CREATE INDEX idx_audit_user ON product_audit_log(user_id);
CREATE INDEX idx_audit_created ON product_audit_log(created_at);

COMMENT ON TABLE product_audit_log IS 'Append-only audit trail for all product/mapping changes (7-year retention)';

-- ============================================================================
-- STEP 8: Helper Functions
-- ============================================================================

-- Function to generate next wf_product_id
CREATE OR REPLACE FUNCTION generate_wf_product_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(wf_product_id FROM 9) AS INTEGER)), 0) + 1
  INTO next_num
  FROM master_products;

  RETURN 'WF-PROD-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate next wf_family_id
CREATE OR REPLACE FUNCTION generate_wf_family_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(wf_family_id FROM 8) AS INTEGER)), 0) + 1
  INTO next_num
  FROM product_families;

  RETURN 'WF-FAM-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON product_families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON master_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gtin_updated_at BEFORE UPDATE ON product_gtin_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mappings_updated_at BEFORE UPDATE ON supplier_product_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_updated_at BEFORE UPDATE ON product_match_review_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 9: Row Level Security (RLS)
-- ============================================================================

ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_gtin_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_match_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtin_verification_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_audit_log ENABLE ROW LEVEL SECURITY;

-- Suppliers can only see their own mappings
CREATE POLICY "Suppliers see own mappings"
  ON supplier_product_mappings FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Suppliers can only see their own review queue items
CREATE POLICY "Suppliers see own review queue"
  ON product_match_review_queue FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Admin users can see everything (implement based on your auth system)
-- Example placeholder:
-- CREATE POLICY "Admins see all" ON master_products FOR ALL
--   USING (auth.jwt() ->> 'role' = 'admin');

COMMENT ON SCHEMA public IS 'GS1 Phase 1: Minimal master data with GTIN verification and review queue';
