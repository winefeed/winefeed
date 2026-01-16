/**
 * INVITES TABLE - PILOT ONBOARDING 1.0
 *
 * Purpose: Enable admin to invite restaurant and supplier users via email
 *
 * Flow:
 * 1. Admin creates invite with email + role + entity reference
 * 2. System sends email with secure token link
 * 3. Recipient accepts invite, creates account
 * 4. Account is linked to restaurant or supplier_users
 *
 * Security:
 * - Token stored as hash (never plaintext)
 * - Expiry after 7 days
 * - Single use (used_at timestamp)
 * - Admin-only access via RLS
 */

-- ============================================================================
-- STEP 1: Create invite_role enum
-- ============================================================================

CREATE TYPE invite_role AS ENUM ('RESTAURANT', 'SUPPLIER');

-- ============================================================================
-- STEP 2: Create invites table
-- ============================================================================

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Recipient info
  email TEXT NOT NULL,
  role invite_role NOT NULL,

  -- Entity references (role-dependent)
  restaurant_id UUID NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Token security
  token_hash TEXT NOT NULL UNIQUE,

  -- Lifecycle
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ NULL,
  used_by_user_id UUID NULL,  -- References auth.users.id

  -- Audit
  created_by_user_id UUID NULL,  -- References auth.users.id
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_restaurant_invite CHECK (
    (role = 'RESTAURANT' AND restaurant_id IS NOT NULL AND supplier_id IS NULL) OR
    (role = 'SUPPLIER' AND supplier_id IS NOT NULL AND restaurant_id IS NULL)
  ),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ============================================================================
-- STEP 3: Indexes for performance
-- ============================================================================

CREATE INDEX idx_invites_tenant_email ON invites(tenant_id, email);
CREATE INDEX idx_invites_tenant_created ON invites(tenant_id, created_at DESC);
CREATE INDEX idx_invites_token_hash ON invites(token_hash);
CREATE INDEX idx_invites_restaurant ON invites(restaurant_id) WHERE restaurant_id IS NOT NULL;
CREATE INDEX idx_invites_supplier ON invites(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_invites_expires_at ON invites(expires_at) WHERE used_at IS NULL;

-- ============================================================================
-- STEP 4: Create restaurant_users table (missing from schema)
-- ============================================================================

-- Note: restaurants table already references auth.users directly (1-to-1)
-- But for consistency with supplier_users, we create restaurant_users junction table
-- This allows multiple users per restaurant (future-proofing)

CREATE TABLE IF NOT EXISTS restaurant_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast restaurant lookup
CREATE INDEX idx_restaurant_users_restaurant ON restaurant_users(restaurant_id);
CREATE INDEX idx_restaurant_users_active ON restaurant_users(is_active);

-- ============================================================================
-- STEP 5: Helper function to update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_restaurant_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restaurant_users_updated_at
  BEFORE UPDATE ON restaurant_users
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_users_updated_at();

-- ============================================================================
-- STEP 6: Modify existing restaurant trigger to create restaurant_users entry
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate with restaurant_users support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle restaurant users
  IF NEW.raw_user_meta_data->>'user_type' = 'restaurant' THEN
    -- Create restaurants record
    INSERT INTO public.restaurants (id, name, contact_email, tenant_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Ny restaurang'),
      NEW.email,
      COALESCE((NEW.raw_user_meta_data->>'tenant_id')::UUID, '00000000-0000-0000-0000-000000000001'::UUID)
    );

    -- Create restaurant_users junction record
    INSERT INTO public.restaurant_users (id, restaurant_id, role)
    VALUES (
      NEW.id,
      NEW.id,  -- restaurant_id = user_id for primary user
      COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'user_type' IN ('restaurant', 'supplier'))
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 7: Comments
-- ============================================================================

COMMENT ON TABLE invites IS 'Email invitations for restaurant and supplier user onboarding';
COMMENT ON COLUMN invites.token_hash IS 'SHA-256 hash of secure random token (never store plaintext)';
COMMENT ON COLUMN invites.expires_at IS 'Token expiry (default 7 days from creation)';
COMMENT ON COLUMN invites.used_at IS 'Timestamp when invite was accepted (NULL = pending)';
COMMENT ON TABLE restaurant_users IS 'Junction table for restaurant multi-user access (future-proof)';
