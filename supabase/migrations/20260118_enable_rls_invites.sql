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
