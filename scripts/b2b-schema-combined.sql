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
-- SECTION: 20260117_add_tenant_id_to_restaurants.sql
-- ============================================================================

/**
 * ADD TENANT_ID TO RESTAURANTS - ROBUST TENANT SCOPING
 *
 * Purpose: Enable proper tenant scoping for requests via restaurants
 * Flow: requests → restaurants → tenant_id (instead of indirect via offers)
 *
 * Changes:
 * 1. Add tenant_id column to restaurants
 * 2. Create index for performance
 * 3. Set default tenant for existing restaurants (MVP single-tenant)
 *
 * Security:
 * - Enables robust tenant scoping: requests JOIN restaurants WHERE tenant_id = X
 * - No dependency on offers for request visibility
 * - Prevents cross-tenant request leakage
 */

-- Step 1: Add tenant_id column to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- Step 2: Create index for efficient tenant filtering
CREATE INDEX IF NOT EXISTS idx_restaurants_tenant ON restaurants(tenant_id);

-- Step 3: Add comment
COMMENT ON COLUMN restaurants.tenant_id IS 'Tenant isolation for multi-tenant platform - enables secure request scoping';

-- Step 4: Future: Remove default after data migration
-- After all restaurants have proper tenant_id assigned:
-- ALTER TABLE restaurants ALTER COLUMN tenant_id DROP DEFAULT;


-- ============================================================================
-- SECTION: 20260117_create_offers.sql
-- ============================================================================

/**
 * OFFERS TABLE - PILOT LOOP 1.0
 *
 * Multi-line offers from suppliers to restaurants
 * Immutable after acceptance (snapshot + lock)
 *
 * Status workflow:
 * - DRAFT: Editable by creator
 * - SENT: Sent to restaurant, still editable by supplier
 * - ACCEPTED: Locked, immutable snapshot saved
 * - REJECTED: Rejected by restaurant
 */

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core relationships
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  request_id UUID NULL REFERENCES requests(id) ON DELETE SET NULL,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Offer metadata
  title TEXT NULL,
  currency TEXT NOT NULL DEFAULT 'SEK',

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),

  -- Lock timestamps (immutable after acceptance)
  accepted_at TIMESTAMPTZ NULL,
  locked_at TIMESTAMPTZ NULL,

  -- Snapshot (saved at accept time for historical integrity)
  snapshot JSONB NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_offers_tenant_restaurant ON offers(tenant_id, restaurant_id);
CREATE INDEX idx_offers_tenant_request ON offers(tenant_id, request_id);
CREATE INDEX idx_offers_tenant_status ON offers(tenant_id, status);
CREATE INDEX idx_offers_tenant_created ON offers(tenant_id, created_at DESC);
CREATE INDEX idx_offers_restaurant ON offers(restaurant_id);
CREATE INDEX idx_offers_supplier ON offers(supplier_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION update_offers_updated_at();

COMMENT ON TABLE offers IS 'Multi-line offers (DRAFT/SENT/ACCEPTED/REJECTED) with immutable snapshot at accept';
COMMENT ON COLUMN offers.snapshot IS 'Immutable snapshot saved at acceptance (offer + lines) for historical integrity';
COMMENT ON COLUMN offers.locked_at IS 'Timestamp when offer became immutable (acceptance)';


-- ============================================================================
-- SECTION: 20260117_create_offer_lines.sql
-- ============================================================================

/**
 * OFFER LINES TABLE - PILOT LOOP 1.0
 *
 * Line items for multi-line offers
 * Each line can be enriched via Wine Check (allowlist fields only)
 *
 * Security: NO PRICE DATA from Wine-Searcher
 * Enrichment allowlist: canonical_name, producer, country, region, appellation, ws_id, match_status, match_score
 * Commercial pricing: offered_unit_price_ore (from supplier, not Wine-Searcher)
 */

CREATE TABLE IF NOT EXISTS offer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

  -- Line ordering
  line_no INTEGER NOT NULL,

  -- Core wine data (user input)
  name TEXT NOT NULL,
  vintage INTEGER NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  bottle_ml INTEGER NULL,
  packaging TEXT NULL,

  -- Commercial pricing (supplier sets this, NOT from Wine-Searcher)
  offered_unit_price_ore INTEGER NULL,  -- Price in öre (100 = 1 SEK), ex VAT

  -- Wine Check enrichment (allowlist only - NO PRICE DATA)
  canonical_name TEXT NULL,
  producer TEXT NULL,
  country TEXT NULL,
  region TEXT NULL,
  appellation TEXT NULL,
  ws_id TEXT NULL,
  match_status TEXT NULL,  -- From Wine Check (e.g., "verified", "suggested")
  match_score INTEGER NULL,  -- 0-100 confidence score

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_offer_line UNIQUE (offer_id, line_no),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_price CHECK (offered_unit_price_ore IS NULL OR offered_unit_price_ore >= 0)
);

-- Indexes for performance
CREATE INDEX idx_offer_lines_tenant_offer ON offer_lines(tenant_id, offer_id);
CREATE INDEX idx_offer_lines_tenant_ws_id ON offer_lines(tenant_id, ws_id);
CREATE INDEX idx_offer_lines_offer ON offer_lines(offer_id);
CREATE INDEX idx_offer_lines_offer_lineno ON offer_lines(offer_id, line_no);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_offer_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_offer_lines_updated_at
  BEFORE UPDATE ON offer_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_lines_updated_at();

COMMENT ON TABLE offer_lines IS 'Line items for multi-line offers with Wine Check enrichment (allowlist only)';
COMMENT ON COLUMN offer_lines.offered_unit_price_ore IS 'Supplier commercial price in öre (NOT from Wine-Searcher)';
COMMENT ON COLUMN offer_lines.canonical_name IS 'Wine Check enrichment: canonical wine name';
COMMENT ON COLUMN offer_lines.match_status IS 'Wine Check match status (verified/suggested)';
COMMENT ON COLUMN offer_lines.match_score IS 'Wine Check confidence score (0-100)';


-- ============================================================================
-- SECTION: 20260117_create_offer_events.sql
-- ============================================================================

/**
 * OFFER EVENTS TABLE - AUDIT TRAIL
 *
 * Tracks all state changes and actions on offers
 * Provides full auditability for pilot loop
 *
 * Event types:
 * - CREATED: Offer created
 * - UPDATED: Offer metadata updated
 * - LINE_ADDED: Line item added
 * - LINE_UPDATED: Line item modified
 * - LINE_DELETED: Line item removed
 * - SENT: Offer sent to restaurant
 * - ACCEPTED: Offer accepted by restaurant
 * - REJECTED: Offer rejected by restaurant
 */

CREATE TABLE IF NOT EXISTS offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

  -- Event metadata
  event_type TEXT NOT NULL CHECK (event_type IN (
    'CREATED',
    'UPDATED',
    'LINE_ADDED',
    'LINE_UPDATED',
    'LINE_DELETED',
    'SENT',
    'ACCEPTED',
    'REJECTED'
  )),

  -- Actor (user who performed action)
  actor_user_id UUID NULL,  -- From auth.users

  -- Optional payload (diff, metadata, notes)
  payload JSONB NULL,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_offer_events_tenant_offer_created ON offer_events(tenant_id, offer_id, created_at DESC);
CREATE INDEX idx_offer_events_offer_created ON offer_events(offer_id, created_at DESC);
CREATE INDEX idx_offer_events_tenant_event_type ON offer_events(tenant_id, event_type);
CREATE INDEX idx_offer_events_actor ON offer_events(actor_user_id);

COMMENT ON TABLE offer_events IS 'Audit trail for all offer state changes and actions';
COMMENT ON COLUMN offer_events.event_type IS 'Type of event: CREATED, UPDATED, LINE_ADDED, LINE_UPDATED, LINE_DELETED, SENT, ACCEPTED, REJECTED';
COMMENT ON COLUMN offer_events.actor_user_id IS 'User who performed the action (from auth.users)';
COMMENT ON COLUMN offer_events.payload IS 'Optional event details (diff, metadata, notes)';


-- ============================================================================
-- SECTION: 20260117_enable_rls_offers.sql
-- ============================================================================

/**
 * RLS POLICIES FOR OFFERS - PILOT LOOP 1.0
 *
 * Multi-tenant security for offers, offer_lines, offer_events
 *
 * MVP policies (can be refined later):
 * - Service role: Full access (API routes use service role)
 * - Tenant isolation: Users can only access offers in their tenant
 * - Restaurant users: Read offers where restaurant_id matches
 * - Supplier users: Read/write offers where supplier_id matches
 */

-- ============================================================================
-- OFFERS TABLE
-- ============================================================================

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offers"
  ON offers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offers"
  ON offers FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- OFFER_LINES TABLE
-- ============================================================================

ALTER TABLE offer_lines ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offer_lines"
  ON offer_lines FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offer_lines"
  ON offer_lines FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- OFFER_EVENTS TABLE
-- ============================================================================

ALTER TABLE offer_events ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offer_events"
  ON offer_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offer_events"
  ON offer_events FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- FUTURE: More granular policies
-- ============================================================================
-- TODO: Add policies for restaurant-specific and supplier-specific access
-- For example:
-- - Restaurants can only see offers where restaurant_id = their profile
-- - Suppliers can only see/edit offers where supplier_id = their profile
-- - Requires proper user-to-restaurant/supplier mapping in auth


-- ============================================================================
-- SECTION: 20260117_add_accepted_offer_id_to_requests.sql
-- ============================================================================

/**
 * ADD ACCEPTED OFFER ID TO REQUESTS - PILOT LOOP 1.0
 *
 * Purpose: Enable request ↔ offer relationship for pilot loop
 * Flow: Request → Offer → Accept → Request.accepted_offer_id set
 *
 * Changes:
 * 1. Add accepted_offer_id column (nullable FK to offers)
 * 2. Add status column if missing (OPEN/ACCEPTED/CLOSED)
 * 3. Add index for performance
 * 4. Add constraint: only 1 accepted offer per request
 *
 * Security:
 * - RLS policies inherited from requests table
 * - Service layer enforces single accepted offer
 */

-- Add accepted_offer_id column (nullable FK to offers)
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS accepted_offer_id UUID NULL REFERENCES offers(id) ON DELETE SET NULL;

-- Add status column if it doesn't exist (default OPEN)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'requests' AND column_name = 'status') THEN
    ALTER TABLE requests ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN'
      CHECK (status IN ('OPEN', 'ACCEPTED', 'CLOSED', 'CANCELLED'));
  END IF;
END
$$;

-- Index for efficient queries
-- Note: Only create tenant_id indexes if tenant_id column exists
DO $$
BEGIN
  -- Check if tenant_id column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'requests' AND column_name = 'tenant_id') THEN
    -- Create indexes with tenant_id
    CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(tenant_id, accepted_offer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(tenant_id, status);
  ELSE
    -- Create indexes without tenant_id (single-tenant mode)
    CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(accepted_offer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  END IF;
END
$$;

-- Comments
COMMENT ON COLUMN requests.accepted_offer_id IS 'FK to accepted offer (pilot loop 1.0) - only 1 accepted offer per request';
COMMENT ON COLUMN requests.status IS 'Request status: OPEN (awaiting offers), ACCEPTED (offer accepted), CLOSED, CANCELLED';

-- Constraint: If accepted_offer_id is set, status should be ACCEPTED
-- (This is enforced in application layer for MVP, but could add CHECK constraint)
-- ALTER TABLE requests ADD CONSTRAINT accepted_offer_implies_status
--   CHECK (accepted_offer_id IS NULL OR status = 'ACCEPTED');


-- ============================================================================
-- SECTION: 20260118_add_wine_certifications.sql
-- ============================================================================

-- Add wine certification columns
-- Migration: 20260118_add_wine_certifications.sql
-- Purpose: Add biodynamiskt and veganskt certification columns to wines table

-- Add biodynamiskt column (ekologisk already exists)
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS biodynamiskt BOOLEAN DEFAULT FALSE;

-- Add veganskt column
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS veganskt BOOLEAN DEFAULT FALSE;

-- Create index for certification filtering (compound index for common queries)
CREATE INDEX IF NOT EXISTS idx_wines_certifications
ON wines(ekologisk, biodynamiskt, veganskt)
WHERE ekologisk = TRUE OR biodynamiskt = TRUE OR veganskt = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN wines.ekologisk IS 'Wine is certified organic (already existed)';
COMMENT ON COLUMN wines.biodynamiskt IS 'Wine is certified biodynamic';
COMMENT ON COLUMN wines.veganskt IS 'Wine is certified vegan';

-- Verify columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wines' AND column_name = 'biodynamiskt'
  ) THEN
    RAISE EXCEPTION 'Column biodynamiskt was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wines' AND column_name = 'veganskt'
  ) THEN
    RAISE EXCEPTION 'Column veganskt was not created';
  END IF;

  RAISE NOTICE 'Wine certification columns created successfully';
END $$;


-- ============================================================================
-- SECTION: 20260118_create_invites_table.sql
-- ============================================================================

/**
 * INVITES TABLE - PILOT ONBOARDING 1.0
 *
 * Purpose: Enable admin to invite restaurant and supplier users via email
 *
 * Flow:
 * 1. Admin creates invite with email + role + entity reference
 * 2. System sends email with secure token link
 * 3. Recipient accepts invite, creates account
 * 4. Account is linked to restaurant or supplier_users
 *
 * Security:
 * - Token stored as hash (never plaintext)
 * - Expiry after 7 days
 * - Single use (used_at timestamp)
 * - Admin-only access via RLS
 */

-- ============================================================================
-- STEP 1: Create invite_role enum
-- ============================================================================

CREATE TYPE invite_role AS ENUM ('RESTAURANT', 'SUPPLIER');

-- ============================================================================
-- STEP 2: Create invites table
-- ============================================================================

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Recipient info
  email TEXT NOT NULL,
  role invite_role NOT NULL,

  -- Entity references (role-dependent)
  restaurant_id UUID NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Token security
  token_hash TEXT NOT NULL UNIQUE,

  -- Lifecycle
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ NULL,
  used_by_user_id UUID NULL,  -- References auth.users.id

  -- Audit
  created_by_user_id UUID NULL,  -- References auth.users.id
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_restaurant_invite CHECK (
    (role = 'RESTAURANT' AND restaurant_id IS NOT NULL AND supplier_id IS NULL) OR
    (role = 'SUPPLIER' AND supplier_id IS NOT NULL AND restaurant_id IS NULL)
  ),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ============================================================================
-- STEP 3: Indexes for performance
-- ============================================================================

CREATE INDEX idx_invites_tenant_email ON invites(tenant_id, email);
CREATE INDEX idx_invites_tenant_created ON invites(tenant_id, created_at DESC);
CREATE INDEX idx_invites_token_hash ON invites(token_hash);
CREATE INDEX idx_invites_restaurant ON invites(restaurant_id) WHERE restaurant_id IS NOT NULL;
CREATE INDEX idx_invites_supplier ON invites(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_invites_expires_at ON invites(expires_at) WHERE used_at IS NULL;

-- ============================================================================
-- STEP 4: Create restaurant_users table (missing from schema)
-- ============================================================================

-- Note: restaurants table already references auth.users directly (1-to-1)
-- But for consistency with supplier_users, we create restaurant_users junction table
-- This allows multiple users per restaurant (future-proofing)

CREATE TABLE IF NOT EXISTS restaurant_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast restaurant lookup
CREATE INDEX idx_restaurant_users_restaurant ON restaurant_users(restaurant_id);
CREATE INDEX idx_restaurant_users_active ON restaurant_users(is_active);

-- ============================================================================
-- STEP 5: Helper function to update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_restaurant_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restaurant_users_updated_at
  BEFORE UPDATE ON restaurant_users
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_users_updated_at();

-- ============================================================================
-- STEP 6: Modify existing restaurant trigger to create restaurant_users entry
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate with restaurant_users support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle restaurant users
  IF NEW.raw_user_meta_data->>'user_type' = 'restaurant' THEN
    -- Create restaurants record
    INSERT INTO public.restaurants (id, name, contact_email, tenant_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Ny restaurang'),
      NEW.email,
      COALESCE((NEW.raw_user_meta_data->>'tenant_id')::UUID, '00000000-0000-0000-0000-000000000001'::UUID)
    );

    -- Create restaurant_users junction record
    INSERT INTO public.restaurant_users (id, restaurant_id, role)
    VALUES (
      NEW.id,
      NEW.id,  -- restaurant_id = user_id for primary user
      COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'user_type' IN ('restaurant', 'supplier'))
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 7: Comments
-- ============================================================================

COMMENT ON TABLE invites IS 'Email invitations for restaurant and supplier user onboarding';
COMMENT ON COLUMN invites.token_hash IS 'SHA-256 hash of secure random token (never store plaintext)';
COMMENT ON COLUMN invites.expires_at IS 'Token expiry (default 7 days from creation)';
COMMENT ON COLUMN invites.used_at IS 'Timestamp when invite was accepted (NULL = pending)';
COMMENT ON TABLE restaurant_users IS 'Junction table for restaurant multi-user access (future-proof)';


-- ============================================================================
-- SECTION: 20260118_enable_rls_invites.sql
-- ============================================================================

/**
 * RLS POLICIES FOR INVITES - PILOT ONBOARDING 1.0
 *
 * Security:
 * - Admin-only read/write for invites management
 * - Service role full access (API routes)
 * - Tenant isolation
 * - Public read for verify endpoint (token-based)
 */

-- ============================================================================
-- INVITES TABLE
-- ============================================================================

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on invites"
  ON invites FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on invites"
  ON invites FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- RESTAURANT_USERS TABLE
-- ============================================================================

ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on restaurant_users"
  ON restaurant_users FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Restaurant users see their own record
CREATE POLICY "Restaurant users see own record"
  ON restaurant_users FOR ALL
  USING (auth.uid() = id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Service role full access on invites" ON invites IS 'API routes use service role for invite management';
COMMENT ON POLICY "Tenant isolation on invites" ON invites IS 'Users can only see invites in their tenant';


-- ============================================================================
-- SECTION: 20260119_add_default_importer_to_suppliers.sql
-- ============================================================================

/**
 * MIGRATION: Add default_importer_id to suppliers
 *
 * Purpose: Establish persistent EU-seller → IOR (Importer-of-Record) relationship
 *
 * Changes:
 * - Add suppliers.default_importer_id (nullable FK to importers.id)
 * - Add constraint: EU suppliers (EU_PRODUCER, EU_IMPORTER) must have default_importer_id
 *
 * Business Rule:
 * - SWEDISH_IMPORTER: can operate without IOR (they ARE the importer)
 * - EU_PRODUCER/EU_IMPORTER: MUST have a Swedish IOR assigned
 */

-- Add default_importer_id column (nullable FK to importers table)
ALTER TABLE suppliers
ADD COLUMN default_importer_id UUID NULL REFERENCES importers(id) ON DELETE SET NULL;

-- Create index for FK lookups
CREATE INDEX idx_suppliers_default_importer ON suppliers(default_importer_id);

-- Create index for tenant + type queries (common for EU supplier filtering)
-- SKIPPED: suppliers table has no tenant_id column
-- CREATE INDEX idx_suppliers_tenant_type ON suppliers(tenant_id, type);

-- Add constraint: EU suppliers must have default IOR
-- SWEDISH_IMPORTER can operate without (they are their own importer)
ALTER TABLE suppliers
ADD CONSTRAINT eu_requires_default_ior CHECK (
  (type = 'SWEDISH_IMPORTER') OR (default_importer_id IS NOT NULL)
);

-- Comment for documentation
COMMENT ON COLUMN suppliers.default_importer_id IS
  'Default Swedish Importer-of-Record for EU suppliers. Required for EU_PRODUCER and EU_IMPORTER types. NULL for SWEDISH_IMPORTER (they are their own importer).';

-- Validation query (to run after migration)
-- SELECT id, namn, type, default_importer_id
-- FROM suppliers
-- WHERE type IN ('EU_PRODUCER', 'EU_IMPORTER')
-- AND default_importer_id IS NULL;
-- ^ Should return 0 rows after constraint is active


-- ============================================================================
-- SECTION: 20260119_create_orders_tables.sql
-- ============================================================================

/**
 * MIGRATION: Create orders + order_lines + order_events tables
 *
 * Purpose: Enable operational fulfillment tracking for accepted offers
 *
 * Flow:
 * 1. Offer ACCEPTED → order created (snapshot of offer)
 * 2. IOR manages order fulfillment via status updates
 * 3. order_events provides audit trail
 *
 * Key Relationships:
 * - orders.offer_id → offers.id (source of truth)
 * - orders.seller_supplier_id → suppliers.id (who sells the wine)
 * - orders.importer_of_record_id → importers.id (who handles import/fulfillment)
 * - order_lines: snapshot of offer_lines at acceptance time
 */

-- ============================================================================
-- ORDER STATUS ENUM
-- ============================================================================

CREATE TYPE order_status AS ENUM (
  'CONFIRMED',       -- Order created from accepted offer (initial state)
  'IN_FULFILLMENT',  -- IOR has started fulfillment process
  'SHIPPED',         -- IOR has shipped the order
  'DELIVERED',       -- Restaurant confirmed receipt
  'CANCELLED'        -- Order cancelled (exceptional case)
);

COMMENT ON TYPE order_status IS 'Order fulfillment status lifecycle';

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core relationships
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  request_id UUID NULL REFERENCES requests(id) ON DELETE SET NULL,

  -- Operational roles
  seller_supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  importer_of_record_id UUID NOT NULL REFERENCES importers(id) ON DELETE RESTRICT,

  -- Delivery (optional link to import case/DDL)
  delivery_location_id UUID NULL REFERENCES direct_delivery_locations(id) ON DELETE SET NULL,
  import_case_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL,

  -- Status tracking
  status order_status NOT NULL DEFAULT 'CONFIRMED',

  -- Snapshot metadata (from offer at acceptance time)
  total_lines INTEGER NOT NULL DEFAULT 0,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SEK',

  -- Audit
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_total_lines CHECK (total_lines >= 0),
  CONSTRAINT valid_total_quantity CHECK (total_quantity >= 0)
);

-- Indexes for common queries
CREATE INDEX idx_orders_tenant_restaurant ON orders(tenant_id, restaurant_id);
CREATE INDEX idx_orders_tenant_seller ON orders(tenant_id, seller_supplier_id);
CREATE INDEX idx_orders_tenant_ior ON orders(tenant_id, importer_of_record_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_offer ON orders(offer_id);
CREATE INDEX idx_orders_request ON orders(request_id);

-- Composite index for IOR console queries (most common)
CREATE INDEX idx_orders_ior_status_created ON orders(importer_of_record_id, status, created_at DESC);

COMMENT ON TABLE orders IS 'Operational orders created from accepted offers, managed by IOR for fulfillment';
COMMENT ON COLUMN orders.seller_supplier_id IS 'Supplier selling the wine (owns the assortment)';
COMMENT ON COLUMN orders.importer_of_record_id IS 'Swedish IOR responsible for import/compliance/fulfillment';
COMMENT ON COLUMN orders.import_case_id IS 'Optional link to 5369 import case (if EU direct delivery)';

-- ============================================================================
-- ORDER LINES TABLE (snapshot of offer_lines)
-- ============================================================================

CREATE TABLE order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Parent order
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Wine reference (snapshot from offer_line)
  wine_sku_id UUID NULL REFERENCES wine_skus(id) ON DELETE SET NULL,
  wine_master_id UUID NULL REFERENCES wine_masters(id) ON DELETE SET NULL,

  -- Wine details (denormalized snapshot for history)
  wine_name TEXT NOT NULL,
  producer TEXT,
  vintage TEXT,
  country TEXT,
  region TEXT,
  article_number TEXT,

  -- Quantities
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'flaska',

  -- Pricing (internal - offer prices, NOT WS market prices)
  unit_price_sek DECIMAL(10,2),
  total_price_sek DECIMAL(10,2),

  -- Metadata
  line_number INTEGER NOT NULL,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_unit_price CHECK (unit_price_sek IS NULL OR unit_price_sek >= 0),
  CONSTRAINT valid_total_price CHECK (total_price_sek IS NULL OR total_price_sek >= 0),
  CONSTRAINT valid_line_number CHECK (line_number > 0)
);

-- Indexes
CREATE INDEX idx_order_lines_tenant ON order_lines(tenant_id);
CREATE INDEX idx_order_lines_order ON order_lines(order_id, line_number);
CREATE INDEX idx_order_lines_wine_sku ON order_lines(wine_sku_id);
CREATE INDEX idx_order_lines_wine_master ON order_lines(wine_master_id);

COMMENT ON TABLE order_lines IS 'Line items snapshot from offer at acceptance time';
COMMENT ON COLUMN order_lines.wine_name IS 'Denormalized wine name for history (even if SKU deleted)';
COMMENT ON COLUMN order_lines.unit_price_sek IS 'Internal offer price (NOT WS market price)';

-- ============================================================================
-- ORDER EVENTS TABLE (audit trail)
-- ============================================================================

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Parent order
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL,

  -- Status transition (if applicable)
  from_status TEXT,
  to_status TEXT,

  -- Event details
  note TEXT,
  metadata JSONB,

  -- Actor
  actor_user_id UUID NULL,
  actor_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_events_tenant ON order_events(tenant_id);
CREATE INDEX idx_order_events_order ON order_events(order_id, created_at DESC);
CREATE INDEX idx_order_events_type ON order_events(event_type);
CREATE INDEX idx_order_events_created ON order_events(created_at DESC);

COMMENT ON TABLE order_events IS 'Audit trail for all order actions (status changes, updates, etc)';
COMMENT ON COLUMN order_events.event_type IS 'Event type: ORDER_CREATED, STATUS_CHANGED, SHIPMENT_UPDATED, etc';
COMMENT ON COLUMN order_events.metadata IS 'Additional event data (e.g., tracking_number, shipment_details)';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON orders FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON order_lines FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON order_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation (if using custom JWT claims)
CREATE POLICY "Tenant isolation" ON orders FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation" ON order_lines FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation" ON order_events FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- VALIDATION QUERIES (to run after migration)
-- ============================================================================

-- Check that orders table is ready
-- SELECT COUNT(*) FROM orders;

-- Check indexes exist
-- SELECT indexname FROM pg_indexes WHERE tablename = 'orders';

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('orders', 'order_lines', 'order_events');


-- ============================================================================
-- SECTION: 20260119_add_import_id_to_orders.sql
-- ============================================================================

/**
 * MIGRATION: Add import_id to orders table
 *
 * Purpose: Link orders to import cases for EU compliance tracking
 *
 * Flow:
 * - EU order created → import case auto-created (if DDL available)
 * - Order linked to import case via orders.import_id
 * - IOR can view compliance status (5369, DDL) in order detail
 *
 * Business Rule:
 * - import_id is nullable (not all orders need import case, e.g., Swedish domestic)
 * - EU orders should have import_id (auto-created or manually linked)
 */

-- Add import_id column (nullable FK to imports table)
ALTER TABLE orders
ADD COLUMN import_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL;

-- Create index for FK lookups and filtering
CREATE INDEX idx_orders_import ON orders(import_id);

-- Composite index for tenant + import queries
CREATE INDEX idx_orders_tenant_import ON orders(tenant_id, import_id);

-- Comment for documentation
COMMENT ON COLUMN orders.import_id IS
  'Link to import case for EU compliance tracking. NULL for domestic orders or if import case not yet created. Auto-created for EU orders when DDL is available.';

-- Validation query (to run after migration)
-- SELECT
--   o.id,
--   o.status,
--   o.import_id,
--   s.type as supplier_type,
--   i.status as import_status
-- FROM orders o
-- JOIN suppliers s ON o.seller_supplier_id = s.id
-- LEFT JOIN imports i ON o.import_id = i.id
-- WHERE s.type IN ('EU_PRODUCER', 'EU_IMPORTER')
-- ORDER BY o.created_at DESC
-- LIMIT 20;


-- ============================================================================
-- SECTION: 20260120_create_admin_users.sql
-- ============================================================================

/**
 * ADMIN USERS TABLE - PRODUCTION-READY ADMIN ACCESS
 *
 * Purpose: Enable role-based admin access per tenant
 *
 * Security:
 * - Multi-tenant scoped (admins per tenant)
 * - RLS enforced (service role or same-tenant admins only)
 * - Used in conjunction with ADMIN_MODE env flag (dev-only fallback)
 *
 * Usage:
 * - Production: isAdmin(actor) checks this table
 * - Development: isAdmin(actor) falls back to ADMIN_MODE=true when NODE_ENV !== 'production'
 */

-- ============================================================================
-- STEP 1: Create admin_users table
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Audit
  created_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE (tenant_id, user_id)  -- One admin entry per user per tenant
);

-- ============================================================================
-- STEP 2: Indexes for performance
-- ============================================================================

CREATE INDEX idx_admin_users_tenant ON admin_users(tenant_id);
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_tenant_user ON admin_users(tenant_id, user_id);

-- ============================================================================
-- STEP 3: Comments
-- ============================================================================

COMMENT ON TABLE admin_users IS 'Admin role assignments per tenant (production-ready admin access control)';
COMMENT ON COLUMN admin_users.user_id IS 'References auth.users.id - user with admin privileges';
COMMENT ON COLUMN admin_users.created_by_user_id IS 'Admin who granted this admin access (audit trail)';


-- ============================================================================
-- SECTION: 20260120_enable_rls_admin_users.sql
-- ============================================================================

/**
 * RLS POLICIES - ADMIN USERS
 *
 * Security Model:
 * - Service role: Full access (used by API routes)
 * - Regular users: No direct access
 * - Admin check happens in application layer via isAdmin() helper
 */

-- ============================================================================
-- Enable RLS
-- ============================================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Service Role Policy (Full Access)
-- ============================================================================

CREATE POLICY "Service role full access" ON admin_users FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Note: No user-facing policies
-- ============================================================================

-- Admin users table is accessed exclusively via server-side API routes
-- using getSupabaseAdmin() with service role key.
-- All admin checks happen in application layer via isAdmin(actor) helper.


-- ============================================================================
-- SECTION: 20260120_moq_and_wine_catalog.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260120_required_wine_fields.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260121_enable_rls_all_tables.sql
-- ============================================================================

/**
 * COMPREHENSIVE RLS POLICIES
 * Migration: 20260121_enable_rls_all_tables
 *
 * Enables RLS with service role access on all tables
 */

-- ============================================================================
-- STEP 1: Drop ALL existing policies first (clean slate)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Enable RLS on all public tables
-- ============================================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma_%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Create service role policies for all tables
-- ============================================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma_%'
  ) LOOP
    EXECUTE format('
      CREATE POLICY "Service role full access" ON public.%I FOR ALL
      USING (auth.jwt() ->> ''role'' = ''service_role'')
      WITH CHECK (auth.jwt() ->> ''role'' = ''service_role'')
    ', t.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Run this to verify:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;


-- ============================================================================
-- SECTION: 20260121_require_case_size.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260124_add_delivery_location_to_requests.sql
-- ============================================================================

/**
 * ADD DELIVERY LOCATION TO REQUESTS
 *
 * Allows restaurant to specify delivery city/location in their request
 * so suppliers can calculate accurate shipping costs.
 *
 * Also ensures order value tracking for Winefeed invoicing.
 */

-- Add delivery location fields to requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS leverans_ort TEXT,
  ADD COLUMN IF NOT EXISTS leverans_adress TEXT,
  ADD COLUMN IF NOT EXISTS leverans_postnummer TEXT;

-- Comments
COMMENT ON COLUMN requests.leverans_ort IS 'Delivery city, e.g. Stockholm, Malmö, Göteborg';
COMMENT ON COLUMN requests.leverans_adress IS 'Full delivery address (optional, can be provided later)';
COMMENT ON COLUMN requests.leverans_postnummer IS 'Postal code for delivery location';

-- Verify commercial_intents has order value tracking (for Winefeed invoicing)
-- These should already exist from previous migrations:
-- - total_goods_amount_ore: Wine value in öre
-- - shipping_amount_ore: Shipping cost in öre (if any)
-- - total_payable_estimate_ore: Total order value
-- - service_fee_amount_ore: Winefeed fee (currently 0 for pilot)
-- - service_fee_mode: 'PILOT_FREE' or future modes like 'PERCENTAGE'

-- Add index for querying by delivery location
CREATE INDEX IF NOT EXISTS idx_requests_leverans_ort ON requests(leverans_ort);


-- ============================================================================
-- SECTION: 20260124_add_shipping_to_offers.sql
-- ============================================================================

/**
 * ADD SHIPPING FIELDS TO OFFERS
 *
 * Allows suppliers to include shipping cost when responding to requests.
 * Two options:
 * - is_franco = true: "Fritt levererat" - shipping included in wine price
 * - is_franco = false: shipping_cost_sek specifies the shipping cost
 *
 * Related to: /supplier/requests bulk offer, /supplier/requests/[id] single offer
 */

-- Add shipping columns to offers table
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS is_franco BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_cost_sek INTEGER NULL,
  ADD COLUMN IF NOT EXISTS shipping_notes TEXT NULL;

-- Add index for filtering franco/non-franco offers
CREATE INDEX IF NOT EXISTS idx_offers_is_franco ON offers(is_franco);

-- Comments
COMMENT ON COLUMN offers.is_franco IS 'True = shipping included in price (fritt levererat), False = separate shipping cost';
COMMENT ON COLUMN offers.shipping_cost_sek IS 'Shipping cost in SEK (öre), null if is_franco=true';
COMMENT ON COLUMN offers.shipping_notes IS 'Optional notes about shipping, e.g. "Leverans Sthlm, andra orter +200 kr"';


-- ============================================================================
-- SECTION: 20260124_add_shipping_to_orders.sql
-- ============================================================================

/**
 * ADD SHIPPING AND ORDER VALUE TRACKING TO ORDERS
 *
 * Extends orders table to track:
 * - Shipping info from accepted offer (is_franco, shipping_cost)
 * - Total order value for Winefeed invoicing
 *
 * Business model: Winefeed as Order Facilitator
 * - Tracks order value so Winefeed can invoice commission later
 * - Stores amounts in öre (1/100 SEK) for precision
 */

-- Add shipping columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_franco BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_cost_ore INTEGER NULL,
  ADD COLUMN IF NOT EXISTS shipping_notes TEXT NULL;

-- Add order value columns for Winefeed invoicing
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_goods_amount_ore INTEGER NULL,
  ADD COLUMN IF NOT EXISTS total_order_value_ore INTEGER NULL,
  ADD COLUMN IF NOT EXISTS service_fee_mode TEXT DEFAULT 'PILOT_FREE',
  ADD COLUMN IF NOT EXISTS service_fee_amount_ore INTEGER DEFAULT 0;

-- Comments
COMMENT ON COLUMN orders.is_franco IS 'True = shipping included in wine price (fritt levererat)';
COMMENT ON COLUMN orders.shipping_cost_ore IS 'Shipping cost in öre (1 SEK = 100 öre)';
COMMENT ON COLUMN orders.shipping_notes IS 'Notes about shipping, e.g. delivery location';
COMMENT ON COLUMN orders.total_goods_amount_ore IS 'Total wine value in öre (sum of order_lines.total_price_sek * 100)';
COMMENT ON COLUMN orders.total_order_value_ore IS 'Total order value in öre (goods + shipping)';
COMMENT ON COLUMN orders.service_fee_mode IS 'Winefeed fee mode: PILOT_FREE (no fee), PERCENTAGE (future)';
COMMENT ON COLUMN orders.service_fee_amount_ore IS 'Winefeed service fee in öre (0 for pilot)';

-- Add delivery location from request for email/confirmation
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_city TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT NULL;

COMMENT ON COLUMN orders.delivery_city IS 'Delivery city from request';
COMMENT ON COLUMN orders.delivery_address IS 'Delivery address (if provided)';
COMMENT ON COLUMN orders.delivery_postal_code IS 'Delivery postal code (if provided)';

-- Index for filtering by service fee mode (for future invoicing queries)
CREATE INDEX IF NOT EXISTS idx_orders_service_fee_mode ON orders(service_fee_mode);


-- ============================================================================
-- SECTION: 20260125_import_document_flow.sql
-- ============================================================================

/**
 * IMPORT DOCUMENT FLOW
 *
 * Migration: 20260125_import_document_flow
 *
 * Extends import_documents with:
 * 1. Document status tracking (PENDING, VERIFIED, REJECTED)
 * 2. Document type requirements per import status
 * 3. External document upload support
 * 4. Auto-transition helpers
 */

-- =============================================================================
-- STEP 1: Create document status enum
-- =============================================================================

DO $$
BEGIN
  CREATE TYPE import_document_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- STEP 2: Extend import_documents table
-- =============================================================================

-- Add status column
ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS status import_document_status DEFAULT 'PENDING';

-- Add file metadata for uploads
ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Add verification tracking
ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add document category (for required vs optional)
ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- =============================================================================
-- STEP 3: Create document types reference table
-- =============================================================================

CREATE TABLE IF NOT EXISTS import_document_types (
  code TEXT PRIMARY KEY,
  name_sv TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  required_for_status TEXT[],  -- Array of import statuses where this doc is required
  sort_order INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true
);

-- Insert standard document types for Swedish wine imports
INSERT INTO import_document_types (code, name_sv, name_en, description, required_for_status, sort_order) VALUES
  ('SKV_5369_03', 'Direktförsäljningstillstånd (5369)', 'Direct Delivery License Application', 'Skatteverkets blankett för DDL-ansökan', ARRAY['SUBMITTED'], 10),
  ('INVOICE', 'Faktura', 'Invoice', 'Leverantörsfaktura för varorna', ARRAY['SUBMITTED', 'DOCS_PENDING'], 20),
  ('PACKING_LIST', 'Packlista', 'Packing List', 'Detaljerad innehållsförteckning', ARRAY['SUBMITTED', 'DOCS_PENDING'], 30),
  ('CMR', 'Fraktsedel (CMR)', 'CMR Consignment Note', 'Internationell fraktsedel för vägtransport', ARRAY['IN_TRANSIT'], 40),
  ('CUSTOMS_DECLARATION', 'Tulldeklaration', 'Customs Declaration', 'Tullverkets importdeklaration', ARRAY['IN_TRANSIT', 'CLEARED'], 50),
  ('EXCISE_DOCUMENT', 'Punktskattedokument', 'Excise Document', 'e-AD eller EMCS-dokument', ARRAY['CLEARED'], 60),
  ('DELIVERY_NOTE', 'Följesedel', 'Delivery Note', 'Leveransbekräftelse vid mottagning', ARRAY['CLEARED'], 70),
  ('PROOF_OF_PAYMENT', 'Betalningsbevis', 'Proof of Payment', 'Kvitto eller bankutdrag', ARRAY[]::TEXT[], 80),
  ('OTHER', 'Övrigt', 'Other', 'Andra relevanta dokument', ARRAY[]::TEXT[], 99)
ON CONFLICT (code) DO UPDATE SET
  name_sv = EXCLUDED.name_sv,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  required_for_status = EXCLUDED.required_for_status,
  sort_order = EXCLUDED.sort_order;

-- =============================================================================
-- STEP 4: Create import document requirements view
-- =============================================================================

CREATE OR REPLACE VIEW import_document_requirements AS
SELECT
  i.id AS import_id,
  i.tenant_id,
  i.status AS import_status,
  dt.code AS document_type,
  dt.name_sv AS document_name,
  dt.required_for_status,
  (i.status = ANY(dt.required_for_status)) AS is_required_now,
  (
    SELECT COUNT(*) > 0
    FROM import_documents d
    WHERE d.import_id = i.id
    AND d.type = dt.code
    AND d.status = 'VERIFIED'
  ) AS is_satisfied,
  (
    SELECT d.id
    FROM import_documents d
    WHERE d.import_id = i.id
    AND d.type = dt.code
    ORDER BY d.version DESC
    LIMIT 1
  ) AS latest_document_id,
  (
    SELECT d.status
    FROM import_documents d
    WHERE d.import_id = i.id
    AND d.type = dt.code
    ORDER BY d.version DESC
    LIMIT 1
  ) AS latest_document_status
FROM imports i
CROSS JOIN import_document_types dt
WHERE dt.is_active = true;

-- =============================================================================
-- STEP 5: Helper function - check if import has all required docs
-- =============================================================================

CREATE OR REPLACE FUNCTION import_has_required_documents(p_import_id UUID)
RETURNS boolean AS $$
DECLARE
  v_missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing_count
  FROM import_document_requirements r
  WHERE r.import_id = p_import_id
  AND r.is_required_now = true
  AND r.is_satisfied = false;

  RETURN v_missing_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 6: Helper function - get missing documents for import
-- =============================================================================

CREATE OR REPLACE FUNCTION import_missing_documents(p_import_id UUID)
RETURNS TABLE (
  document_type TEXT,
  document_name TEXT,
  is_required BOOLEAN,
  has_pending BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.document_type,
    r.document_name,
    r.is_required_now AS is_required,
    (r.latest_document_status = 'PENDING') AS has_pending
  FROM import_document_requirements r
  WHERE r.import_id = p_import_id
  AND r.is_required_now = true
  AND r.is_satisfied = false
  ORDER BY (
    SELECT dt.sort_order FROM import_document_types dt WHERE dt.code = r.document_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: Trigger function - auto-update import status when docs verified
-- =============================================================================

CREATE OR REPLACE FUNCTION check_import_docs_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_import_id UUID;
  v_import_status TEXT;
  v_all_required_verified BOOLEAN;
BEGIN
  -- Get import info
  v_import_id := NEW.import_id;

  SELECT status INTO v_import_status
  FROM imports
  WHERE id = v_import_id;

  -- Only auto-transition from DOCS_PENDING
  IF v_import_status != 'DOCS_PENDING' THEN
    RETURN NEW;
  END IF;

  -- Check if all required documents are now verified
  v_all_required_verified := import_has_required_documents(v_import_id);

  -- If all required docs verified, transition to IN_TRANSIT
  IF v_all_required_verified AND NEW.status = 'VERIFIED' THEN
    UPDATE imports
    SET status = 'IN_TRANSIT',
        updated_at = NOW()
    WHERE id = v_import_id;

    -- Log the auto-transition
    INSERT INTO import_status_events (
      tenant_id,
      import_id,
      from_status,
      to_status,
      note,
      changed_by_user_id
    )
    SELECT
      tenant_id,
      v_import_id,
      'DOCS_PENDING',
      'IN_TRANSIT',
      'Automatisk övergång: alla obligatoriska dokument verifierade',
      NEW.verified_by
    FROM imports
    WHERE id = v_import_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_check_import_docs ON import_documents;
CREATE TRIGGER trigger_check_import_docs
  AFTER UPDATE OF status ON import_documents
  FOR EACH ROW
  WHEN (NEW.status = 'VERIFIED')
  EXECUTE FUNCTION check_import_docs_complete();

-- =============================================================================
-- STEP 8: Update state machine transitions in import-service
-- =============================================================================

-- Add comment documenting the expanded transitions
COMMENT ON TABLE imports IS 'Import cases with status flow: NOT_REGISTERED → SUBMITTED → DOCS_PENDING → IN_TRANSIT → CLEARED → APPROVED → CLOSED (or REJECTED at any point)';

-- =============================================================================
-- STEP 9: Indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_import_docs_status ON import_documents(status);
CREATE INDEX IF NOT EXISTS idx_import_docs_type_status ON import_documents(type, status);
CREATE INDEX IF NOT EXISTS idx_import_docs_import_type ON import_documents(import_id, type);

-- =============================================================================
-- STEP 10: RLS for document types (public read)
-- =============================================================================

ALTER TABLE import_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to document types"
  ON import_document_types
  FOR SELECT
  USING (true);

CREATE POLICY "Service role full access to document types"
  ON import_document_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Done!


-- ============================================================================
-- SECTION: 20260125_hardening_audit_dedupe.sql
-- ============================================================================

/**
 * HARDENING C: Audit Log De-duplication
 *
 * Migration: 20260125_hardening_audit_dedupe
 *
 * Prevents duplicate audit log entries from rapid clicks or retries.
 * Uses unique partial indexes with time bucketing.
 */

-- =============================================================================
-- STEP 1: Add idempotency key column to event tables
-- =============================================================================

-- request_events
ALTER TABLE request_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- offer_events
ALTER TABLE offer_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- order_events
ALTER TABLE order_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- import_status_events
ALTER TABLE import_status_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- =============================================================================
-- STEP 2: Create unique partial indexes for deduplication
-- These prevent duplicate events within the same minute for the same entity/action
-- =============================================================================

-- request_events: prevent duplicate status changes within same minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_events_dedupe
  ON request_events (
    request_id,
    event_type,
    from_status,
    to_status,
    date_trunc('minute', created_at)
  )
  WHERE idempotency_key IS NULL;

-- SKIPPED: offer_events has no from_status/to_status columns
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_events_dedupe
--   ON offer_events (offer_id, event_type, from_status, to_status, date_trunc('minute', created_at))
--   WHERE idempotency_key IS NULL;

-- order_events: prevent duplicate status changes within same minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_events_dedupe
  ON order_events (
    order_id,
    event_type,
    from_status,
    to_status,
    date_trunc('minute', created_at)
  )
  WHERE idempotency_key IS NULL;

-- import_status_events: prevent duplicate status changes within same minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_events_dedupe
  ON import_status_events (
    import_id,
    from_status,
    to_status,
    date_trunc('minute', created_at)
  )
  WHERE idempotency_key IS NULL;

-- =============================================================================
-- STEP 3: Create helper function for safe event insertion
-- =============================================================================

CREATE OR REPLACE FUNCTION insert_event_safe(
  p_table_name TEXT,
  p_event_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Dynamic insert with ON CONFLICT DO NOTHING behavior via exception handling
  BEGIN
    EXECUTE format(
      'INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1) RETURNING to_jsonb(%I.*)',
      p_table_name, p_table_name, p_table_name
    ) INTO v_result USING p_event_data;

    RETURN jsonb_build_object(
      'success', true,
      'inserted', true,
      'data', v_result
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', true,
        'inserted', false,
        'reason', 'duplicate_prevented'
      );
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 4: Comments
-- =============================================================================

COMMENT ON COLUMN request_events.idempotency_key IS 'Optional client-provided key to allow intentional duplicate events (e.g., user retry with new key)';
COMMENT ON COLUMN offer_events.idempotency_key IS 'Optional client-provided key to allow intentional duplicate events';
COMMENT ON COLUMN order_events.idempotency_key IS 'Optional client-provided key to allow intentional duplicate events';
COMMENT ON COLUMN import_status_events.idempotency_key IS 'Optional client-provided key to allow intentional duplicate events';

COMMENT ON FUNCTION insert_event_safe(TEXT, JSONB) IS 'Safely insert event with automatic deduplication (returns success even if duplicate prevented)';

-- Done!


-- ============================================================================
-- SECTION: 20260125_hardening_ior_review.sql
-- ============================================================================

/**
 * HARDENING A: IOR Submit for Review
 *
 * Migration: 20260125_hardening_ior_review
 *
 * Adds SUBMITTED_FOR_REVIEW status for documents.
 * Allows IOR to mark documents ready for admin verification.
 *
 * Flow:
 * 1. IOR uploads document → PENDING
 * 2. IOR submits for review → SUBMITTED_FOR_REVIEW
 * 3. ADMIN verifies → VERIFIED or REJECTED
 */

-- =============================================================================
-- STEP 1: Add new status to enum
-- =============================================================================

ALTER TYPE import_document_status ADD VALUE IF NOT EXISTS 'SUBMITTED_FOR_REVIEW' AFTER 'PENDING';

-- =============================================================================
-- STEP 2: Add submitted_for_review tracking columns
-- =============================================================================

ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_for_review_by UUID REFERENCES auth.users(id);

-- =============================================================================
-- STEP 3: Comment for clarity
-- =============================================================================

COMMENT ON COLUMN import_documents.status IS 'Document status: PENDING → SUBMITTED_FOR_REVIEW → VERIFIED/REJECTED';
COMMENT ON COLUMN import_documents.submitted_for_review_at IS 'When IOR submitted this document for admin review';
COMMENT ON COLUMN import_documents.submitted_for_review_by IS 'User who submitted for review (usually IOR)';

-- Done!


-- ============================================================================
-- SECTION: 20260125_request_events_and_status.sql
-- ============================================================================

-- =============================================================================
-- MIGRATION: Request Events & Status Updates
--
-- Adds audit trail for request status changes and ensures status enum is complete.
-- =============================================================================

-- 1. Create request_events table for audit trail
CREATE TABLE IF NOT EXISTS request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'status_change', 'offer_received', 'offer_accepted', etc.
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  metadata JSONB DEFAULT '{}',
  actor_user_id UUID,
  actor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_request_events_request_id ON request_events(request_id);
CREATE INDEX IF NOT EXISTS idx_request_events_created_at ON request_events(created_at DESC);

-- 2. Add DRAFT status to requests if not exists (for future use)
-- Note: Current requests use OPEN as initial status, DRAFT can be used for saved-but-not-sent requests

-- 3. Add closed_at and cancelled_at timestamps to requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- 4. Create function to log request status changes
CREATE OR REPLACE FUNCTION log_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO request_events (
      request_id,
      event_type,
      from_status,
      to_status,
      metadata
    ) VALUES (
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'accepted_offer_id', NEW.accepted_offer_id,
        'closed_reason', NEW.closed_reason,
        'cancelled_reason', NEW.cancelled_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for automatic logging
DROP TRIGGER IF EXISTS trigger_request_status_change ON requests;
CREATE TRIGGER trigger_request_status_change
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION log_request_status_change();

-- 6. Add RLS policies for request_events
ALTER TABLE request_events ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to request_events"
  ON request_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- OFFER STATUS UPDATES
-- =============================================================================

-- 7. Add VIEWED and EXPIRED statuses to offers if CHECK constraint allows
-- Note: We'll handle this in application layer since offers use TEXT with CHECK

-- 8. Add viewed_at and expired_at columns to offers
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;  -- When the offer will expire

-- =============================================================================
-- IMPORT STATUS UPDATES
-- =============================================================================

-- 9. Ensure import_status enum has all needed values
-- Note: Adding new enum values is safe (existing data unaffected)
DO $$
BEGIN
  -- Add DOCS_PENDING if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DOCS_PENDING' AND enumtypid = 'import_status'::regtype) THEN
    ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'DOCS_PENDING' AFTER 'SUBMITTED';
  END IF;

  -- Add IN_TRANSIT if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'IN_TRANSIT' AND enumtypid = 'import_status'::regtype) THEN
    ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT' AFTER 'DOCS_PENDING';
  END IF;

  -- Add CLEARED if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLEARED' AND enumtypid = 'import_status'::regtype) THEN
    ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'CLEARED' AFTER 'IN_TRANSIT';
  END IF;

  -- Add CLOSED if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLOSED' AND enumtypid = 'import_status'::regtype) THEN
    ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'CLOSED' AFTER 'APPROVED';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Enum might not exist or values might already exist
    NULL;
END $$;

-- =============================================================================
-- ORDER STATUS UPDATES
-- =============================================================================

-- 10. Add PENDING status to order_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDING' AND enumtypid = 'order_status'::regtype) THEN
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'CONFIRMED';
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- Done!


-- ============================================================================
-- SECTION: 20260125_restaurant_delivery_addresses.sql
-- ============================================================================

/**
 * RESTAURANT DELIVERY ADDRESSES
 *
 * Allows restaurants to save multiple delivery addresses
 * and select from them when creating requests.
 */

-- Create delivery addresses table
CREATE TABLE IF NOT EXISTS restaurant_delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  -- Address details
  label TEXT NOT NULL,  -- User-friendly name, e.g. "Huvudrestaurang", "Eventlokal"
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'SE',

  -- Contact for this address
  contact_name TEXT,
  contact_phone TEXT,

  -- Delivery instructions
  delivery_instructions TEXT,

  -- Settings
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_delivery_addresses_tenant ON restaurant_delivery_addresses(tenant_id);
CREATE INDEX idx_delivery_addresses_restaurant ON restaurant_delivery_addresses(restaurant_id);
CREATE INDEX idx_delivery_addresses_active ON restaurant_delivery_addresses(restaurant_id, is_active);

-- Comments
COMMENT ON TABLE restaurant_delivery_addresses IS 'Saved delivery addresses for restaurants';
COMMENT ON COLUMN restaurant_delivery_addresses.label IS 'User-friendly name for this address';
COMMENT ON COLUMN restaurant_delivery_addresses.is_default IS 'If true, this address is pre-selected when creating new requests';

-- Enable RLS
ALTER TABLE restaurant_delivery_addresses ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON restaurant_delivery_addresses
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation
CREATE POLICY "Tenant isolation" ON restaurant_delivery_addresses
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Function to ensure only one default address per restaurant
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE restaurant_delivery_addresses
    SET is_default = FALSE
    WHERE restaurant_id = NEW.restaurant_id
      AND id != NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single default
CREATE TRIGGER tr_ensure_single_default_address
  AFTER INSERT OR UPDATE OF is_default ON restaurant_delivery_addresses
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION ensure_single_default_address();

-- Auto-update updated_at
CREATE TRIGGER tr_delivery_addresses_updated_at
  BEFORE UPDATE ON restaurant_delivery_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION: 20260125_restaurant_onboarding_fields.sql
-- ============================================================================

-- ============================================================================
-- RESTAURANT ONBOARDING FIELDS
--
-- Adds fields for restaurant onboarding:
-- - Address fields (from org number lookup or manual input)
-- - License/permit fields (serveringstillstånd) for compliance
-- - Onboarding status tracking
-- ============================================================================

-- Add address fields to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add license fields (serveringstillstånd)
-- These are collected in step 2 (when placing first order)
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS license_municipality TEXT,      -- Utfärdande kommun
ADD COLUMN IF NOT EXISTS license_case_number TEXT,       -- Diarienummer
ADD COLUMN IF NOT EXISTS license_decision_date DATE,     -- Beslutsdatum
ADD COLUMN IF NOT EXISTS license_valid_from DATE,        -- Giltig från
ADD COLUMN IF NOT EXISTS license_valid_until DATE,       -- Giltig till
ADD COLUMN IF NOT EXISTS license_category TEXT;          -- Kategorikod

-- Add onboarding tracking
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_verified_at TIMESTAMPTZ;

-- Note: org_number already exists (added via earlier fix script)

-- Add index for city (used for prefilling delivery location)
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);

-- Add comment
COMMENT ON COLUMN restaurants.city IS 'City for prefilling delivery location in requests';
COMMENT ON COLUMN restaurants.license_municipality IS 'Municipality that issued the alcohol license (serveringstillstånd)';
COMMENT ON COLUMN restaurants.license_case_number IS 'Case number (diarienummer) for traceability';
COMMENT ON COLUMN restaurants.license_valid_until IS 'License expiry date - must be current for orders';


-- ============================================================================
-- SECTION: 20260125_user_roles_rbac.sql
-- ============================================================================

/**
 * USER ROLES & RBAC - Production-Ready Role Management
 *
 * Migration: 20260125_user_roles_rbac
 *
 * Creates centralized role management with:
 * 1. user_roles table for explicit role assignments
 * 2. user_roles_computed view consolidating all role sources
 * 3. RLS helper functions for authorization
 *
 * Role Sources:
 * - restaurant_users → RESTAURANT (implicit)
 * - supplier_users → SELLER (implicit)
 * - org_number match → IOR (implicit)
 * - admin_users → ADMIN (implicit)
 * - user_roles → any role (explicit)
 */

-- =============================================================================
-- STEP 1: Create role type enum
-- =============================================================================

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('RESTAURANT', 'SELLER', 'IOR', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- STEP 2: Create user_roles table for explicit role assignments
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,

  -- Entity association (optional - for role-specific entity binding)
  entity_type TEXT,  -- 'restaurant', 'supplier', 'importer'
  entity_id UUID,

  -- Audit
  granted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Optional expiration

  -- Constraints
  UNIQUE (tenant_id, user_id, role, entity_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_user ON user_roles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- =============================================================================
-- STEP 3: Create computed roles view
-- =============================================================================

CREATE OR REPLACE VIEW user_roles_computed AS
-- Explicit roles from user_roles table (not expired)
SELECT
  tenant_id,
  user_id,
  role::text AS role,
  entity_type,
  entity_id,
  'explicit' AS source
FROM user_roles
WHERE expires_at IS NULL OR expires_at > NOW()

UNION ALL

-- Implicit RESTAURANT role from restaurant_users
-- (restaurant_users has no tenant_id, get it from restaurants)
SELECT
  r.tenant_id,
  ru.id AS user_id,
  'RESTAURANT' AS role,
  'restaurant' AS entity_type,
  ru.restaurant_id AS entity_id,
  'restaurant_users' AS source
FROM restaurant_users ru
JOIN restaurants r ON ru.restaurant_id = r.id

UNION ALL

-- Implicit SELLER role from supplier_users
-- (supplier_users has no tenant_id, use single-tenant constant)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid AS tenant_id,
  su.id AS user_id,  -- supplier_users.id = auth.users.id
  'SELLER' AS role,
  'supplier' AS entity_type,
  su.supplier_id AS entity_id,
  'supplier_users' AS source
FROM supplier_users su
INNER JOIN suppliers s ON su.supplier_id = s.id

UNION ALL

-- Implicit IOR role from org_number matching
SELECT DISTINCT
  i.tenant_id,
  su.id AS user_id,
  'IOR' AS role,
  'importer' AS entity_type,
  i.id AS entity_id,
  'org_number_match' AS source
FROM supplier_users su
INNER JOIN suppliers s ON su.supplier_id = s.id
INNER JOIN importers i ON s.org_number = i.org_number AND s.org_number IS NOT NULL

UNION ALL

-- Implicit ADMIN role from admin_users
SELECT
  tenant_id,
  user_id,
  'ADMIN' AS role,
  NULL AS entity_type,
  NULL AS entity_id,
  'admin_users' AS source
FROM admin_users;

-- =============================================================================
-- STEP 4: RLS Helper Functions
-- =============================================================================

-- Check if current user has a specific role
CREATE OR REPLACE FUNCTION auth_has_role(check_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles_computed
    WHERE user_id = auth.uid()
    AND role = check_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user has any of the specified roles
CREATE OR REPLACE FUNCTION auth_has_any_role(check_roles text[])
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles_computed
    WHERE user_id = auth.uid()
    AND role = ANY(check_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's entity ID for a role
CREATE OR REPLACE FUNCTION auth_entity_id(for_role text)
RETURNS uuid AS $$
  SELECT entity_id FROM user_roles_computed
  WHERE user_id = auth.uid()
  AND role = for_role
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user has access to a specific entity
CREATE OR REPLACE FUNCTION auth_has_entity_access(check_entity_type text, check_entity_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles_computed
    WHERE user_id = auth.uid()
    AND entity_type = check_entity_type
    AND entity_id = check_entity_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all roles for current user
CREATE OR REPLACE FUNCTION auth_roles()
RETURNS text[] AS $$
  SELECT array_agg(DISTINCT role) FROM user_roles_computed
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================================================
-- STEP 5: Enable RLS on user_roles
-- =============================================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to user_roles"
  ON user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can see their own roles
CREATE POLICY "Users see own roles"
  ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- =============================================================================
-- STEP 6: Comments
-- =============================================================================

COMMENT ON TABLE user_roles IS 'Explicit role assignments (supplements implicit roles from entity tables)';
COMMENT ON VIEW user_roles_computed IS 'Consolidated view of all user roles (explicit + implicit)';
COMMENT ON FUNCTION auth_has_role(text) IS 'Check if current user has a specific role';
COMMENT ON FUNCTION auth_has_any_role(text[]) IS 'Check if current user has any of the specified roles';
COMMENT ON FUNCTION auth_entity_id(text) IS 'Get entity ID for a role (e.g., restaurant_id for RESTAURANT role)';
COMMENT ON FUNCTION auth_has_entity_access(text, uuid) IS 'Check if user has access to a specific entity';
COMMENT ON FUNCTION auth_roles() IS 'Get all roles for current user';

-- Done!


-- ============================================================================
-- SECTION: 20260125_wine_catalog_status.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260126_sponsored_slots.sql
-- ============================================================================

-- ============================================
-- SPONSORED SLOTS - Database Schema
-- ============================================
-- Allows suppliers to purchase sponsored placements
-- in wine categories with limited inventory (caps)
-- ============================================

-- 1. Sponsored Categories
-- Categories where suppliers can buy sponsored slots
CREATE TABLE IF NOT EXISTS sponsored_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Category info
  name TEXT NOT NULL,                    -- e.g., "Burgundy", "Champagne", "Natural Wine"
  slug TEXT NOT NULL,                    -- URL-friendly: "burgundy", "champagne"
  description TEXT,                      -- Optional description

  -- Sponsor cap (limited inventory)
  sponsor_cap INTEGER NOT NULL DEFAULT 3,  -- Max sponsors per category

  -- Pricing (Stripe price IDs)
  stripe_price_id_monthly TEXT,          -- Monthly subscription price
  stripe_price_id_yearly TEXT,           -- Yearly subscription price (discounted)
  price_monthly_sek INTEGER DEFAULT 0,   -- Display price in SEK
  price_yearly_sek INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(tenant_id, slug)
);

-- Index for lookups
CREATE INDEX idx_sponsored_categories_tenant ON sponsored_categories(tenant_id);
CREATE INDEX idx_sponsored_categories_slug ON sponsored_categories(tenant_id, slug);
CREATE INDEX idx_sponsored_categories_active ON sponsored_categories(tenant_id, is_active);


-- 2. Sponsored Slots
-- Tracks which suppliers have slots in which categories
CREATE TABLE IF NOT EXISTS sponsored_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Slot assignment
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES sponsored_categories(id) ON DELETE CASCADE,

  -- Slot type
  slot_type TEXT NOT NULL DEFAULT 'PURCHASED',  -- 'INCLUDED' (from tier) or 'PURCHASED' (add-on)

  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, EXPIRED, CANCELLED

  -- Stripe subscription (for purchased slots)
  stripe_subscription_id TEXT,            -- Links to Stripe subscription
  stripe_subscription_item_id TEXT,       -- Specific line item in subscription

  -- Validity period
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,                 -- NULL = no expiry (until cancelled)

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(tenant_id, supplier_id, category_id)  -- One slot per supplier per category
);

-- Indexes
CREATE INDEX idx_sponsored_slots_tenant ON sponsored_slots(tenant_id);
CREATE INDEX idx_sponsored_slots_supplier ON sponsored_slots(supplier_id);
CREATE INDEX idx_sponsored_slots_category ON sponsored_slots(category_id);
CREATE INDEX idx_sponsored_slots_status ON sponsored_slots(status);
CREATE INDEX idx_sponsored_slots_stripe ON sponsored_slots(stripe_subscription_id);


-- 3. Supplier Entitlements
-- Tracks how many sponsored slots each supplier can use
CREATE TABLE IF NOT EXISTS supplier_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Included slots (from subscription tier)
  included_slots INTEGER NOT NULL DEFAULT 0,   -- Premium tier gets 1

  -- Purchased add-on slots
  purchased_slots INTEGER NOT NULL DEFAULT 0,  -- Extra slots bought as add-ons

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(tenant_id, supplier_id)
);

-- Indexes
CREATE INDEX idx_supplier_entitlements_tenant ON supplier_entitlements(tenant_id);
CREATE INDEX idx_supplier_entitlements_supplier ON supplier_entitlements(supplier_id);


-- 4. Sponsored Slot Events (Audit log)
CREATE TABLE IF NOT EXISTS sponsored_slot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- References
  slot_id UUID REFERENCES sponsored_slots(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES sponsored_categories(id) ON DELETE SET NULL,

  -- Event info
  event_type TEXT NOT NULL,  -- SLOT_ASSIGNED, SLOT_EXPIRED, SLOT_CANCELLED, ENTITLEMENT_UPDATED
  actor_user_id UUID,        -- Who triggered it (NULL for system)
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsored_slot_events_tenant ON sponsored_slot_events(tenant_id);
CREATE INDEX idx_sponsored_slot_events_supplier ON sponsored_slot_events(supplier_id);
CREATE INDEX idx_sponsored_slot_events_slot ON sponsored_slot_events(slot_id);


-- 5. Add included_sponsored_slots to tier_limits
-- Premium tier gets 1 included slot
ALTER TABLE tier_limits
  ADD COLUMN IF NOT EXISTS included_sponsored_slots INTEGER NOT NULL DEFAULT 0;

-- Update tier limits: Premium gets 1 included sponsored slot
UPDATE tier_limits SET included_sponsored_slots = 0 WHERE tier = 'free';
UPDATE tier_limits SET included_sponsored_slots = 0 WHERE tier = 'pro';
UPDATE tier_limits SET included_sponsored_slots = 1 WHERE tier = 'premium';


-- 6. Helper function: Count active slots in a category
CREATE OR REPLACE FUNCTION count_active_slots_in_category(p_category_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM sponsored_slots
  WHERE category_id = p_category_id
    AND status = 'ACTIVE'
    AND (expires_at IS NULL OR expires_at > now());
$$ LANGUAGE SQL STABLE;


-- 7. Helper function: Check if category has available slots
CREATE OR REPLACE FUNCTION category_has_available_slots(p_category_id UUID)
RETURNS BOOLEAN AS $$
  SELECT count_active_slots_in_category(p_category_id) <
         (SELECT sponsor_cap FROM sponsored_categories WHERE id = p_category_id);
$$ LANGUAGE SQL STABLE;


-- 8. Helper function: Get supplier's remaining slot allowance
CREATE OR REPLACE FUNCTION get_supplier_remaining_slots(p_supplier_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_entitlement INTEGER;
  v_used_slots INTEGER;
BEGIN
  -- Get total entitlement (included + purchased)
  SELECT COALESCE(included_slots, 0) + COALESCE(purchased_slots, 0)
  INTO v_total_entitlement
  FROM supplier_entitlements
  WHERE supplier_id = p_supplier_id;

  IF v_total_entitlement IS NULL THEN
    v_total_entitlement := 0;
  END IF;

  -- Count active slots
  SELECT COUNT(*)
  INTO v_used_slots
  FROM sponsored_slots
  WHERE supplier_id = p_supplier_id
    AND status = 'ACTIVE'
    AND (expires_at IS NULL OR expires_at > now());

  RETURN v_total_entitlement - v_used_slots;
END;
$$ LANGUAGE plpgsql STABLE;


-- 9. RLS Policies
ALTER TABLE sponsored_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsored_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsored_slot_events ENABLE ROW LEVEL SECURITY;

-- Sponsored categories: Anyone can read, only admin can write
CREATE POLICY "sponsored_categories_read" ON sponsored_categories
  FOR SELECT USING (true);

CREATE POLICY "sponsored_categories_admin" ON sponsored_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND tenant_id = sponsored_categories.tenant_id
    )
  );

-- Sponsored slots: Suppliers can read their own, admin can read all
CREATE POLICY "sponsored_slots_supplier_read" ON sponsored_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM supplier_users
      WHERE id = auth.uid() AND supplier_id = sponsored_slots.supplier_id
    )
  );

CREATE POLICY "sponsored_slots_admin" ON sponsored_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND tenant_id = sponsored_slots.tenant_id
    )
  );

-- Supplier entitlements: Suppliers can read their own
CREATE POLICY "supplier_entitlements_read" ON supplier_entitlements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM supplier_users
      WHERE id = auth.uid() AND supplier_id = supplier_entitlements.supplier_id
    )
  );

-- Slot events: Suppliers can read their own events
CREATE POLICY "sponsored_slot_events_read" ON sponsored_slot_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM supplier_users
      WHERE id = auth.uid() AND supplier_id = sponsored_slot_events.supplier_id
    )
  );


-- 10. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_sponsored_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sponsored_categories_updated_at
  BEFORE UPDATE ON sponsored_categories
  FOR EACH ROW EXECUTE FUNCTION update_sponsored_updated_at();

CREATE TRIGGER sponsored_slots_updated_at
  BEFORE UPDATE ON sponsored_slots
  FOR EACH ROW EXECUTE FUNCTION update_sponsored_updated_at();

CREATE TRIGGER supplier_entitlements_updated_at
  BEFORE UPDATE ON supplier_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_sponsored_updated_at();


-- ============================================
-- SEED DATA: Initial sponsored categories
-- ============================================
-- Note: Run this after setting up a tenant

-- INSERT INTO sponsored_categories (tenant_id, name, slug, sponsor_cap, price_monthly_sek, price_yearly_sek)
-- SELECT
--   id,
--   'Burgundy',
--   'burgundy',
--   3,
--   1500,
--   15000
-- FROM tenants LIMIT 1;


-- ============================================================================
-- SECTION: 20260126_subscriptions.sql
-- ============================================================================

-- ============================================================================
-- SUBSCRIPTIONS & MONETIZATION
--
-- Adds support for:
-- 1. Subscription tiers (free, pro, premium)
-- 2. Stripe integration
-- 3. Feature limits tracking
-- ============================================================================

-- Create subscription tier enum
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create subscription status enum
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add tier to suppliers for fast lookup
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS tier subscription_tier DEFAULT 'free';

-- Create index for tier filtering
CREATE INDEX IF NOT EXISTS idx_suppliers_tier ON suppliers(tier);

-- Subscriptions table (links to Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Tier info
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Stripe references
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One active subscription per supplier
  CONSTRAINT unique_active_subscription UNIQUE (supplier_id)
);

-- Index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- Usage tracking table (for feature limits)
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Usage metrics (reset monthly)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Counts
  wines_count INTEGER DEFAULT 0,
  leads_received INTEGER DEFAULT 0,
  offers_sent INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per supplier per period
  CONSTRAINT unique_usage_period UNIQUE (supplier_id, period_start)
);

-- Index for usage lookups
CREATE INDEX IF NOT EXISTS idx_subscription_usage_supplier ON subscription_usage(supplier_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON subscription_usage(period_start, period_end);

-- ============================================================================
-- TIER LIMITS CONFIG (as a reference table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tier_limits (
  tier subscription_tier PRIMARY KEY,
  max_wines INTEGER,           -- NULL = unlimited
  max_leads_per_month INTEGER, -- NULL = unlimited
  max_offers_per_month INTEGER, -- NULL = unlimited
  priority_in_search INTEGER DEFAULT 0,  -- Higher = better placement
  features JSONB DEFAULT '{}'  -- Flexible feature flags
);

-- Insert default limits
INSERT INTO tier_limits (tier, max_wines, max_leads_per_month, max_offers_per_month, priority_in_search, features)
VALUES
  ('free', NULL, 5, 10, 0, '{"analytics": false, "extended_profile": false, "support": "self-service"}'),
  ('pro', NULL, NULL, NULL, 10, '{"analytics": true, "extended_profile": true, "support": "email"}'),
  ('premium', NULL, NULL, NULL, 20, '{"analytics": true, "analytics_competitors": true, "extended_profile": true, "video_profile": true, "support": "dedicated"}')
ON CONFLICT (tier) DO UPDATE SET
  max_wines = EXCLUDED.max_wines,
  max_leads_per_month = EXCLUDED.max_leads_per_month,
  max_offers_per_month = EXCLUDED.max_offers_per_month,
  priority_in_search = EXCLUDED.priority_in_search,
  features = EXCLUDED.features;

-- ============================================================================
-- HELPER FUNCTION: Get supplier's current limits
-- ============================================================================
CREATE OR REPLACE FUNCTION get_supplier_limits(p_supplier_id UUID)
RETURNS TABLE (
  tier subscription_tier,
  max_wines INTEGER,
  max_leads_per_month INTEGER,
  current_wines INTEGER,
  current_leads INTEGER,
  can_add_wine BOOLEAN,
  can_receive_lead BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.tier,
    tl.max_wines,
    tl.max_leads_per_month,
    COALESCE((SELECT COUNT(*)::INTEGER FROM supplier_wines WHERE supplier_id = p_supplier_id AND is_active = true), 0),
    COALESCE(su.leads_received, 0),
    (tl.max_wines IS NULL OR COALESCE((SELECT COUNT(*) FROM supplier_wines WHERE supplier_id = p_supplier_id AND is_active = true), 0) < tl.max_wines),
    (tl.max_leads_per_month IS NULL OR COALESCE(su.leads_received, 0) < tl.max_leads_per_month)
  FROM suppliers s
  JOIN tier_limits tl ON s.tier = tl.tier
  LEFT JOIN subscription_usage su ON su.supplier_id = p_supplier_id
    AND su.period_start <= CURRENT_DATE
    AND su.period_end >= CURRENT_DATE
  WHERE s.id = p_supplier_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Sync tier between subscriptions and suppliers
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_supplier_tier()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers
  SET tier = NEW.tier
  WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_supplier_tier ON subscriptions;
CREATE TRIGGER trigger_sync_supplier_tier
AFTER INSERT OR UPDATE OF tier ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION sync_supplier_tier();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE subscriptions IS 'Tracks supplier subscription status and Stripe integration';
COMMENT ON TABLE subscription_usage IS 'Monthly usage tracking for feature limits';
COMMENT ON TABLE tier_limits IS 'Configuration for tier-based feature limits';
COMMENT ON COLUMN suppliers.tier IS 'Current subscription tier (synced from subscriptions table)';


-- ============================================================================
-- SECTION: 20260126_supplier_ior_location.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260128_request_items.sql
-- ============================================================================

-- REQUEST ITEMS TABLE
-- Migration: 20260128_request_items
-- Purpose: Store individual wine items in a quote request with provorder support

-- ============================================================================
-- Create request_items table
-- ============================================================================

CREATE TABLE IF NOT EXISTS request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  wine_id UUID REFERENCES supplier_wines(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Wine snapshot (in case wine is deleted)
  wine_name TEXT NOT NULL,
  producer TEXT,
  country TEXT,
  region TEXT,
  vintage INTEGER,
  color TEXT,

  -- Order details
  quantity INTEGER NOT NULL,
  price_sek INTEGER, -- Price at time of request (öre)
  moq INTEGER DEFAULT 0,

  -- Provorder info
  provorder BOOLEAN DEFAULT FALSE,
  provorder_fee INTEGER, -- Fee in SEK if provorder

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_supplier_id ON request_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_request_items_wine_id ON request_items(wine_id);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE request_items IS 'Individual wine items in a quote request';
COMMENT ON COLUMN request_items.provorder IS 'Whether this item is ordered as provorder (below MOQ with fee)';
COMMENT ON COLUMN request_items.provorder_fee IS 'Flat fee in SEK for this provorder item';


-- ============================================================================
-- SECTION: 20260128_supplier_provorder.sql
-- ============================================================================

-- SUPPLIER PROVORDER (DISCOVERY MODE)
-- Migration: 20260128_supplier_provorder
-- Purpose: Enable suppliers to accept small orders with a flat fee

-- ============================================================================
-- Add provorder fields to suppliers table
-- ============================================================================

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS provorder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS provorder_fee_sek INTEGER DEFAULT 500;

-- Constraint to ensure fee is positive
ALTER TABLE suppliers
ADD CONSTRAINT positive_provorder_fee CHECK (provorder_fee_sek IS NULL OR provorder_fee_sek >= 0);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN suppliers.provorder_enabled IS 'Whether supplier accepts small orders below MOQ with a fee';
COMMENT ON COLUMN suppliers.provorder_fee_sek IS 'Flat fee in SEK for provorder (default 500)';


-- ============================================================================
-- SECTION: 20260201_notifications.sql
-- ============================================================================

-- Notification System Tables
-- Created: 2026-02-01

-- Push subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Notification log (for debugging and analytics)
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  recipient TEXT, -- email address or push endpoint
  subject TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying logs
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_event_type ON notification_log(event_type);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  -- Granular settings per event type
  notify_new_offer BOOLEAN DEFAULT true,
  notify_offer_accepted BOOLEAN DEFAULT true,
  notify_order_confirmed BOOLEAN DEFAULT true,
  notify_offer_expiring BOOLEAN DEFAULT true,
  notify_new_request_match BOOLEAN DEFAULT true, -- for suppliers
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push subscriptions
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Users can view their own notification logs
CREATE POLICY "Users can view own notification logs"
  ON notification_log FOR SELECT
  USING (auth.uid() = user_id);

-- Users can manage their own preferences
CREATE POLICY "Users can manage own notification preferences"
  ON user_notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend)
CREATE POLICY "Service role full access to push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to notification_log"
  ON notification_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to preferences"
  ON user_notification_preferences FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');


-- ============================================================================
-- SECTION: 20260202_add_concierge_fields.sql
-- ============================================================================

/**
 * MIGRATION: Add concierge mode fields to orders
 *
 * Purpose: Track orders that Winefeed handles on behalf of the customer
 *
 * Use case: During pilot, offer "we handle everything for you" as a feature
 * - Admin marks order as handled_by_winefeed = true
 * - Admin can add notes about what was done
 * - Useful for first customers who want to test without risk
 */

-- Add concierge fields to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS handled_by_winefeed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS concierge_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS concierge_handled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS concierge_handled_by UUID NULL;

-- Index for filtering concierge orders
CREATE INDEX IF NOT EXISTS idx_orders_concierge ON orders(handled_by_winefeed) WHERE handled_by_winefeed = TRUE;

-- Comments
COMMENT ON COLUMN orders.handled_by_winefeed IS 'If true, Winefeed team handles fulfillment on behalf of customer';
COMMENT ON COLUMN orders.concierge_notes IS 'Admin notes about concierge handling (internal only)';
COMMENT ON COLUMN orders.concierge_handled_at IS 'When concierge mode was enabled';
COMMENT ON COLUMN orders.concierge_handled_by IS 'Admin user who enabled concierge mode';


-- ============================================================================
-- SECTION: 20260202_add_dispute_and_payment.sql
-- ============================================================================

-- ============================================================================
-- ADD DISPUTE AND PAYMENT TRACKING TO ORDERS
-- ============================================================================
-- Dispute: Restaurants can report problems with orders
-- Payment: Track payment status (pending during pilot, manual handling)
-- ============================================================================

-- Dispute fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS dispute_status TEXT DEFAULT 'none'
    CHECK (dispute_status IN ('none', 'reported', 'investigating', 'resolved')),
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS dispute_reported_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT NULL;

-- Payment fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'invoiced', 'paid', 'overdue', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_due_date DATE NULL,
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT NULL;

-- Index for filtering disputed orders
CREATE INDEX IF NOT EXISTS idx_orders_dispute_status ON orders(dispute_status) WHERE dispute_status != 'none';

-- Index for payment status
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

COMMENT ON COLUMN orders.dispute_status IS 'none=OK, reported=problem flagged, investigating=admin looking, resolved=closed';
COMMENT ON COLUMN orders.payment_status IS 'pending=awaiting invoice, invoiced=sent, paid=done, overdue=late, refunded=returned';


-- ============================================================================
-- SECTION: 20260202_notification_frequency.sql
-- ============================================================================

-- Add email frequency to notification preferences
-- Created: 2026-02-02

-- Add frequency column (immediate, daily, weekly)
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS email_frequency TEXT DEFAULT 'immediate'
    CHECK (email_frequency IN ('immediate', 'daily', 'weekly'));

-- Add reminder setting
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_offer_reminder BOOLEAN DEFAULT true;

-- Comment
COMMENT ON COLUMN user_notification_preferences.email_frequency IS 'How often to send email summaries: immediate, daily (08:00), weekly (Monday)';
COMMENT ON COLUMN user_notification_preferences.notify_offer_reminder IS 'Send reminder for unanswered offers after 48h';


-- ============================================================================
-- SECTION: 20260205_add_orange_wine_type.sql
-- ============================================================================

-- Add ORANGE to ior_wine_type enum
-- Orange wines are skin-contact white wines, popular in natural wine segment

ALTER TYPE ior_wine_type ADD VALUE IF NOT EXISTS 'ORANGE' AFTER 'ROSE';


-- ============================================================================
-- SECTION: 20260205_ior_combi_tag.sql
-- ============================================================================

-- Add combi_tag to ior_producers
-- Enables grouping producers for combined orders to reach MOQ easier

ALTER TABLE ior_producers
ADD COLUMN IF NOT EXISTS combi_tag VARCHAR(100);

-- Index for filtering by combi
CREATE INDEX IF NOT EXISTS idx_ior_producers_combi ON ior_producers(combi_tag)
WHERE combi_tag IS NOT NULL;

COMMENT ON COLUMN ior_producers.combi_tag IS 'Tag for grouping producers - customers can combine orders across producers with same tag to reach MOQ';


-- ============================================================================
-- SECTION: 20260205_ior_feedback.sql
-- ============================================================================

-- =============================================================================
-- IOR FEEDBACK ITEMS
-- Structured feedback collection from importers testing the IOR module
-- =============================================================================

CREATE TABLE IF NOT EXISTS ior_feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  importer_id uuid NOT NULL,

  -- Optional context links
  producer_id uuid REFERENCES ior_producers(id) ON DELETE SET NULL,
  product_id uuid REFERENCES ior_products(id) ON DELETE SET NULL,
  case_id uuid REFERENCES ior_communication_cases(id) ON DELETE SET NULL,

  -- Feedback metadata
  page_path text NOT NULL,
  category text NOT NULL CHECK (category IN ('UX', 'Bug', 'Data', 'Workflow', 'Missing feature', 'Other')),
  severity text NOT NULL CHECK (severity IN ('Low', 'Medium', 'High')),

  -- Feedback content
  title text NOT NULL,
  details text NOT NULL,
  expected text,

  -- Status tracking
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'DONE', 'WONTFIX')),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_ior_feedback_tenant_importer ON ior_feedback_items(tenant_id, importer_id);
CREATE INDEX idx_ior_feedback_created_at ON ior_feedback_items(created_at DESC);
CREATE INDEX idx_ior_feedback_status ON ior_feedback_items(status);
CREATE INDEX idx_ior_feedback_category ON ior_feedback_items(category);

-- Enable RLS
ALTER TABLE ior_feedback_items ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON ior_feedback_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- IOR users can manage their own feedback
CREATE POLICY "IOR access own feedback" ON ior_feedback_items
  FOR ALL
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ior_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ior_feedback_updated_at
  BEFORE UPDATE ON ior_feedback_items
  FOR EACH ROW
  EXECUTE FUNCTION update_ior_feedback_updated_at();

-- =============================================================================
-- SAMPLE DATA (optional, for testing)
-- =============================================================================

-- Sample feedback items will be inserted via the app during testing


-- ============================================================================
-- SECTION: 20260205_ior_portfolio_schema.sql
-- ============================================================================

-- IOR Portfolio Operator Schema
-- Enables IORs to manage producer portfolios with products, pricing, and communication

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Price list status
DO $$ BEGIN
  CREATE TYPE ior_price_list_status AS ENUM ('DRAFT', 'ACTIVE', 'NEXT', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Case status (WAITING_INTERNAL for producer replies, compute overdue from due_at)
DO $$ BEGIN
  CREATE TYPE ior_case_status AS ENUM ('OPEN', 'WAITING_PRODUCER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Case priority
DO $$ BEGIN
  CREATE TYPE ior_case_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Wine type
DO $$ BEGIN
  CREATE TYPE ior_wine_type AS ENUM ('RED', 'WHITE', 'ROSE', 'SPARKLING', 'DESSERT', 'FORTIFIED', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- ior_producers: Wine producers managed by an IOR
CREATE TABLE IF NOT EXISTS ior_producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,

  -- Producer identity
  name TEXT NOT NULL,
  legal_name TEXT,
  country TEXT NOT NULL,
  region TEXT,

  -- Contact
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Branding
  logo_url TEXT,
  website_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  onboarded_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ior_producers_unique_name UNIQUE(importer_id, name)
);

-- ior_products: Wine products from producers
CREATE TABLE IF NOT EXISTS ior_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES ior_producers(id) ON DELETE CASCADE,

  -- Product identity
  name TEXT NOT NULL,
  vintage INTEGER,
  sku TEXT,

  -- Wine details
  grape_varieties TEXT[],
  wine_type ior_wine_type,
  appellation TEXT,
  alcohol_pct DECIMAL(4,2),

  -- Packaging
  bottle_size_ml INTEGER DEFAULT 750,
  case_size INTEGER DEFAULT 6,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  tasting_notes TEXT,
  awards JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ior_products_unique UNIQUE(importer_id, producer_id, name, vintage)
);

-- ior_price_lists: Price lists by market for producers
CREATE TABLE IF NOT EXISTS ior_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES ior_producers(id) ON DELETE CASCADE,

  -- Price list metadata
  name TEXT NOT NULL,
  market TEXT NOT NULL,  -- e.g., 'SE', 'NO', 'DK'
  currency TEXT NOT NULL DEFAULT 'SEK',

  -- Status
  status ior_price_list_status DEFAULT 'DRAFT',
  valid_from DATE,
  valid_to DATE,

  -- Audit
  created_by UUID,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ior_price_list_items: Line items in price lists
CREATE TABLE IF NOT EXISTS ior_price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES ior_price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ior_products(id) ON DELETE CASCADE,

  -- Pricing (in smallest currency unit, e.g., öre)
  price_per_bottle_ore INTEGER NOT NULL,
  price_per_case_ore INTEGER,

  -- MOQ
  min_order_qty INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ior_price_list_items_unique UNIQUE(price_list_id, product_id)
);

-- ior_trade_terms: Trade terms per market per producer
CREATE TABLE IF NOT EXISTS ior_trade_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES ior_producers(id) ON DELETE CASCADE,

  -- Market
  market TEXT NOT NULL,  -- 'SE', 'NO', 'DK', etc.

  -- Terms
  payment_terms_days INTEGER DEFAULT 30,
  incoterms TEXT,  -- e.g., 'EXW', 'DDP', 'CIF'
  moq_cases INTEGER,
  lead_time_days INTEGER,

  -- Discounts (JSONB for flexibility)
  volume_discounts JSONB DEFAULT '[]',  -- [{qty: 100, discount_pct: 5}, ...]

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ior_trade_terms_unique UNIQUE(importer_id, producer_id, market)
);

-- ior_communication_cases: Case-based communication with producers
CREATE TABLE IF NOT EXISTS ior_communication_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES ior_producers(id) ON DELETE CASCADE,

  -- Case metadata
  subject TEXT NOT NULL,
  category TEXT,  -- 'pricing', 'logistics', 'quality', 'general'

  -- Status (overdue is computed from due_at, not stored)
  status ior_case_status DEFAULT 'OPEN',
  priority ior_case_priority DEFAULT 'NORMAL',

  -- Due date tracking
  due_at TIMESTAMPTZ,

  -- Audit
  created_by UUID,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ior_case_messages: Messages within communication cases
CREATE TABLE IF NOT EXISTS ior_case_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES ior_communication_cases(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL,
  content_html TEXT,

  -- Direction
  direction TEXT NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),

  -- Sender
  sender_type TEXT NOT NULL CHECK (sender_type IN ('IOR_USER', 'PRODUCER', 'SYSTEM')),
  sender_name TEXT,
  sender_email TEXT,

  -- Template info (if sent from template)
  template_id TEXT,

  -- Email metadata
  email_message_id TEXT,  -- For threading

  -- Attachments (JSONB for flexibility)
  attachments JSONB DEFAULT '[]',  -- [{name, url, size, type}, ...]

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ior_email_threads: Email thread tokens for inbound reply routing
CREATE TABLE IF NOT EXISTS ior_email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES ior_communication_cases(id) ON DELETE CASCADE,
  thread_token TEXT NOT NULL UNIQUE,  -- The [WF:<token>] value
  producer_email TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- ior_audit_log: Audit trail for IOR portfolio operations
CREATE TABLE IF NOT EXISTS ior_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL,

  -- Event
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,  -- 'producer', 'product', 'price_list', 'case', etc.
  entity_id UUID NOT NULL,

  -- Actor
  actor_user_id UUID,
  actor_name TEXT,

  -- Payload (JSONB for flexibility)
  payload JSONB DEFAULT '{}',

  -- Idempotency (for deduplication)
  idempotency_key TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- ior_producers indexes
CREATE INDEX IF NOT EXISTS idx_ior_producers_importer ON ior_producers(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_producers_tenant ON ior_producers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ior_producers_country ON ior_producers(country);
CREATE INDEX IF NOT EXISTS idx_ior_producers_active ON ior_producers(importer_id, is_active);

-- ior_products indexes
CREATE INDEX IF NOT EXISTS idx_ior_products_importer ON ior_products(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_products_producer ON ior_products(producer_id);
CREATE INDEX IF NOT EXISTS idx_ior_products_tenant ON ior_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ior_products_active ON ior_products(importer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ior_products_type ON ior_products(wine_type);

-- ior_price_lists indexes
CREATE INDEX IF NOT EXISTS idx_ior_price_lists_importer ON ior_price_lists(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_price_lists_producer ON ior_price_lists(producer_id);
CREATE INDEX IF NOT EXISTS idx_ior_price_lists_status ON ior_price_lists(status);
CREATE INDEX IF NOT EXISTS idx_ior_price_lists_market ON ior_price_lists(market);

-- ior_price_list_items indexes
CREATE INDEX IF NOT EXISTS idx_ior_price_list_items_list ON ior_price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_ior_price_list_items_product ON ior_price_list_items(product_id);

-- ior_trade_terms indexes
CREATE INDEX IF NOT EXISTS idx_ior_trade_terms_importer ON ior_trade_terms(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_trade_terms_producer ON ior_trade_terms(producer_id);
CREATE INDEX IF NOT EXISTS idx_ior_trade_terms_market ON ior_trade_terms(market);

-- ior_communication_cases indexes
CREATE INDEX IF NOT EXISTS idx_ior_cases_importer ON ior_communication_cases(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_cases_producer ON ior_communication_cases(producer_id);
CREATE INDEX IF NOT EXISTS idx_ior_cases_status ON ior_communication_cases(status);
CREATE INDEX IF NOT EXISTS idx_ior_cases_priority ON ior_communication_cases(priority);
-- Partial index for open cases with due dates (for overdue queries)
CREATE INDEX IF NOT EXISTS idx_ior_cases_due ON ior_communication_cases(due_at)
  WHERE status NOT IN ('RESOLVED', 'CLOSED');

-- ior_case_messages indexes
CREATE INDEX IF NOT EXISTS idx_ior_messages_case ON ior_case_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_ior_messages_created ON ior_case_messages(case_id, created_at);

-- ior_email_threads indexes
CREATE INDEX IF NOT EXISTS idx_ior_email_threads_token ON ior_email_threads(thread_token);
CREATE INDEX IF NOT EXISTS idx_ior_email_threads_case ON ior_email_threads(case_id);

-- ior_audit_log indexes
CREATE INDEX IF NOT EXISTS idx_ior_audit_tenant ON ior_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ior_audit_importer ON ior_audit_log(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_audit_entity ON ior_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ior_audit_event ON ior_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_ior_audit_created ON ior_audit_log(created_at DESC);

-- Unique partial index for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_ior_audit_idempotency
  ON ior_audit_log(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on ior_producers
CREATE OR REPLACE FUNCTION ior_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER ior_producers_updated_at
    BEFORE UPDATE ON ior_producers
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_products_updated_at
    BEFORE UPDATE ON ior_products
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_price_lists_updated_at
    BEFORE UPDATE ON ior_price_lists
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_price_list_items_updated_at
    BEFORE UPDATE ON ior_price_list_items
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_trade_terms_updated_at
    BEFORE UPDATE ON ior_trade_terms
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_cases_updated_at
    BEFORE UPDATE ON ior_communication_cases
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ior_producers IS 'Wine producers managed by an IOR (Importer of Record)';
COMMENT ON TABLE ior_products IS 'Wine products from IOR-managed producers';
COMMENT ON TABLE ior_price_lists IS 'Price lists by market for IOR producers';
COMMENT ON TABLE ior_price_list_items IS 'Line items in IOR price lists';
COMMENT ON TABLE ior_trade_terms IS 'Trade terms per market for IOR-producer relationships';
COMMENT ON TABLE ior_communication_cases IS 'Communication cases between IOR and producers';
COMMENT ON TABLE ior_case_messages IS 'Messages within IOR communication cases';
COMMENT ON TABLE ior_email_threads IS 'Email thread tokens for inbound reply routing';
COMMENT ON TABLE ior_audit_log IS 'Audit trail for IOR portfolio operations';


-- ============================================================================
-- SECTION: 20260205_ior_rls_policies.sql
-- ============================================================================

-- IOR Portfolio RLS Policies
-- Enable row-level security for all IOR tables with importer-based tenant isolation

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE ior_producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_trade_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_communication_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICE ROLE FULL ACCESS (for API routes using service_role key)
-- ============================================================================

CREATE POLICY "Service role full access on ior_producers"
  ON ior_producers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_products"
  ON ior_products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_price_lists"
  ON ior_price_lists FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_price_list_items"
  ON ior_price_list_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_trade_terms"
  ON ior_trade_terms FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_communication_cases"
  ON ior_communication_cases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_case_messages"
  ON ior_case_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_email_threads"
  ON ior_email_threads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_audit_log"
  ON ior_audit_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- IOR USER ACCESS (via auth_entity_id helper function)
-- Users can only access data for their own importer
-- ============================================================================

-- ior_producers: IOR users can manage their own producers
CREATE POLICY "IOR users manage own producers"
  ON ior_producers FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_products: IOR users can manage their own products
CREATE POLICY "IOR users manage own products"
  ON ior_products FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_price_lists: IOR users can manage their own price lists
CREATE POLICY "IOR users manage own price lists"
  ON ior_price_lists FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_price_list_items: IOR users can manage items in their price lists
CREATE POLICY "IOR users manage own price list items"
  ON ior_price_list_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_price_lists pl
      WHERE pl.id = ior_price_list_items.price_list_id
      AND pl.importer_id = auth_entity_id('IOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ior_price_lists pl
      WHERE pl.id = ior_price_list_items.price_list_id
      AND pl.importer_id = auth_entity_id('IOR')
    )
  );

-- ior_trade_terms: IOR users can manage their own trade terms
CREATE POLICY "IOR users manage own trade terms"
  ON ior_trade_terms FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_communication_cases: IOR users can manage their own cases
CREATE POLICY "IOR users manage own cases"
  ON ior_communication_cases FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_case_messages: IOR users can manage messages in their cases
CREATE POLICY "IOR users manage own case messages"
  ON ior_case_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c
      WHERE c.id = ior_case_messages.case_id
      AND c.importer_id = auth_entity_id('IOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c
      WHERE c.id = ior_case_messages.case_id
      AND c.importer_id = auth_entity_id('IOR')
    )
  );

-- ior_email_threads: IOR users can manage threads in their cases
CREATE POLICY "IOR users manage own email threads"
  ON ior_email_threads FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c
      WHERE c.id = ior_email_threads.case_id
      AND c.importer_id = auth_entity_id('IOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c
      WHERE c.id = ior_email_threads.case_id
      AND c.importer_id = auth_entity_id('IOR')
    )
  );

-- ior_audit_log: IOR users can only read their own audit log (no write)
CREATE POLICY "IOR users read own audit log"
  ON ior_audit_log FOR SELECT
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'));

-- ============================================================================
-- ADMIN ACCESS (admins can access all IOR data for support/debugging)
-- ============================================================================

CREATE POLICY "Admins read all ior_producers"
  ON ior_producers FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_products"
  ON ior_products FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_price_lists"
  ON ior_price_lists FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_price_list_items"
  ON ior_price_list_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_price_lists pl WHERE pl.id = ior_price_list_items.price_list_id
    )
    AND auth_has_role('ADMIN')
  );

CREATE POLICY "Admins read all ior_trade_terms"
  ON ior_trade_terms FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_communication_cases"
  ON ior_communication_cases FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_case_messages"
  ON ior_case_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c WHERE c.id = ior_case_messages.case_id
    )
    AND auth_has_role('ADMIN')
  );

CREATE POLICY "Admins read all ior_email_threads"
  ON ior_email_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c WHERE c.id = ior_email_threads.case_id
    )
    AND auth_has_role('ADMIN')
  );

CREATE POLICY "Admins read all ior_audit_log"
  ON ior_audit_log FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));


-- ============================================================================
-- SECTION: 20260208_offer_email_tracking.sql
-- ============================================================================

-- Offer Email Tracking for Pilot
-- Adds columns for idempotent email sending (decline + pending reminders)

-- Add declined_email_sent_at column
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS declined_email_sent_at TIMESTAMPTZ;

-- Add reminder_sent_at column for pending offer reminders
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Index for efficient reminder queries (find offers pending > 48h without reminder)
CREATE INDEX IF NOT EXISTS idx_offers_pending_reminder
ON offers (created_at, status, reminder_sent_at)
WHERE status IN ('SENT', 'VIEWED') AND reminder_sent_at IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- SECTION: 20260208_restaurant_billing_fields.sql
-- ============================================================================

-- Add billing fields to restaurants table
-- These fields allow restaurants to specify separate billing contact and address

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS billing_contact_person text,
ADD COLUMN IF NOT EXISTS billing_contact_phone text,
ADD COLUMN IF NOT EXISTS billing_address text,
ADD COLUMN IF NOT EXISTS billing_postal_code text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS billing_reference text;

-- Add comments for documentation
COMMENT ON COLUMN restaurants.billing_email IS 'Email address for invoices (if different from main email)';
COMMENT ON COLUMN restaurants.billing_contact_person IS 'Contact person for billing/finance questions';
COMMENT ON COLUMN restaurants.billing_contact_phone IS 'Phone number for billing contact';
COMMENT ON COLUMN restaurants.billing_address IS 'Billing address if different from restaurant address';
COMMENT ON COLUMN restaurants.billing_postal_code IS 'Billing postal code';
COMMENT ON COLUMN restaurants.billing_city IS 'Billing city';
COMMENT ON COLUMN restaurants.billing_reference IS 'Customer reference/PO number to show on invoices';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- SECTION: Brasri Pilot Setup
-- ============================================================================

-- 1. Create Winefeed tenant
INSERT INTO tenants (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Winefeed')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Brasri as importer FIRST (needed for supplier FK constraint)
INSERT INTO importers (id, tenant_id, legal_name, org_number, contact_name, contact_email, contact_phone, is_active)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'Brasri AB',
  '556785-0655',
  'Corentin',
  'corentin@brasri.com',
  '',
  true
);

-- 3. Create Brasri as supplier WITH importer link (EU_IMPORTER requires default_importer_id)
INSERT INTO suppliers (id, namn, kontakt_email, type, org_number, is_active, default_importer_id)
VALUES (
  gen_random_uuid(),
  'Brasri AB',
  'corentin@brasri.com',
  'EU_IMPORTER',
  '556785-0655',
  true,
  (SELECT id FROM importers WHERE org_number = '556785-0655' LIMIT 1)
);

-- ============================================================================
-- MANUAL STEPS (run after creating user in Supabase Auth Dashboard)
-- ============================================================================
-- 4. Create user: corentin@brasri.com in Auth Dashboard
--    https://supabase.com/dashboard/project/itpknmhvbdhiprssjwtq/auth/users
--
-- 5. Link auth user to supplier:
-- INSERT INTO supplier_users (id, supplier_id, role)
-- VALUES ('<auth_user_id>', (SELECT id FROM suppliers WHERE org_number = '556785-0655'), 'admin');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
