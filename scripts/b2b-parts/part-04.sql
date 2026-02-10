-- PART 4 — Continue from: -- SECTION: 20260117_add_tenant_id_to_restaurants.sql

-- SECTION: 20260117_add_tenant_id_to_restaurants.sql
-- ============================================================================

/**
 * ADD TENANT_ID TO RESTAURANTS - ROBUST TENANT SCOPING
 *
 * Purpose: Enable proper tenant scoping for requests via restaurants
 * Flow: requests → restaurants → tenant_id (instead of indirect via offers)
 *
 * Changes:
 * 1. Add tenant_id column to restaurants
 * 2. Create index for performance
 * 3. Set default tenant for existing restaurants (MVP single-tenant)
 *
 * Security:
 * - Enables robust tenant scoping: requests JOIN restaurants WHERE tenant_id = X
 * - No dependency on offers for request visibility
 * - Prevents cross-tenant request leakage
 */

-- Step 1: Add tenant_id column to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- Step 2: Create index for efficient tenant filtering
CREATE INDEX IF NOT EXISTS idx_restaurants_tenant ON restaurants(tenant_id);

-- Step 3: Add comment
COMMENT ON COLUMN restaurants.tenant_id IS 'Tenant isolation for multi-tenant platform - enables secure request scoping';

-- Step 4: Future: Remove default after data migration
-- After all restaurants have proper tenant_id assigned:
-- ALTER TABLE restaurants ALTER COLUMN tenant_id DROP DEFAULT;


-- ============================================================================
-- SECTION: 20260117_create_offers.sql
-- ============================================================================

/**
 * OFFERS TABLE - PILOT LOOP 1.0
 *
 * Multi-line offers from suppliers to restaurants
 * Immutable after acceptance (snapshot + lock)
 *
 * Status workflow:
 * - DRAFT: Editable by creator
 * - SENT: Sent to restaurant, still editable by supplier
 * - ACCEPTED: Locked, immutable snapshot saved
 * - REJECTED: Rejected by restaurant
 */

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core relationships
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  request_id UUID NULL REFERENCES requests(id) ON DELETE SET NULL,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Offer metadata
  title TEXT NULL,
  currency TEXT NOT NULL DEFAULT 'SEK',

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),

  -- Lock timestamps (immutable after acceptance)
  accepted_at TIMESTAMPTZ NULL,
  locked_at TIMESTAMPTZ NULL,

  -- Snapshot (saved at accept time for historical integrity)
  snapshot JSONB NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_offers_tenant_restaurant ON offers(tenant_id, restaurant_id);
CREATE INDEX idx_offers_tenant_request ON offers(tenant_id, request_id);
CREATE INDEX idx_offers_tenant_status ON offers(tenant_id, status);
CREATE INDEX idx_offers_tenant_created ON offers(tenant_id, created_at DESC);
CREATE INDEX idx_offers_restaurant ON offers(restaurant_id);
CREATE INDEX idx_offers_supplier ON offers(supplier_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION update_offers_updated_at();

COMMENT ON TABLE offers IS 'Multi-line offers (DRAFT/SENT/ACCEPTED/REJECTED) with immutable snapshot at accept';
COMMENT ON COLUMN offers.snapshot IS 'Immutable snapshot saved at acceptance (offer + lines) for historical integrity';
COMMENT ON COLUMN offers.locked_at IS 'Timestamp when offer became immutable (acceptance)';


-- ============================================================================
-- SECTION: 20260117_create_offer_lines.sql
-- ============================================================================

/**
 * OFFER LINES TABLE - PILOT LOOP 1.0
 *
 * Line items for multi-line offers
 * Each line can be enriched via Wine Check (allowlist fields only)
 *
 * Security: NO PRICE DATA from Wine-Searcher
 * Enrichment allowlist: canonical_name, producer, country, region, appellation, ws_id, match_status, match_score
 * Commercial pricing: offered_unit_price_ore (from supplier, not Wine-Searcher)
 */

CREATE TABLE IF NOT EXISTS offer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

  -- Line ordering
  line_no INTEGER NOT NULL,

  -- Core wine data (user input)
  name TEXT NOT NULL,
  vintage INTEGER NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  bottle_ml INTEGER NULL,
  packaging TEXT NULL,

  -- Commercial pricing (supplier sets this, NOT from Wine-Searcher)
  offered_unit_price_ore INTEGER NULL,  -- Price in öre (100 = 1 SEK), ex VAT

  -- Wine Check enrichment (allowlist only - NO PRICE DATA)
  canonical_name TEXT NULL,
  producer TEXT NULL,
  country TEXT NULL,
  region TEXT NULL,
  appellation TEXT NULL,
  ws_id TEXT NULL,
  match_status TEXT NULL,  -- From Wine Check (e.g., "verified", "suggested")
  match_score INTEGER NULL,  -- 0-100 confidence score

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_offer_line UNIQUE (offer_id, line_no),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_price CHECK (offered_unit_price_ore IS NULL OR offered_unit_price_ore >= 0)
);

-- Indexes for performance
CREATE INDEX idx_offer_lines_tenant_offer ON offer_lines(tenant_id, offer_id);
CREATE INDEX idx_offer_lines_tenant_ws_id ON offer_lines(tenant_id, ws_id);
CREATE INDEX idx_offer_lines_offer ON offer_lines(offer_id);
CREATE INDEX idx_offer_lines_offer_lineno ON offer_lines(offer_id, line_no);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_offer_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_offer_lines_updated_at
  BEFORE UPDATE ON offer_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_lines_updated_at();

COMMENT ON TABLE offer_lines IS 'Line items for multi-line offers with Wine Check enrichment (allowlist only)';
COMMENT ON COLUMN offer_lines.offered_unit_price_ore IS 'Supplier commercial price in öre (NOT from Wine-Searcher)';
COMMENT ON COLUMN offer_lines.canonical_name IS 'Wine Check enrichment: canonical wine name';
COMMENT ON COLUMN offer_lines.match_status IS 'Wine Check match status (verified/suggested)';
COMMENT ON COLUMN offer_lines.match_score IS 'Wine Check confidence score (0-100)';


-- ============================================================================
-- SECTION: 20260117_create_offer_events.sql
-- ============================================================================

/**
 * OFFER EVENTS TABLE - AUDIT TRAIL
 *
 * Tracks all state changes and actions on offers
 * Provides full auditability for pilot loop
 *
 * Event types:
 * - CREATED: Offer created
 * - UPDATED: Offer metadata updated
 * - LINE_ADDED: Line item added
 * - LINE_UPDATED: Line item modified
 * - LINE_DELETED: Line item removed
 * - SENT: Offer sent to restaurant
 * - ACCEPTED: Offer accepted by restaurant
 * - REJECTED: Offer rejected by restaurant
 */

CREATE TABLE IF NOT EXISTS offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

  -- Event metadata
  event_type TEXT NOT NULL CHECK (event_type IN (
    'CREATED',
    'UPDATED',
    'LINE_ADDED',
    'LINE_UPDATED',
    'LINE_DELETED',
    'SENT',
    'ACCEPTED',
    'REJECTED'
  )),

  -- Actor (user who performed action)
  actor_user_id UUID NULL,  -- From auth.users

  -- Optional payload (diff, metadata, notes)
  payload JSONB NULL,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_offer_events_tenant_offer_created ON offer_events(tenant_id, offer_id, created_at DESC);
CREATE INDEX idx_offer_events_offer_created ON offer_events(offer_id, created_at DESC);
CREATE INDEX idx_offer_events_tenant_event_type ON offer_events(tenant_id, event_type);
CREATE INDEX idx_offer_events_actor ON offer_events(actor_user_id);

COMMENT ON TABLE offer_events IS 'Audit trail for all offer state changes and actions';
COMMENT ON COLUMN offer_events.event_type IS 'Type of event: CREATED, UPDATED, LINE_ADDED, LINE_UPDATED, LINE_DELETED, SENT, ACCEPTED, REJECTED';
COMMENT ON COLUMN offer_events.actor_user_id IS 'User who performed the action (from auth.users)';
COMMENT ON COLUMN offer_events.payload IS 'Optional event details (diff, metadata, notes)';


-- ============================================================================
-- SECTION: 20260117_enable_rls_offers.sql
-- ============================================================================

/**
 * RLS POLICIES FOR OFFERS - PILOT LOOP 1.0
 *
 * Multi-tenant security for offers, offer_lines, offer_events
 *
 * MVP policies (can be refined later):
 * - Service role: Full access (API routes use service role)
 * - Tenant isolation: Users can only access offers in their tenant
 * - Restaurant users: Read offers where restaurant_id matches
 * - Supplier users: Read/write offers where supplier_id matches
 */

-- ============================================================================
-- OFFERS TABLE
-- ============================================================================

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offers"
  ON offers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offers"
  ON offers FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- OFFER_LINES TABLE
-- ============================================================================

ALTER TABLE offer_lines ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offer_lines"
  ON offer_lines FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offer_lines"
  ON offer_lines FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- OFFER_EVENTS TABLE
-- ============================================================================

ALTER TABLE offer_events ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offer_events"
  ON offer_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offer_events"
  ON offer_events FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- FUTURE: More granular policies
-- ============================================================================
-- TODO: Add policies for restaurant-specific and supplier-specific access
-- For example:
-- - Restaurants can only see offers where restaurant_id = their profile
-- - Suppliers can only see/edit offers where supplier_id = their profile
-- - Requires proper user-to-restaurant/supplier mapping in auth


-- ============================================================================
-- SECTION: 20260117_add_accepted_offer_id_to_requests.sql
-- ============================================================================

/**
 * ADD ACCEPTED OFFER ID TO REQUESTS - PILOT LOOP 1.0
 *
 * Purpose: Enable request ↔ offer relationship for pilot loop
 * Flow: Request → Offer → Accept → Request.accepted_offer_id set
 *
 * Changes:
 * 1. Add accepted_offer_id column (nullable FK to offers)
 * 2. Add status column if missing (OPEN/ACCEPTED/CLOSED)
 * 3. Add index for performance
 * 4. Add constraint: only 1 accepted offer per request
 *
 * Security:
 * - RLS policies inherited from requests table
 * - Service layer enforces single accepted offer
 */

-- Add accepted_offer_id column (nullable FK to offers)
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS accepted_offer_id UUID NULL REFERENCES offers(id) ON DELETE SET NULL;

-- Add status column if it doesn't exist (default OPEN)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'requests' AND column_name = 'status') THEN
    ALTER TABLE requests ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN'
      CHECK (status IN ('OPEN', 'ACCEPTED', 'CLOSED', 'CANCELLED'));
  END IF;
END
$$;

-- Index for efficient queries
-- Note: Only create tenant_id indexes if tenant_id column exists
DO $$
BEGIN
  -- Check if tenant_id column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'requests' AND column_name = 'tenant_id') THEN
    -- Create indexes with tenant_id
    CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(tenant_id, accepted_offer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(tenant_id, status);
  ELSE
    -- Create indexes without tenant_id (single-tenant mode)
    CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(accepted_offer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  END IF;
END
$$;

-- Comments
COMMENT ON COLUMN requests.accepted_offer_id IS 'FK to accepted offer (pilot loop 1.0) - only 1 accepted offer per request';
COMMENT ON COLUMN requests.status IS 'Request status: OPEN (awaiting offers), ACCEPTED (offer accepted), CLOSED, CANCELLED';

-- Constraint: If accepted_offer_id is set, status should be ACCEPTED
-- (This is enforced in application layer for MVP, but could add CHECK constraint)
-- ALTER TABLE requests ADD CONSTRAINT accepted_offer_implies_status
--   CHECK (accepted_offer_id IS NULL OR status = 'ACCEPTED');


-- ============================================================================
-- SECTION: 20260118_add_wine_certifications.sql
-- ============================================================================

-- Add wine certification columns
-- Migration: 20260118_add_wine_certifications.sql
-- Purpose: Add biodynamiskt and veganskt certification columns to wines table

-- Add biodynamiskt column (ekologisk already exists)
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS biodynamiskt BOOLEAN DEFAULT FALSE;

-- Add veganskt column
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS veganskt BOOLEAN DEFAULT FALSE;

-- Create index for certification filtering (compound index for common queries)
CREATE INDEX IF NOT EXISTS idx_wines_certifications
ON wines(ekologisk, biodynamiskt, veganskt)
WHERE ekologisk = TRUE OR biodynamiskt = TRUE OR veganskt = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN wines.ekologisk IS 'Wine is certified organic (already existed)';
COMMENT ON COLUMN wines.biodynamiskt IS 'Wine is certified biodynamic';
COMMENT ON COLUMN wines.veganskt IS 'Wine is certified vegan';

-- Verify columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wines' AND column_name = 'biodynamiskt'
  ) THEN
    RAISE EXCEPTION 'Column biodynamiskt was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wines' AND column_name = 'veganskt'
  ) THEN
    RAISE EXCEPTION 'Column veganskt was not created';
  END IF;

  RAISE NOTICE 'Wine certification columns created successfully';
END $$;


-- ============================================================================
-- SECTION: 20260118_create_invites_table.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260118_enable_rls_invites.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260119_add_default_importer_to_suppliers.sql
-- ============================================================================

/**
 * MIGRATION: Add default_importer_id to suppliers
 *
 * Purpose: Establish persistent EU-seller → IOR (Importer-of-Record) relationship
 *
 * Changes:
 * - Add suppliers.default_importer_id (nullable FK to importers.id)
 * - Add constraint: EU suppliers (EU_PRODUCER, EU_IMPORTER) must have default_importer_id
 *
 * Business Rule:
 * - SWEDISH_IMPORTER: can operate without IOR (they ARE the importer)
 * - EU_PRODUCER/EU_IMPORTER: MUST have a Swedish IOR assigned
 */

-- Add default_importer_id column (nullable FK to importers table)
ALTER TABLE suppliers
ADD COLUMN default_importer_id UUID NULL REFERENCES importers(id) ON DELETE SET NULL;

-- Create index for FK lookups
CREATE INDEX idx_suppliers_default_importer ON suppliers(default_importer_id);

-- Create index for tenant + type queries (common for EU supplier filtering)
-- SKIPPED: suppliers table has no tenant_id column
-- CREATE INDEX idx_suppliers_tenant_type ON suppliers(tenant_id, type);

-- Add constraint: EU suppliers must have default IOR
-- SWEDISH_IMPORTER can operate without (they are their own importer)
ALTER TABLE suppliers
ADD CONSTRAINT eu_requires_default_ior CHECK (
  (type = 'SWEDISH_IMPORTER') OR (default_importer_id IS NOT NULL)
);

-- Comment for documentation
COMMENT ON COLUMN suppliers.default_importer_id IS
  'Default Swedish Importer-of-Record for EU suppliers. Required for EU_PRODUCER and EU_IMPORTER types. NULL for SWEDISH_IMPORTER (they are their own importer).';

-- Validation query (to run after migration)
-- SELECT id, namn, type, default_importer_id
-- FROM suppliers
-- WHERE type IN ('EU_PRODUCER', 'EU_IMPORTER')
-- AND default_importer_id IS NULL;
-- ^ Should return 0 rows after constraint is active


-- ============================================================================
-- SECTION: 20260119_create_orders_tables.sql
-- ============================================================================

/**
 * MIGRATION: Create orders + order_lines + order_events tables
 *
 * Purpose: Enable operational fulfillment tracking for accepted offers
 *
 * Flow:
 * 1. Offer ACCEPTED → order created (snapshot of offer)
 * 2. IOR manages order fulfillment via status updates
 * 3. order_events provides audit trail
 *
 * Key Relationships:
 * - orders.offer_id → offers.id (source of truth)
 * - orders.seller_supplier_id → suppliers.id (who sells the wine)
 * - orders.importer_of_record_id → importers.id (who handles import/fulfillment)
 * - order_lines: snapshot of offer_lines at acceptance time
 */

-- ============================================================================
-- ORDER STATUS ENUM
-- ============================================================================

CREATE TYPE order_status AS ENUM (
  'CONFIRMED',       -- Order created from accepted offer (initial state)
  'IN_FULFILLMENT',  -- IOR has started fulfillment process
  'SHIPPED',         -- IOR has shipped the order
  'DELIVERED',       -- Restaurant confirmed receipt
  'CANCELLED'        -- Order cancelled (exceptional case)
);

COMMENT ON TYPE order_status IS 'Order fulfillment status lifecycle';

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core relationships
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  request_id UUID NULL REFERENCES requests(id) ON DELETE SET NULL,

  -- Operational roles
  seller_supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  importer_of_record_id UUID NOT NULL REFERENCES importers(id) ON DELETE RESTRICT,

  -- Delivery (optional link to import case/DDL)
  delivery_location_id UUID NULL REFERENCES direct_delivery_locations(id) ON DELETE SET NULL,
  import_case_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL,

  -- Status tracking
  status order_status NOT NULL DEFAULT 'CONFIRMED',

  -- Snapshot metadata (from offer at acceptance time)
  total_lines INTEGER NOT NULL DEFAULT 0,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SEK',

  -- Audit
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_total_lines CHECK (total_lines >= 0),
  CONSTRAINT valid_total_quantity CHECK (total_quantity >= 0)
);

-- Indexes for common queries
CREATE INDEX idx_orders_tenant_restaurant ON orders(tenant_id, restaurant_id);
CREATE INDEX idx_orders_tenant_seller ON orders(tenant_id, seller_supplier_id);
CREATE INDEX idx_orders_tenant_ior ON orders(tenant_id, importer_of_record_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_offer ON orders(offer_id);
CREATE INDEX idx_orders_request ON orders(request_id);

-- Composite index for IOR console queries (most common)
CREATE INDEX idx_orders_ior_status_created ON orders(importer_of_record_id, status, created_at DESC);

COMMENT ON TABLE orders IS 'Operational orders created from accepted offers, managed by IOR for fulfillment';
COMMENT ON COLUMN orders.seller_supplier_id IS 'Supplier selling the wine (owns the assortment)';
COMMENT ON COLUMN orders.importer_of_record_id IS 'Swedish IOR responsible for import/compliance/fulfillment';
COMMENT ON COLUMN orders.import_case_id IS 'Optional link to 5369 import case (if EU direct delivery)';

-- ============================================================================
-- ORDER LINES TABLE (snapshot of offer_lines)
-- ============================================================================

CREATE TABLE order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Parent order
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Wine reference (snapshot from offer_line)
  wine_sku_id UUID NULL REFERENCES wine_skus(id) ON DELETE SET NULL,
  wine_master_id UUID NULL REFERENCES wine_masters(id) ON DELETE SET NULL,

  -- Wine details (denormalized snapshot for history)
  wine_name TEXT NOT NULL,
  producer TEXT,
  vintage TEXT,
  country TEXT,
  region TEXT,
  article_number TEXT,

  -- Quantities
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'flaska',

  -- Pricing (internal - offer prices, NOT WS market prices)
  unit_price_sek DECIMAL(10,2),
  total_price_sek DECIMAL(10,2),

  -- Metadata
  line_number INTEGER NOT NULL,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_unit_price CHECK (unit_price_sek IS NULL OR unit_price_sek >= 0),
  CONSTRAINT valid_total_price CHECK (total_price_sek IS NULL OR total_price_sek >= 0),
  CONSTRAINT valid_line_number CHECK (line_number > 0)
);

-- Indexes
CREATE INDEX idx_order_lines_tenant ON order_lines(tenant_id);
CREATE INDEX idx_order_lines_order ON order_lines(order_id, line_number);
CREATE INDEX idx_order_lines_wine_sku ON order_lines(wine_sku_id);
CREATE INDEX idx_order_lines_wine_master ON order_lines(wine_master_id);

COMMENT ON TABLE order_lines IS 'Line items snapshot from offer at acceptance time';
COMMENT ON COLUMN order_lines.wine_name IS 'Denormalized wine name for history (even if SKU deleted)';
COMMENT ON COLUMN order_lines.unit_price_sek IS 'Internal offer price (NOT WS market price)';

-- ============================================================================
-- ORDER EVENTS TABLE (audit trail)
-- ============================================================================

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Parent order
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL,

  -- Status transition (if applicable)
  from_status TEXT,
  to_status TEXT,

  -- Event details
  note TEXT,
  metadata JSONB,

  -- Actor
  actor_user_id UUID NULL,
  actor_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_events_tenant ON order_events(tenant_id);
CREATE INDEX idx_order_events_order ON order_events(order_id, created_at DESC);
CREATE INDEX idx_order_events_type ON order_events(event_type);
CREATE INDEX idx_order_events_created ON order_events(created_at DESC);

COMMENT ON TABLE order_events IS 'Audit trail for all order actions (status changes, updates, etc)';
COMMENT ON COLUMN order_events.event_type IS 'Event type: ORDER_CREATED, STATUS_CHANGED, SHIPMENT_UPDATED, etc';
COMMENT ON COLUMN order_events.metadata IS 'Additional event data (e.g., tracking_number, shipment_details)';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON orders FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON order_lines FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON order_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation (if using custom JWT claims)
CREATE POLICY "Tenant isolation" ON orders FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation" ON order_lines FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation" ON order_events FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- VALIDATION QUERIES (to run after migration)
-- ============================================================================

-- Check that orders table is ready
-- SELECT COUNT(*) FROM orders;

-- Check indexes exist
-- SELECT indexname FROM pg_indexes WHERE tablename = 'orders';

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('orders', 'order_lines', 'order_events');


-- ============================================================================
-- END OF PART 4
