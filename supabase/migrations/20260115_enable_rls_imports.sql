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
      AND imports.tenant_id = supplier_imports.tenant_id
    )
  );
