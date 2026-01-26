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
SELECT
  tenant_id,
  user_id,
  'RESTAURANT' AS role,
  'restaurant' AS entity_type,
  restaurant_id AS entity_id,
  'restaurant_users' AS source
FROM restaurant_users

UNION ALL

-- Implicit SELLER role from supplier_users
SELECT
  su.tenant_id,
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

-- offer_events: prevent duplicate status changes within same minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_events_dedupe
  ON offer_events (
    offer_id,
    event_type,
    from_status,
    to_status,
    date_trunc('minute', created_at)
  )
  WHERE idempotency_key IS NULL;

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
