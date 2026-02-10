-- PART 2 — Continue from: -- SECTION: 20260114_commercial_intent.sql

-- SECTION: 20260114_commercial_intent.sql
-- ============================================================================

-- COMMERCIAL INTENT & OFFER ACCEPTANCE
-- Migration: 20260114_commercial_intent
-- Purpose: Enable restaurant to accept offers and create commercial intents

-- ============================================================================
-- STEP 1: Create CommercialIntent table
-- ============================================================================

CREATE TABLE commercial_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  quote_request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  accepted_offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  -- Snapshots at time of acceptance (amounts in öre for precision)
  total_goods_amount_ore INT NOT NULL,       -- Price ex VAT * quantity
  shipping_amount_ore INT DEFAULT 0,         -- Shipping cost (0 in MVP)
  vat_amount_ore INT NOT NULL,               -- Goods * VAT rate
  service_fee_amount_ore INT DEFAULT 0,      -- Winefeed service fee (0 in MVP)
  total_payable_estimate_ore INT NOT NULL,   -- Sum of all above

  -- VAT rate snapshot
  vat_rate DECIMAL(4,2) NOT NULL,            -- e.g., 25.00

  -- Wine details snapshot
  wine_name TEXT NOT NULL,
  wine_producer TEXT NOT NULL,
  quantity INT NOT NULL,

  -- Delivery snapshot
  estimated_delivery_date DATE,
  lead_time_days INT NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),

  -- Metadata
  goods_seller_id UUID NOT NULL REFERENCES suppliers(id),  -- Who sells the wine

  -- Timestamps
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_amounts CHECK (
    total_goods_amount_ore > 0 AND
    vat_amount_ore >= 0 AND
    total_payable_estimate_ore > 0 AND
    quantity > 0
  ),
  CONSTRAINT valid_vat_rate CHECK (vat_rate >= 0 AND vat_rate <= 100),

  -- CRITICAL: Only one accepted offer per quote request
  CONSTRAINT unique_quote_request UNIQUE (quote_request_id)
);

-- Indexes
CREATE INDEX idx_commercial_intents_quote_request ON commercial_intents(quote_request_id);
CREATE INDEX idx_commercial_intents_restaurant ON commercial_intents(restaurant_id);
CREATE INDEX idx_commercial_intents_supplier ON commercial_intents(supplier_id);
CREATE INDEX idx_commercial_intents_status ON commercial_intents(status);

-- ============================================================================
-- STEP 2: Add index to offers table for faster lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_offers_quote_request ON offers(request_id);

-- ============================================================================
-- STEP 3: Enable RLS on CommercialIntent
-- ============================================================================

ALTER TABLE commercial_intents ENABLE ROW LEVEL SECURITY;

-- Restaurants can see their own commercial intents
CREATE POLICY "Restaurants see own commercial intents"
  ON commercial_intents FOR SELECT
  USING (restaurant_id = auth.uid());

-- Suppliers can see commercial intents where they are the supplier
CREATE POLICY "Suppliers see their commercial intents"
  ON commercial_intents FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Only service role can create commercial intents (via API)
-- (No INSERT policy means only service role)

-- ============================================================================
-- STEP 4: Helper functions
-- ============================================================================

-- Function to check if offer can be accepted
CREATE OR REPLACE FUNCTION can_accept_offer(
  p_offer_id UUID,
  p_restaurant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_offer RECORD;
  v_assignment RECORD;
  v_existing_intent UUID;
BEGIN
  -- Get offer details
  SELECT o.*, r.restaurant_id
  INTO v_offer
  FROM offers o
  JOIN requests r ON o.request_id = r.id
  WHERE o.id = p_offer_id;

  -- Offer not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Restaurant doesn't own the quote request
  IF v_offer.restaurant_id != p_restaurant_id THEN
    RETURN FALSE;
  END IF;

  -- Check if assignment exists and is not expired
  SELECT *
  INTO v_assignment
  FROM quote_request_assignments
  WHERE quote_request_id = v_offer.request_id
    AND supplier_id = v_offer.supplier_id;

  -- No assignment found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Assignment expired
  IF v_assignment.expires_at < NOW() OR v_assignment.status = 'EXPIRED' THEN
    RETURN FALSE;
  END IF;

  -- Check if quote request already has a commercial intent
  SELECT id INTO v_existing_intent
  FROM commercial_intents
  WHERE quote_request_id = v_offer.request_id;

  -- Already accepted
  IF FOUND THEN
    RETURN FALSE;
  END IF;

  -- All checks passed
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_accept_offer IS
  'Validates if a restaurant can accept an offer. Checks ownership, assignment validity, and concurrency.';

-- ============================================================================
-- STEP 5: Audit trail
-- ============================================================================

-- Add trigger for updated_at
CREATE TRIGGER update_commercial_intents_updated_at
  BEFORE UPDATE ON commercial_intents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: Comments for documentation
-- ============================================================================

COMMENT ON TABLE commercial_intents IS
  'Represents a restaurants acceptance of a supplier offer. Creates a snapshot of pricing and terms at acceptance time. One per quote request (enforced by UNIQUE constraint).';

COMMENT ON COLUMN commercial_intents.total_goods_amount_ore IS
  'Total cost of goods excluding VAT (price_ex_vat * quantity) in öre';

COMMENT ON COLUMN commercial_intents.vat_amount_ore IS
  'VAT amount calculated from goods amount and VAT rate, in öre';

COMMENT ON COLUMN commercial_intents.service_fee_amount_ore IS
  'Winefeed service fee (0 in MVP, future pricing model)';

COMMENT ON COLUMN commercial_intents.goods_seller_id IS
  'The supplier who actually sells the wine (always supplier_id in MVP, important for compliance)';

COMMENT ON CONSTRAINT unique_quote_request ON commercial_intents IS
  'Ensures only one offer can be accepted per quote request (prevents double-acceptance)';


-- ============================================================================
-- SECTION: 20260114_commercial_intent_patch.sql
-- ============================================================================

-- COMMERCIAL INTENT PATCH: Add service_fee_mode for pilot tracking
-- Migration: 20260114_commercial_intent_patch
-- Purpose: Track service fee mode for future monetization

-- ============================================================================
-- Add service_fee_mode column
-- ============================================================================

-- Add enum type for service fee modes
CREATE TYPE service_fee_mode AS ENUM (
  'PILOT_FREE',        -- MVP: Free during pilot phase
  'PERCENTAGE',        -- Future: Percentage-based fee
  'FIXED_PER_ORDER',   -- Future: Fixed fee per order
  'TIERED'             -- Future: Tiered pricing
);

-- Add column to commercial_intents
ALTER TABLE commercial_intents
  ADD COLUMN service_fee_mode service_fee_mode DEFAULT 'PILOT_FREE';

-- Update existing records (if any)
UPDATE commercial_intents
  SET service_fee_mode = 'PILOT_FREE'
  WHERE service_fee_mode IS NULL;

-- Make it NOT NULL after backfilling
ALTER TABLE commercial_intents
  ALTER COLUMN service_fee_mode SET NOT NULL;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN commercial_intents.service_fee_mode IS
  'Tracks how service fee was calculated: PILOT_FREE (MVP), PERCENTAGE, FIXED_PER_ORDER, or TIERED (future)';

COMMENT ON TYPE service_fee_mode IS
  'Service fee calculation mode. PILOT_FREE during MVP phase (0 SEK), other modes for future monetization.';


-- ============================================================================
-- SECTION: 20260114_direct_delivery_locations.sql
-- ============================================================================

-- ============================================================================
-- DIRECT DELIVERY LOCATION (DDL) COMPLIANCE SYSTEM
-- Migration: 20260114_direct_delivery_locations
-- Purpose: Skatteverket "Direkt leveransplats" (form 5369_03) automation
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE ddl_status AS ENUM (
  'NOT_REGISTERED',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE ddl_document_type AS ENUM (
  'SKV_5369_03'
);

-- ============================================================================
-- TABLE 1: direct_delivery_locations
-- ============================================================================

CREATE TABLE direct_delivery_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,

  -- Legal entity info (from Bolagsverket)
  legal_name TEXT NOT NULL,
  org_number TEXT NOT NULL,

  -- Delivery address (locked after verification)
  delivery_address_line1 TEXT NOT NULL,
  delivery_address_line2 TEXT,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'SE',

  -- Contact person
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,

  -- Consent tracking
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_timestamp TIMESTAMPTZ,

  -- Status workflow
  status ddl_status NOT NULL DEFAULT 'NOT_REGISTERED',
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Current document reference
  current_document_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_consent CHECK (
    (consent_given = true AND consent_timestamp IS NOT NULL) OR
    (consent_given = false AND consent_timestamp IS NULL)
  ),
  CONSTRAINT valid_country CHECK (country_code = 'SE'),
  CONSTRAINT valid_org_number CHECK (org_number ~ '^\d{6}-\d{4}$'),
  CONSTRAINT valid_email CHECK (contact_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),

  -- Unique constraint: one DDL per tenant + restaurant + importer + address combo
  CONSTRAINT unique_ddl_per_address UNIQUE (
    tenant_id,
    restaurant_id,
    importer_id,
    delivery_address_line1,
    postal_code,
    city
  )
);

-- Indexes for performance
CREATE INDEX idx_ddl_tenant ON direct_delivery_locations(tenant_id);
CREATE INDEX idx_ddl_restaurant ON direct_delivery_locations(restaurant_id);
CREATE INDEX idx_ddl_importer ON direct_delivery_locations(importer_id);
CREATE INDEX idx_ddl_status ON direct_delivery_locations(status);
CREATE INDEX idx_ddl_org_number ON direct_delivery_locations(org_number);

COMMENT ON TABLE direct_delivery_locations IS 'Skatteverket Direct Delivery Location (Direkt leveransplats) registrations';
COMMENT ON COLUMN direct_delivery_locations.org_number IS 'Swedish organization number (format: NNNNNN-NNNN)';
COMMENT ON COLUMN direct_delivery_locations.status IS 'Workflow status for Skatteverket approval process';
COMMENT ON COLUMN direct_delivery_locations.consent_given IS 'User consent for Skatteverket registration';

-- ============================================================================
-- TABLE 2: ddl_documents
-- ============================================================================

CREATE TABLE ddl_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ddl_id UUID NOT NULL REFERENCES direct_delivery_locations(id) ON DELETE CASCADE,

  -- Document metadata
  document_type ddl_document_type NOT NULL DEFAULT 'SKV_5369_03',
  version INTEGER NOT NULL,

  -- File storage
  file_url TEXT NOT NULL,
  file_hash TEXT NOT NULL,

  -- Audit info
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Additional metadata
  metadata_json JSONB,

  -- Constraints
  CONSTRAINT positive_version CHECK (version > 0),
  CONSTRAINT unique_ddl_version UNIQUE (ddl_id, version)
);

-- Indexes
CREATE INDEX idx_ddl_docs_tenant ON ddl_documents(tenant_id);
CREATE INDEX idx_ddl_docs_ddl ON ddl_documents(ddl_id);
CREATE INDEX idx_ddl_docs_created ON ddl_documents(created_at DESC);

COMMENT ON TABLE ddl_documents IS 'Document archive with versioning for DDL applications';
COMMENT ON COLUMN ddl_documents.version IS 'Incremental version number (1, 2, 3...)';
COMMENT ON COLUMN ddl_documents.file_hash IS 'SHA-256 hash of PDF content for integrity verification';
COMMENT ON COLUMN ddl_documents.metadata_json IS 'Additional metadata: { date, internal_reference, generation_params }';

-- ============================================================================
-- TABLE 3: ddl_status_events
-- ============================================================================

CREATE TABLE ddl_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ddl_id UUID NOT NULL REFERENCES direct_delivery_locations(id) ON DELETE CASCADE,

  -- Status transition
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  note TEXT,

  -- Audit info
  changed_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ddl_events_tenant ON ddl_status_events(tenant_id);
CREATE INDEX idx_ddl_events_ddl ON ddl_status_events(ddl_id);
CREATE INDEX idx_ddl_events_created ON ddl_status_events(created_at DESC);

COMMENT ON TABLE ddl_status_events IS 'Audit trail for all DDL status changes';
COMMENT ON COLUMN ddl_status_events.from_status IS 'Previous status before change';
COMMENT ON COLUMN ddl_status_events.to_status IS 'New status after change';
COMMENT ON COLUMN ddl_status_events.note IS 'Optional note explaining the status change';

-- ============================================================================
-- FOREIGN KEY: current_document_id
-- ============================================================================

-- Add FK constraint after ddl_documents table exists
ALTER TABLE direct_delivery_locations
ADD CONSTRAINT fk_current_document
FOREIGN KEY (current_document_id)
REFERENCES ddl_documents(id)
ON DELETE SET NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_ddl_updated_at
BEFORE UPDATE ON direct_delivery_locations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE direct_delivery_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ddl_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ddl_status_events ENABLE ROW LEVEL SECURITY;

-- Policy 1: Restaurant users see only their own DDLs
CREATE POLICY "restaurants_own_ddls"
  ON direct_delivery_locations FOR SELECT
  USING (
    tenant_id = auth.tenant_id() AND
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE tenant_id = auth.tenant_id()
        AND id = auth.restaurant_id()
    )
  );

-- Policy 2: Restaurant users can create their own DDLs
CREATE POLICY "restaurants_create_ddls"
  ON direct_delivery_locations FOR INSERT
  WITH CHECK (
    tenant_id = auth.tenant_id() AND
    restaurant_id = auth.restaurant_id()
  );

-- Policy 3: Restaurant users can update their own DDLs (NOT_REGISTERED or REJECTED only)
CREATE POLICY "restaurants_update_own_ddls"
  ON direct_delivery_locations FOR UPDATE
  USING (
    tenant_id = auth.tenant_id() AND
    restaurant_id = auth.restaurant_id() AND
    status IN ('NOT_REGISTERED', 'REJECTED')
  );

-- Policy 4: Compliance admins see all DDLs in their tenant
CREATE POLICY "compliance_admins_all_ddls"
  ON direct_delivery_locations FOR ALL
  USING (
    tenant_id = auth.tenant_id() AND
    auth.jwt() ->> 'role' = 'compliance_admin'
  );

-- Policy 5: System (service role) has full access (for shipment gating)
CREATE POLICY "system_full_access"
  ON direct_delivery_locations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Document policies (similar structure)
CREATE POLICY "restaurants_own_docs"
  ON ddl_documents FOR SELECT
  USING (
    tenant_id = auth.tenant_id() AND
    ddl_id IN (
      SELECT id FROM direct_delivery_locations
      WHERE tenant_id = auth.tenant_id()
        AND restaurant_id = auth.restaurant_id()
    )
  );

CREATE POLICY "compliance_admins_all_docs"
  ON ddl_documents FOR ALL
  USING (
    tenant_id = auth.tenant_id() AND
    auth.jwt() ->> 'role' = 'compliance_admin'
  );

CREATE POLICY "system_docs_access"
  ON ddl_documents FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Status events policies (audit trail - read-only for users)
CREATE POLICY "restaurants_own_events"
  ON ddl_status_events FOR SELECT
  USING (
    tenant_id = auth.tenant_id() AND
    ddl_id IN (
      SELECT id FROM direct_delivery_locations
      WHERE tenant_id = auth.tenant_id()
        AND restaurant_id = auth.restaurant_id()
    )
  );

CREATE POLICY "compliance_admins_all_events"
  ON ddl_status_events FOR ALL
  USING (
    tenant_id = auth.tenant_id() AND
    auth.jwt() ->> 'role' = 'compliance_admin'
  );

CREATE POLICY "system_events_access"
  ON ddl_status_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_ddl_status_transition(
  p_from_status ddl_status,
  p_to_status ddl_status
) RETURNS BOOLEAN AS $$
BEGIN
  -- Valid transitions
  IF (p_from_status = 'NOT_REGISTERED' AND p_to_status = 'SUBMITTED') THEN
    RETURN TRUE;
  ELSIF (p_from_status = 'SUBMITTED' AND p_to_status IN ('APPROVED', 'REJECTED')) THEN
    RETURN TRUE;
  ELSIF (p_from_status = 'APPROVED' AND p_to_status = 'EXPIRED') THEN
    RETURN TRUE;
  ELSIF (p_from_status = 'REJECTED' AND p_to_status = 'NOT_REGISTERED') THEN
    RETURN TRUE; -- Allow resubmission after rejection
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate internal reference
CREATE OR REPLACE FUNCTION generate_ddl_reference(
  p_ddl_id UUID,
  p_version INTEGER
) RETURNS TEXT AS $$
BEGIN
  RETURN 'DDL-' ||
         SUBSTRING(p_ddl_id::TEXT FROM 1 FOR 8) || '-' ||
         TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         'v' || p_version::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- INITIAL DATA (Optional)
-- ============================================================================

-- Example: Add a test importer (if not exists)
-- INSERT INTO importers (tenant_id, legal_name, org_number, ...)
-- VALUES (...);

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Verify tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events');

-- Verify constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'direct_delivery_locations'
  AND constraint_type IN ('UNIQUE', 'CHECK', 'FOREIGN KEY');

-- Verify indexes
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events');

-- ============================================================================
-- ROLLBACK (IF NEEDED)
-- ============================================================================

-- DROP TABLE ddl_status_events;
-- DROP TABLE ddl_documents;
-- DROP TABLE direct_delivery_locations;
-- DROP TYPE ddl_status;
-- DROP TYPE ddl_document_type;
-- DROP FUNCTION validate_ddl_status_transition(ddl_status, ddl_status);
-- DROP FUNCTION generate_ddl_reference(UUID, INTEGER);

COMMENT ON SCHEMA public IS 'Direct Delivery Location (DDL) compliance system for Skatteverket';


-- ============================================================================
-- SECTION: 20260114_gs1_phase1.sql
-- ============================================================================

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


-- ============================================================================
-- END OF PART 2
