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
  created_by_user_id UUID NOT NULL REFERENCES users(id),
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
  changed_by_user_id UUID NOT NULL REFERENCES users(id),
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
