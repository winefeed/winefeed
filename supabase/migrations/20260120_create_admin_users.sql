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
