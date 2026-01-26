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
