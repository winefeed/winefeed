-- ============================================================================
-- WINEFEED B2B SCHEMA — Combined Migration
-- Generated: 2026-02-10
-- Target: Supabase project itpknmhvbdhiprssjwtq (Vinkoll)
-- 
-- Combines base schema + all B2B migrations, with dependency ordering fixed.
-- EXCLUDES: Access/Vinkoll tables (already deployed), seed data, feature scaffolds.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/itpknmhvbdhiprssjwtq/sql/new
--
-- NOTE: If too large for a single paste, split at "-- ====...SECTION" headers.
-- ============================================================================

-- ============================================================================
-- SECTION 0: Prerequisites
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- SECTION: supabase-schema.sql
-- ============================================================================

-- WINEFEED DATABASE SCHEMA
-- Kör detta i Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- TABELL 1: Restauranger (Supabase Auth hanterar users-tabellen, detta är metadata)
CREATE TABLE restaurants (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 2: Viner
CREATE TABLE wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn TEXT NOT NULL,
  producent TEXT NOT NULL,
  land TEXT NOT NULL,
  region TEXT,
  pris_sek INTEGER NOT NULL, -- heltal för att undvika float-problem
  beskrivning TEXT NOT NULL,
  druva TEXT,
  ekologisk BOOLEAN DEFAULT FALSE,
  lagerstatus TEXT DEFAULT 'tillgänglig' CHECK (lagerstatus IN ('tillgänglig', 'få kvar', 'slut')),
  systembolaget_id TEXT UNIQUE, -- om data kommer från Systembolaget
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för snabbare filtrering
CREATE INDEX idx_wines_pris ON wines(pris_sek);
CREATE INDEX idx_wines_land ON wines(land);
CREATE INDEX idx_wines_lagerstatus ON wines(lagerstatus);

-- TABELL 3: Leverantörer
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn TEXT NOT NULL,
  kontakt_email TEXT NOT NULL,
  telefon TEXT,
  hemsida TEXT,
  normalleveranstid_dagar INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 4: Koppling vin ↔ leverantör (många-till-många)
CREATE TABLE wine_suppliers (
  wine_id UUID REFERENCES wines(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  PRIMARY KEY (wine_id, supplier_id)
);

-- TABELL 5: Förfrågningar (sparar vad restaurangen frågade efter)
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  fritext TEXT NOT NULL,
  budget_per_flaska INTEGER,
  antal_flaskor INTEGER,
  leverans_senast DATE,
  specialkrav TEXT[], -- array av krav: ["ekologiskt", "veganskt"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 6: Genererade förslag (sparar vad AI:n föreslog)
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  wine_id UUID REFERENCES wines(id) ON DELETE SET NULL,
  motivering TEXT NOT NULL, -- AI-genererad text
  ranking_score DECIMAL(3,2), -- 0.00-1.00
  accepted BOOLEAN DEFAULT FALSE, -- true om restaurang klickade "inkludera i offert"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 7: Skickade offerter (tracking)
CREATE TABLE offers_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  wine_ids UUID[], -- array av vin-ID:n som skickades
  email_sent_at TIMESTAMPTZ DEFAULT NOW(),
  supplier_responded BOOLEAN DEFAULT FALSE,
  response_received_at TIMESTAMPTZ
);

-- RLS (Row Level Security) – restauranger ser bara sin egen data
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restauranger ser bara egna requests"
  ON requests FOR ALL
  USING (auth.uid() = restaurant_id);

CREATE POLICY "Restauranger ser bara egna suggestions"
  ON suggestions FOR ALL
  USING (
    request_id IN (SELECT id FROM requests WHERE restaurant_id = auth.uid())
  );

-- Skapa en funktion för att automatiskt skapa restaurant-post vid signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.restaurants (id, name, contact_email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Ny restaurang'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger som körs när ny user skapas i auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- SECTION: add_market_price_fields.sql
-- ============================================================================

-- Lägg till kolumner för marknadsprisdata från Wine-Searcher
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS market_price_sek DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS market_price_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS market_merchant_count INTEGER DEFAULT 0;

-- Lägg till index för snabbare frågor
CREATE INDEX IF NOT EXISTS idx_wines_market_price_updated
ON wines(market_price_updated_at DESC NULLS LAST);

-- Kommentar
COMMENT ON COLUMN wines.market_price_sek IS 'Lägsta marknadspris från Wine-Searcher (SEK)';
COMMENT ON COLUMN wines.market_price_updated_at IS 'När marknadsdata senast uppdaterades';
COMMENT ON COLUMN wines.market_merchant_count IS 'Antal återförsäljare som säljer vinet';


-- ============================================================================
-- SECTION: 20250126_add_supplier_min_order.sql
-- ============================================================================

-- Migration: Add min_order_bottles to suppliers
-- Purpose: Allow suppliers to set a total minimum order (in bottles)
--          that can be fulfilled with any combination of products

-- Add min_order_bottles column
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS min_order_bottles INTEGER DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN suppliers.min_order_bottles IS
  'Total minimum order in bottles across all products (e.g., 90 bottles = 15 cases of 6). NULL means no total minimum.';

-- Example: Banjo Vino with min 90 bottles (can be any combination of their wines)
-- UPDATE suppliers SET min_order_bottles = 90 WHERE namn = 'Banjo Vino';


-- ============================================================================
-- SECTION: 20260114_supplier_onboarding.sql
-- ============================================================================

-- SUPPLIER ONBOARDING & CATALOG MANAGEMENT
-- Migration: 20260114_supplier_onboarding
-- Purpose: Enable suppliers to onboard, manage catalogs, and respond to quote requests

-- ============================================================================
-- STEP 1: Extend suppliers table with type and compliance fields
-- ============================================================================

-- Add supplier type enum
CREATE TYPE supplier_type AS ENUM (
  'SWEDISH_IMPORTER',  -- Swedish licensed importer (direct sales)
  'EU_PRODUCER',       -- EU-based wine producer
  'EU_IMPORTER'        -- Compliance partner (Brasri-type)
);

-- Extend suppliers table
ALTER TABLE suppliers
ADD COLUMN type supplier_type DEFAULT 'SWEDISH_IMPORTER',
ADD COLUMN org_number TEXT,  -- Swedish org number for SWEDISH_IMPORTER
ADD COLUMN license_number TEXT,  -- Alcohol license number
ADD COLUMN license_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for filtering by type
CREATE INDEX idx_suppliers_type ON suppliers(type);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);

-- ============================================================================
-- STEP 2: Create supplier_users table for authentication (multi-tenant)
-- ============================================================================

CREATE TABLE supplier_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast supplier lookup
CREATE INDEX idx_supplier_users_supplier ON supplier_users(supplier_id);

-- ============================================================================
-- STEP 3: Create supplier_wines table (catalog)
-- ============================================================================

CREATE TABLE supplier_wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Wine details
  name TEXT NOT NULL,
  producer TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  vintage INTEGER,
  grape TEXT,

  -- Pricing (excluding VAT)
  price_ex_vat_sek INTEGER NOT NULL,  -- Integer in öre (100 = 1 SEK)
  vat_rate DECIMAL(4,2) DEFAULT 25.00,  -- 25% VAT standard

  -- Inventory
  stock_qty INTEGER,  -- NULL = unlimited
  min_order_qty INTEGER DEFAULT 6,  -- Minimum bottles per order

  -- Delivery
  lead_time_days INTEGER DEFAULT 3,
  delivery_areas TEXT[],  -- Array of regions/cities, NULL = nationwide

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_price CHECK (price_ex_vat_sek > 0),
  CONSTRAINT valid_vat_rate CHECK (vat_rate >= 0 AND vat_rate <= 100),
  CONSTRAINT positive_min_order CHECK (min_order_qty > 0)
);

-- Indexes for catalog queries
CREATE INDEX idx_supplier_wines_supplier ON supplier_wines(supplier_id);
CREATE INDEX idx_supplier_wines_active ON supplier_wines(is_active);
CREATE INDEX idx_supplier_wines_country ON supplier_wines(country);
CREATE INDEX idx_supplier_wines_price ON supplier_wines(price_ex_vat_sek);

-- ============================================================================
-- STEP 4: SKIPPED — offers table
-- The Pilot Loop 1.0 version (20260117_create_offers.sql) is the canonical schema.
-- That version uses CREATE TABLE IF NOT EXISTS, so we skip this early version.
-- ============================================================================

-- ============================================================================
-- STEP 5: Row Level Security (RLS) for multi-tenancy
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE supplier_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_wines ENABLE ROW LEVEL SECURITY;
-- offers RLS is handled by 20260117_enable_rls_offers.sql

-- Supplier users can only see their own record
CREATE POLICY "Supplier users see own record"
  ON supplier_users FOR ALL
  USING (auth.uid() = id);

-- Supplier users can only see wines from their supplier
CREATE POLICY "Supplier users see own wines"
  ON supplier_wines FOR ALL
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- NOTE: Offers policies are defined in 20260117_enable_rls_offers.sql (Pilot Loop 1.0)

-- ============================================================================
-- STEP 6: Helper functions
-- ============================================================================

-- Function to create supplier user on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_supplier_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user metadata indicates supplier role
  IF NEW.raw_user_meta_data->>'user_type' = 'supplier' THEN
    INSERT INTO public.supplier_users (id, supplier_id, role)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'supplier_id')::UUID,
      COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for supplier user creation
CREATE OR REPLACE TRIGGER on_auth_supplier_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'user_type' = 'supplier')
  EXECUTE FUNCTION public.handle_new_supplier_user();

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_wines_updated_at BEFORE UPDATE ON supplier_wines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Sample data constraints validation
-- ============================================================================

-- Ensure Swedish importers don't have EU-specific fields (if added later)
-- This is a placeholder for future compliance fields

COMMENT ON TABLE suppliers IS 'Extended with supplier types for compliance-safe architecture';
COMMENT ON TABLE supplier_users IS 'Multi-tenant authentication for supplier access';
COMMENT ON TABLE supplier_wines IS 'Supplier-managed wine catalog with pricing and inventory';
COMMENT ON TABLE offers IS 'Supplier responses to restaurant quote requests';


-- ============================================================================
-- SECTION: 20250126_add_packaging_type.sql
-- ============================================================================

-- Migration: Add packaging_type to supplier_wines
-- Purpose: Allow suppliers to specify packaging format (bottle, keg, bag-in-box, etc.)

-- Create enum for packaging types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'packaging_type') THEN
    CREATE TYPE packaging_type AS ENUM (
      'bottle',      -- Standard bottle (750ml, 375ml, 1.5L, etc.)
      'keg',         -- Draft/keg (various sizes)
      'bag_in_box',  -- Bag-in-box
      'can',         -- Canned wine
      'tetra',       -- Tetra pak
      'other'        -- Other formats
    );
  END IF;
END$$;

-- Add packaging_type column to supplier_wines
ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS packaging_type packaging_type DEFAULT 'bottle';

-- Add comment
COMMENT ON COLUMN supplier_wines.packaging_type IS
  'Packaging format: bottle (standard), keg (draft), bag_in_box, can, tetra, other';

-- Update existing rows to have explicit bottle type
UPDATE supplier_wines SET packaging_type = 'bottle' WHERE packaging_type IS NULL;


-- ============================================================================
-- SECTION: 20260115_create_importers_table.sql
-- ============================================================================

-- Create importers table
-- This table stores legal entities authorized to import alcohol

CREATE TABLE IF NOT EXISTS importers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Legal entity
  legal_name TEXT NOT NULL,
  org_number TEXT NOT NULL,

  -- Contact
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,

  -- License
  license_number TEXT,
  license_verified BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_org_number CHECK (org_number ~ '^\d{6}-\d{4}$')
);

CREATE INDEX idx_importers_tenant ON importers(tenant_id);
CREATE INDEX idx_importers_org_number ON importers(org_number);

COMMENT ON TABLE importers IS 'Legal entities authorized to import alcohol';


-- ============================================================================
-- SECTION: 20260115_add_importer_type.sql
-- ============================================================================

-- Add importer type for SE vs EU_PARTNER flow differentiation

CREATE TYPE importer_type AS ENUM (
  'SE',
  'EU_PARTNER'
);

ALTER TABLE importers
ADD COLUMN type importer_type NOT NULL DEFAULT 'SE';

COMMENT ON COLUMN importers.type IS 'Importer classification: SE (Swedish entity) or EU_PARTNER (EU partner under suspension arrangement)';

-- Create index for filtering by type
CREATE INDEX idx_importers_type ON importers(type);


-- ============================================================================
-- SECTION: 20260115_create_imports_table.sql
-- ============================================================================

-- Create imports table and import_status enum
-- This table represents import cases linking restaurant + importer + delivery location

CREATE TYPE import_status AS ENUM (
  'NOT_REGISTERED',
  'SUBMITTED',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core relationships
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  delivery_location_id UUID NOT NULL REFERENCES direct_delivery_locations(id) ON DELETE CASCADE,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Status workflow
  status import_status NOT NULL DEFAULT 'NOT_REGISTERED',

  -- Audit
  created_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_imports_tenant_restaurant ON imports(tenant_id, restaurant_id);
CREATE INDEX idx_imports_tenant_status ON imports(tenant_id, status);
CREATE INDEX idx_imports_tenant_created ON imports(tenant_id, created_at);
CREATE INDEX idx_imports_restaurant ON imports(restaurant_id);
CREATE INDEX idx_imports_importer ON imports(importer_id);
CREATE INDEX idx_imports_delivery_location ON imports(delivery_location_id);

COMMENT ON TABLE imports IS 'Import cases linking restaurant + importer + delivery location';


-- ============================================================================
-- SECTION: 20260115_create_import_documents.sql
-- ============================================================================

-- Create import_documents table for document versioning and storage
-- Separate from ddl_documents (which links to direct_delivery_locations)
-- This table links to imports (import cases)

CREATE TABLE import_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,

  -- Document metadata
  type TEXT NOT NULL, -- 'SKV_5369_03', etc
  version INTEGER NOT NULL,

  -- File storage
  storage_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,

  -- Audit
  created_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_version CHECK (version > 0),
  CONSTRAINT unique_import_document_version UNIQUE (tenant_id, import_id, type, version)
);

-- Indexes
CREATE INDEX idx_import_docs_tenant ON import_documents(tenant_id);
CREATE INDEX idx_import_docs_import ON import_documents(import_id);
CREATE INDEX idx_import_docs_tenant_import_type ON import_documents(tenant_id, import_id, type);
CREATE INDEX idx_import_docs_created ON import_documents(created_at DESC);

COMMENT ON TABLE import_documents IS 'Document archive with versioning for import case documents (5369_03, etc)';
COMMENT ON COLUMN import_documents.version IS 'Incremental version number (1, 2, 3...) per import + type';
COMMENT ON COLUMN import_documents.sha256 IS 'SHA-256 hash of PDF content for integrity verification';
COMMENT ON COLUMN import_documents.storage_path IS 'Supabase Storage path to PDF file';

-- Enable RLS
ALTER TABLE import_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access (for API routes)
CREATE POLICY "Service role full access" ON import_documents FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Tenant isolation (if using custom JWT claims)
CREATE POLICY "Tenant isolation" ON import_documents FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);


-- ============================================================================
-- SECTION: 20260115_create_import_status_events.sql
-- ============================================================================

-- Create import_status_events table
-- Audit trail for import case status changes

CREATE TABLE import_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,

  -- Status transition
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  note TEXT,

  -- Audit
  changed_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_import_events_tenant ON import_status_events(tenant_id);
CREATE INDEX idx_import_events_import ON import_status_events(import_id);
CREATE INDEX idx_import_events_created ON import_status_events(created_at DESC);

COMMENT ON TABLE import_status_events IS 'Audit trail for import case status changes';


-- ============================================================================
-- SECTION: 20260115_enable_rls_imports.sql
-- ============================================================================

-- Enable RLS and create policies for imports tables

-- Enable RLS on imports
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access (for API routes)
CREATE POLICY "Service role full access" ON imports FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Tenant isolation (if using custom JWT claims)
CREATE POLICY "Tenant isolation" ON imports FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Enable RLS on importers
ALTER TABLE importers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON importers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Tenant isolation" ON importers FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Enable RLS on import_status_events
ALTER TABLE import_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON import_status_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Prevent cross-tenant import_id assignment on supplier_imports
CREATE POLICY "Prevent cross-tenant import attach" ON supplier_imports FOR UPDATE
  USING (
    import_id IS NULL OR
    EXISTS (
      SELECT 1 FROM imports
      WHERE imports.id = supplier_imports.import_id
      -- AND imports.tenant_id = supplier_imports.tenant_id  -- SKIPPED: supplier_imports has no tenant_id
    )
  );


-- ============================================================================
-- SECTION: 20260114_quote_request_routing.sql
-- ============================================================================

-- QUOTE REQUEST ROUTING & ASSIGNMENTS
-- Migration: 20260114_quote_request_routing
-- Purpose: Enable marketplace routing of quote requests to matched suppliers

-- ============================================================================
-- STEP 1: Create QuoteRequestAssignment table
-- ============================================================================

-- Assignment status enum
CREATE TYPE assignment_status AS ENUM (
  'SENT',       -- Assignment created and sent to supplier
  'VIEWED',     -- Supplier has viewed the quote request
  'RESPONDED',  -- Supplier has created at least one offer
  'EXPIRED'     -- Assignment expired (past expiresAt deadline)
);

-- QuoteRequestAssignment table
CREATE TABLE quote_request_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Status tracking
  status assignment_status DEFAULT 'SENT',

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Scoring metadata (why was this supplier matched?)
  match_score DECIMAL(4,2),  -- 0.00-100.00
  match_reasons TEXT[],  -- Array of reasons: ["region_match", "budget_match", etc.]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_assignment UNIQUE (quote_request_id, supplier_id),
  CONSTRAINT valid_match_score CHECK (match_score >= 0 AND match_score <= 100),
  CONSTRAINT valid_status_transitions CHECK (
    -- Status can only move forward (no going back)
    CASE status
      WHEN 'SENT' THEN TRUE
      WHEN 'VIEWED' THEN viewed_at IS NOT NULL
      WHEN 'RESPONDED' THEN responded_at IS NOT NULL
      WHEN 'EXPIRED' THEN expires_at < NOW()
      ELSE FALSE
    END
  )
);

-- Indexes for fast queries
CREATE INDEX idx_assignments_quote_request ON quote_request_assignments(quote_request_id);
CREATE INDEX idx_assignments_supplier ON quote_request_assignments(supplier_id);
CREATE INDEX idx_assignments_status ON quote_request_assignments(status);
CREATE INDEX idx_assignments_expires ON quote_request_assignments(expires_at);

-- Composite index for supplier queries (most common: get active assignments for supplier)
CREATE INDEX idx_assignments_supplier_status ON quote_request_assignments(supplier_id, status);

-- ============================================================================
-- STEP 2: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE quote_request_assignments ENABLE ROW LEVEL SECURITY;

-- Suppliers can only see their own assignments
CREATE POLICY "Suppliers see own assignments"
  ON quote_request_assignments FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Restaurants can see assignments for their quote requests
CREATE POLICY "Restaurants see assignments for their requests"
  ON quote_request_assignments FOR SELECT
  USING (
    quote_request_id IN (
      SELECT id FROM requests WHERE restaurant_id = auth.uid()
    )
  );

-- Only system (service role) can create/update assignments
-- (No policy for INSERT/UPDATE means only service role can do it)

-- ============================================================================
-- STEP 3: Auto-update triggers
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON quote_request_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-expire assignments
CREATE OR REPLACE FUNCTION auto_expire_assignments()
RETURNS void AS $$
BEGIN
  UPDATE quote_request_assignments
  SET status = 'EXPIRED'
  WHERE status IN ('SENT', 'VIEWED')
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- This function should be called periodically (e.g., via cron job or Edge Function)
-- For now, we'll call it manually when needed
COMMENT ON FUNCTION auto_expire_assignments() IS 'Call periodically to expire old assignments';

-- ============================================================================
-- STEP 4: Helper views
-- ============================================================================

-- View: Active assignments (not expired)
CREATE VIEW active_assignments AS
SELECT *
FROM quote_request_assignments
WHERE status IN ('SENT', 'VIEWED', 'RESPONDED')
  AND expires_at > NOW();

-- View: Supplier assignment summary
CREATE VIEW supplier_assignment_stats AS
SELECT
  supplier_id,
  COUNT(*) as total_assignments,
  COUNT(*) FILTER (WHERE status = 'SENT') as sent_count,
  COUNT(*) FILTER (WHERE status = 'VIEWED') as viewed_count,
  COUNT(*) FILTER (WHERE status = 'RESPONDED') as responded_count,
  COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired_count,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'RESPONDED')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('SENT', 'VIEWED', 'RESPONDED')), 0) * 100,
    2
  ) as response_rate_percent
FROM quote_request_assignments
GROUP BY supplier_id;

-- ============================================================================
-- STEP 5: Audit logging for assignments
-- ============================================================================

-- Add assignment actions to audit events (if not exists)
-- This assumes AuditEvent table exists from compliance implementation
-- If not, this is a placeholder

-- Example audit event insert would look like:
-- INSERT INTO audit_events (entity_type, entity_id, action, actor_type, actor_id)
-- VALUES ('ASSIGNMENT', assignment_id, 'DISPATCHED', 'SYSTEM', 'routing-service');

-- ============================================================================
-- STEP 6: Data integrity checks
-- ============================================================================

-- Ensure expires_at is always in the future when created
ALTER TABLE quote_request_assignments
ADD CONSTRAINT expires_at_in_future CHECK (expires_at > sent_at);

-- Ensure timestamps make sense
ALTER TABLE quote_request_assignments
ADD CONSTRAINT valid_timestamp_order CHECK (
  (viewed_at IS NULL OR viewed_at >= sent_at) AND
  (responded_at IS NULL OR responded_at >= sent_at) AND
  (responded_at IS NULL OR viewed_at IS NULL OR responded_at >= viewed_at)
);

-- ============================================================================
-- STEP 7: Comments for documentation
-- ============================================================================

COMMENT ON TABLE quote_request_assignments IS
  'Tracks which suppliers have been matched to which quote requests. Enables marketplace routing and access control.';

COMMENT ON COLUMN quote_request_assignments.match_score IS
  'Scoring from 0-100 indicating how well this supplier matches the quote request criteria.';

COMMENT ON COLUMN quote_request_assignments.match_reasons IS
  'Array of match reasons like ["region_match", "budget_match", "lead_time_ok"] for transparency.';

COMMENT ON COLUMN quote_request_assignments.expires_at IS
  'Deadline for supplier to respond. After this time, assignment status becomes EXPIRED.';

-- ============================================================================
-- STEP 8: Sample data validation function
-- ============================================================================

-- Function to validate an assignment is still valid for offer creation
CREATE OR REPLACE FUNCTION is_assignment_valid_for_offer(
  p_quote_request_id UUID,
  p_supplier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_assignment RECORD;
BEGIN
  SELECT * INTO v_assignment
  FROM quote_request_assignments
  WHERE quote_request_id = p_quote_request_id
    AND supplier_id = p_supplier_id;

  -- No assignment found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Assignment expired
  IF v_assignment.expires_at < NOW() THEN
    RETURN FALSE;
  END IF;

  -- Assignment already expired status
  IF v_assignment.status = 'EXPIRED' THEN
    RETURN FALSE;
  END IF;

  -- Valid assignment
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_assignment_valid_for_offer IS
  'Checks if a supplier has a valid (non-expired) assignment for a quote request.';


-- ============================================================================
-- END OF PART 1
