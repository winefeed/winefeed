-- PART 6 — Continue from: -- SECTION: 20260125_hardening_audit_dedupe.sql

-- SECTION: 20260125_hardening_audit_dedupe.sql
-- ============================================================================

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

-- SKIPPED: offer_events has no from_status/to_status columns
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_events_dedupe
--   ON offer_events (offer_id, event_type, from_status, to_status, date_trunc('minute', created_at))
--   WHERE idempotency_key IS NULL;

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


-- ============================================================================
-- SECTION: 20260125_hardening_ior_review.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260125_request_events_and_status.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260125_restaurant_delivery_addresses.sql
-- ============================================================================

/**
 * RESTAURANT DELIVERY ADDRESSES
 *
 * Allows restaurants to save multiple delivery addresses
 * and select from them when creating requests.
 */

-- Create delivery addresses table
CREATE TABLE IF NOT EXISTS restaurant_delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  -- Address details
  label TEXT NOT NULL,  -- User-friendly name, e.g. "Huvudrestaurang", "Eventlokal"
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'SE',

  -- Contact for this address
  contact_name TEXT,
  contact_phone TEXT,

  -- Delivery instructions
  delivery_instructions TEXT,

  -- Settings
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_delivery_addresses_tenant ON restaurant_delivery_addresses(tenant_id);
CREATE INDEX idx_delivery_addresses_restaurant ON restaurant_delivery_addresses(restaurant_id);
CREATE INDEX idx_delivery_addresses_active ON restaurant_delivery_addresses(restaurant_id, is_active);

-- Comments
COMMENT ON TABLE restaurant_delivery_addresses IS 'Saved delivery addresses for restaurants';
COMMENT ON COLUMN restaurant_delivery_addresses.label IS 'User-friendly name for this address';
COMMENT ON COLUMN restaurant_delivery_addresses.is_default IS 'If true, this address is pre-selected when creating new requests';

-- Enable RLS
ALTER TABLE restaurant_delivery_addresses ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON restaurant_delivery_addresses
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation
CREATE POLICY "Tenant isolation" ON restaurant_delivery_addresses
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Function to ensure only one default address per restaurant
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE restaurant_delivery_addresses
    SET is_default = FALSE
    WHERE restaurant_id = NEW.restaurant_id
      AND id != NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single default
CREATE TRIGGER tr_ensure_single_default_address
  AFTER INSERT OR UPDATE OF is_default ON restaurant_delivery_addresses
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION ensure_single_default_address();

-- Auto-update updated_at
CREATE TRIGGER tr_delivery_addresses_updated_at
  BEFORE UPDATE ON restaurant_delivery_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION: 20260125_restaurant_onboarding_fields.sql
-- ============================================================================

-- ============================================================================
-- RESTAURANT ONBOARDING FIELDS
--
-- Adds fields for restaurant onboarding:
-- - Address fields (from org number lookup or manual input)
-- - License/permit fields (serveringstillstånd) for compliance
-- - Onboarding status tracking
-- ============================================================================

-- Add address fields to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add license fields (serveringstillstånd)
-- These are collected in step 2 (when placing first order)
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS license_municipality TEXT,      -- Utfärdande kommun
ADD COLUMN IF NOT EXISTS license_case_number TEXT,       -- Diarienummer
ADD COLUMN IF NOT EXISTS license_decision_date DATE,     -- Beslutsdatum
ADD COLUMN IF NOT EXISTS license_valid_from DATE,        -- Giltig från
ADD COLUMN IF NOT EXISTS license_valid_until DATE,       -- Giltig till
ADD COLUMN IF NOT EXISTS license_category TEXT;          -- Kategorikod

-- Add onboarding tracking
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_verified_at TIMESTAMPTZ;

-- Note: org_number already exists (added via earlier fix script)

-- Add index for city (used for prefilling delivery location)
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);

-- Add comment
COMMENT ON COLUMN restaurants.city IS 'City for prefilling delivery location in requests';
COMMENT ON COLUMN restaurants.license_municipality IS 'Municipality that issued the alcohol license (serveringstillstånd)';
COMMENT ON COLUMN restaurants.license_case_number IS 'Case number (diarienummer) for traceability';
COMMENT ON COLUMN restaurants.license_valid_until IS 'License expiry date - must be current for orders';


-- ============================================================================
-- SECTION: 20260125_user_roles_rbac.sql
-- ============================================================================

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
-- (restaurant_users has no tenant_id, get it from restaurants)
SELECT
  r.tenant_id,
  ru.id AS user_id,
  'RESTAURANT' AS role,
  'restaurant' AS entity_type,
  ru.restaurant_id AS entity_id,
  'restaurant_users' AS source
FROM restaurant_users ru
JOIN restaurants r ON ru.restaurant_id = r.id

UNION ALL

-- Implicit SELLER role from supplier_users
-- (supplier_users has no tenant_id, use single-tenant constant)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid AS tenant_id,
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


-- ============================================================================
-- SECTION: 20260125_wine_catalog_status.sql
-- ============================================================================

/**
 * MIGRATION: Wine Catalog Status Enhancement
 *
 * Pilot Loop 2.0 - Supplier Catalog UX
 *
 * Adds:
 * - status column with ACTIVE, TEMPORARILY_UNAVAILABLE, END_OF_VINTAGE
 * - Replaces simple is_active boolean with richer status
 */

-- ============================================================================
-- ADD STATUS ENUM
-- ============================================================================

CREATE TYPE wine_availability_status AS ENUM (
  'ACTIVE',                    -- Available for sale
  'TEMPORARILY_UNAVAILABLE',   -- Out of stock but will return
  'END_OF_VINTAGE'             -- This vintage is finished, won't return
);

COMMENT ON TYPE wine_availability_status IS 'Wine availability status for supplier catalog';

-- ============================================================================
-- ADD STATUS COLUMN TO SUPPLIER_WINES
-- ============================================================================

ALTER TABLE supplier_wines
ADD COLUMN status wine_availability_status NOT NULL DEFAULT 'ACTIVE';

-- Migrate existing data: is_active=false -> TEMPORARILY_UNAVAILABLE
UPDATE supplier_wines
SET status = 'TEMPORARILY_UNAVAILABLE'
WHERE is_active = FALSE;

-- Add index for status filtering
CREATE INDEX idx_supplier_wines_status ON supplier_wines(supplier_id, status);

COMMENT ON COLUMN supplier_wines.status IS 'Wine availability: ACTIVE, TEMPORARILY_UNAVAILABLE, END_OF_VINTAGE';

-- ============================================================================
-- KEEP is_active AS COMPUTED (for backwards compatibility)
-- ============================================================================

-- Create a trigger to sync is_active with status
CREATE OR REPLACE FUNCTION sync_wine_is_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_active = (NEW.status = 'ACTIVE');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_wine_is_active
  BEFORE INSERT OR UPDATE OF status ON supplier_wines
  FOR EACH ROW
  EXECUTE FUNCTION sync_wine_is_active();

-- ============================================================================
-- ADD updated_at TRIGGER (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_supplier_wines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to avoid error
DROP TRIGGER IF EXISTS trigger_supplier_wines_updated_at ON supplier_wines;

CREATE TRIGGER trigger_supplier_wines_updated_at
  BEFORE UPDATE ON supplier_wines
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_wines_updated_at();


-- ============================================================================
-- SECTION: 20260126_sponsored_slots.sql
-- ============================================================================

-- ============================================
-- SPONSORED SLOTS - Database Schema
-- ============================================
-- Allows suppliers to purchase sponsored placements
-- in wine categories with limited inventory (caps)
-- ============================================

-- 1. Sponsored Categories
-- Categories where suppliers can buy sponsored slots
CREATE TABLE IF NOT EXISTS sponsored_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Category info
  name TEXT NOT NULL,                    -- e.g., "Burgundy", "Champagne", "Natural Wine"
  slug TEXT NOT NULL,                    -- URL-friendly: "burgundy", "champagne"
  description TEXT,                      -- Optional description

  -- Sponsor cap (limited inventory)
  sponsor_cap INTEGER NOT NULL DEFAULT 3,  -- Max sponsors per category

  -- Pricing (Stripe price IDs)
  stripe_price_id_monthly TEXT,          -- Monthly subscription price
  stripe_price_id_yearly TEXT,           -- Yearly subscription price (discounted)
  price_monthly_sek INTEGER DEFAULT 0,   -- Display price in SEK
  price_yearly_sek INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(tenant_id, slug)
);

-- Index for lookups
CREATE INDEX idx_sponsored_categories_tenant ON sponsored_categories(tenant_id);
CREATE INDEX idx_sponsored_categories_slug ON sponsored_categories(tenant_id, slug);
CREATE INDEX idx_sponsored_categories_active ON sponsored_categories(tenant_id, is_active);


-- 2. Sponsored Slots
-- Tracks which suppliers have slots in which categories
CREATE TABLE IF NOT EXISTS sponsored_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Slot assignment
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES sponsored_categories(id) ON DELETE CASCADE,

  -- Slot type
  slot_type TEXT NOT NULL DEFAULT 'PURCHASED',  -- 'INCLUDED' (from tier) or 'PURCHASED' (add-on)

  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, EXPIRED, CANCELLED

  -- Stripe subscription (for purchased slots)
  stripe_subscription_id TEXT,            -- Links to Stripe subscription
  stripe_subscription_item_id TEXT,       -- Specific line item in subscription

  -- Validity period
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,                 -- NULL = no expiry (until cancelled)

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(tenant_id, supplier_id, category_id)  -- One slot per supplier per category
);

-- Indexes
CREATE INDEX idx_sponsored_slots_tenant ON sponsored_slots(tenant_id);
CREATE INDEX idx_sponsored_slots_supplier ON sponsored_slots(supplier_id);
CREATE INDEX idx_sponsored_slots_category ON sponsored_slots(category_id);
CREATE INDEX idx_sponsored_slots_status ON sponsored_slots(status);
CREATE INDEX idx_sponsored_slots_stripe ON sponsored_slots(stripe_subscription_id);


-- 3. Supplier Entitlements
-- Tracks how many sponsored slots each supplier can use
CREATE TABLE IF NOT EXISTS supplier_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Included slots (from subscription tier)
  included_slots INTEGER NOT NULL DEFAULT 0,   -- Premium tier gets 1

  -- Purchased add-on slots
  purchased_slots INTEGER NOT NULL DEFAULT 0,  -- Extra slots bought as add-ons

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(tenant_id, supplier_id)
);

-- Indexes
CREATE INDEX idx_supplier_entitlements_tenant ON supplier_entitlements(tenant_id);
CREATE INDEX idx_supplier_entitlements_supplier ON supplier_entitlements(supplier_id);


-- 4. Sponsored Slot Events (Audit log)
CREATE TABLE IF NOT EXISTS sponsored_slot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- References
  slot_id UUID REFERENCES sponsored_slots(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES sponsored_categories(id) ON DELETE SET NULL,

  -- Event info
  event_type TEXT NOT NULL,  -- SLOT_ASSIGNED, SLOT_EXPIRED, SLOT_CANCELLED, ENTITLEMENT_UPDATED
  actor_user_id UUID,        -- Who triggered it (NULL for system)
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsored_slot_events_tenant ON sponsored_slot_events(tenant_id);
CREATE INDEX idx_sponsored_slot_events_supplier ON sponsored_slot_events(supplier_id);
CREATE INDEX idx_sponsored_slot_events_slot ON sponsored_slot_events(slot_id);


-- 5. Add included_sponsored_slots to tier_limits
-- Premium tier gets 1 included slot
ALTER TABLE tier_limits
  ADD COLUMN IF NOT EXISTS included_sponsored_slots INTEGER NOT NULL DEFAULT 0;

-- Update tier limits: Premium gets 1 included sponsored slot
UPDATE tier_limits SET included_sponsored_slots = 0 WHERE tier = 'free';
UPDATE tier_limits SET included_sponsored_slots = 0 WHERE tier = 'pro';
UPDATE tier_limits SET included_sponsored_slots = 1 WHERE tier = 'premium';


-- 6. Helper function: Count active slots in a category
CREATE OR REPLACE FUNCTION count_active_slots_in_category(p_category_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM sponsored_slots
  WHERE category_id = p_category_id
    AND status = 'ACTIVE'
    AND (expires_at IS NULL OR expires_at > now());
$$ LANGUAGE SQL STABLE;


-- 7. Helper function: Check if category has available slots
CREATE OR REPLACE FUNCTION category_has_available_slots(p_category_id UUID)
RETURNS BOOLEAN AS $$
  SELECT count_active_slots_in_category(p_category_id) <
         (SELECT sponsor_cap FROM sponsored_categories WHERE id = p_category_id);
$$ LANGUAGE SQL STABLE;


-- 8. Helper function: Get supplier's remaining slot allowance
CREATE OR REPLACE FUNCTION get_supplier_remaining_slots(p_supplier_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_entitlement INTEGER;
  v_used_slots INTEGER;
BEGIN
  -- Get total entitlement (included + purchased)
  SELECT COALESCE(included_slots, 0) + COALESCE(purchased_slots, 0)
  INTO v_total_entitlement
  FROM supplier_entitlements
  WHERE supplier_id = p_supplier_id;

  IF v_total_entitlement IS NULL THEN
    v_total_entitlement := 0;
  END IF;

  -- Count active slots
  SELECT COUNT(*)
  INTO v_used_slots
  FROM sponsored_slots
  WHERE supplier_id = p_supplier_id
    AND status = 'ACTIVE'
    AND (expires_at IS NULL OR expires_at > now());

  RETURN v_total_entitlement - v_used_slots;
END;
$$ LANGUAGE plpgsql STABLE;


-- 9. RLS Policies
ALTER TABLE sponsored_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsored_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsored_slot_events ENABLE ROW LEVEL SECURITY;

-- Sponsored categories: Anyone can read, only admin can write
CREATE POLICY "sponsored_categories_read" ON sponsored_categories
  FOR SELECT USING (true);

CREATE POLICY "sponsored_categories_admin" ON sponsored_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND tenant_id = sponsored_categories.tenant_id
    )
  );

-- Sponsored slots: Suppliers can read their own, admin can read all
CREATE POLICY "sponsored_slots_supplier_read" ON sponsored_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM supplier_users
      WHERE id = auth.uid() AND supplier_id = sponsored_slots.supplier_id
    )
  );

CREATE POLICY "sponsored_slots_admin" ON sponsored_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND tenant_id = sponsored_slots.tenant_id
    )
  );

-- Supplier entitlements: Suppliers can read their own
CREATE POLICY "supplier_entitlements_read" ON supplier_entitlements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM supplier_users
      WHERE id = auth.uid() AND supplier_id = supplier_entitlements.supplier_id
    )
  );

-- Slot events: Suppliers can read their own events
CREATE POLICY "sponsored_slot_events_read" ON sponsored_slot_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM supplier_users
      WHERE id = auth.uid() AND supplier_id = sponsored_slot_events.supplier_id
    )
  );


-- 10. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_sponsored_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sponsored_categories_updated_at
  BEFORE UPDATE ON sponsored_categories
  FOR EACH ROW EXECUTE FUNCTION update_sponsored_updated_at();

CREATE TRIGGER sponsored_slots_updated_at
  BEFORE UPDATE ON sponsored_slots
  FOR EACH ROW EXECUTE FUNCTION update_sponsored_updated_at();

CREATE TRIGGER supplier_entitlements_updated_at
  BEFORE UPDATE ON supplier_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_sponsored_updated_at();


-- ============================================
-- SEED DATA: Initial sponsored categories
-- ============================================
-- Note: Run this after setting up a tenant

-- INSERT INTO sponsored_categories (tenant_id, name, slug, sponsor_cap, price_monthly_sek, price_yearly_sek)
-- SELECT
--   id,
--   'Burgundy',
--   'burgundy',
--   3,
--   1500,
--   15000
-- FROM tenants LIMIT 1;


-- ============================================================================
-- END OF PART 6
