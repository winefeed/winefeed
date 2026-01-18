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
