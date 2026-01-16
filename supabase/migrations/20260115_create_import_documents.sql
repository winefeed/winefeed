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
