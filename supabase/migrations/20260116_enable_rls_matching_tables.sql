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
