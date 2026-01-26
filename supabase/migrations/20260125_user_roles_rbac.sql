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
