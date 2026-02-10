-- PART 5 — Continue from: -- SECTION: 20260119_add_import_id_to_orders.sql

-- SECTION: 20260119_add_import_id_to_orders.sql
-- ============================================================================

/**
 * MIGRATION: Add import_id to orders table
 *
 * Purpose: Link orders to import cases for EU compliance tracking
 *
 * Flow:
 * - EU order created → import case auto-created (if DDL available)
 * - Order linked to import case via orders.import_id
 * - IOR can view compliance status (5369, DDL) in order detail
 *
 * Business Rule:
 * - import_id is nullable (not all orders need import case, e.g., Swedish domestic)
 * - EU orders should have import_id (auto-created or manually linked)
 */

-- Add import_id column (nullable FK to imports table)
ALTER TABLE orders
ADD COLUMN import_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL;

-- Create index for FK lookups and filtering
CREATE INDEX idx_orders_import ON orders(import_id);

-- Composite index for tenant + import queries
CREATE INDEX idx_orders_tenant_import ON orders(tenant_id, import_id);

-- Comment for documentation
COMMENT ON COLUMN orders.import_id IS
  'Link to import case for EU compliance tracking. NULL for domestic orders or if import case not yet created. Auto-created for EU orders when DDL is available.';

-- Validation query (to run after migration)
-- SELECT
--   o.id,
--   o.status,
--   o.import_id,
--   s.type as supplier_type,
--   i.status as import_status
-- FROM orders o
-- JOIN suppliers s ON o.seller_supplier_id = s.id
-- LEFT JOIN imports i ON o.import_id = i.id
-- WHERE s.type IN ('EU_PRODUCER', 'EU_IMPORTER')
-- ORDER BY o.created_at DESC
-- LIMIT 20;


-- ============================================================================
-- SECTION: 20260120_create_admin_users.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260120_enable_rls_admin_users.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260120_moq_and_wine_catalog.sql
-- ============================================================================

-- MOQ HANDLING & WINE CATALOG EXTENSION
-- Migration: 20260120_moq_and_wine_catalog (fixed)

-- ============================================================================
-- STEP 1: Add default MOQ settings to suppliers
-- ============================================================================

-- Add MOQ unit enum
DO $$ BEGIN
  CREATE TYPE moq_unit AS ENUM ('bottles', 'cases');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add shipping zone enum
DO $$ BEGIN
  CREATE TYPE shipping_zone AS ENUM ('sweden', 'eu', 'international');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend suppliers table with MOQ defaults
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS default_moq INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS moq_unit moq_unit DEFAULT 'bottles',
ADD COLUMN IF NOT EXISTS default_case_size INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS shipping_zone shipping_zone DEFAULT 'sweden';

-- Add constraints (drop first if exists)
DO $$ BEGIN
  ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS positive_default_moq;
  ALTER TABLE suppliers ADD CONSTRAINT positive_default_moq CHECK (default_moq > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS positive_case_size;
  ALTER TABLE suppliers ADD CONSTRAINT positive_case_size CHECK (default_case_size > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMENT ON COLUMN suppliers.default_moq IS 'Default minimum order quantity for this supplier';
COMMENT ON COLUMN suppliers.moq_unit IS 'Unit for MOQ: bottles or cases';
COMMENT ON COLUMN suppliers.default_case_size IS 'Default bottles per case (typically 6)';
COMMENT ON COLUMN suppliers.shipping_zone IS 'Shipping zone for delivery estimates';

-- ============================================================================
-- STEP 2: Add wine color enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE wine_color AS ENUM ('red', 'white', 'rose', 'sparkling', 'fortified', 'orange');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP 3: Extend supplier_wines with additional catalog fields
-- ============================================================================

ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS color wine_color,
ADD COLUMN IF NOT EXISTS alcohol_pct DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS bottle_size_ml INTEGER DEFAULT 750,
ADD COLUMN IF NOT EXISTS organic BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS biodynamic BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS case_size INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS appellation TEXT;

-- Rename min_order_qty to moq for consistency (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_wines' AND column_name = 'min_order_qty'
  ) THEN
    ALTER TABLE supplier_wines RENAME COLUMN min_order_qty TO moq;
  END IF;
END $$;

-- Ensure moq column exists
ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS moq INTEGER DEFAULT 6;

-- Add constraints for supplier_wines
DO $$ BEGIN
  ALTER TABLE supplier_wines DROP CONSTRAINT IF EXISTS positive_moq;
  ALTER TABLE supplier_wines ADD CONSTRAINT positive_moq CHECK (moq > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE supplier_wines DROP CONSTRAINT IF EXISTS positive_bottle_size;
  ALTER TABLE supplier_wines ADD CONSTRAINT positive_bottle_size CHECK (bottle_size_ml > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE supplier_wines DROP CONSTRAINT IF EXISTS positive_case_size_wine;
  ALTER TABLE supplier_wines ADD CONSTRAINT positive_case_size_wine CHECK (case_size > 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE supplier_wines DROP CONSTRAINT IF EXISTS valid_alcohol;
  ALTER TABLE supplier_wines ADD CONSTRAINT valid_alcohol CHECK (alcohol_pct IS NULL OR (alcohol_pct >= 0 AND alcohol_pct <= 100));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_wines_sku ON supplier_wines(supplier_id, sku);
CREATE INDEX IF NOT EXISTS idx_supplier_wines_color ON supplier_wines(color);

COMMENT ON COLUMN supplier_wines.color IS 'Wine color: red, white, rose, sparkling, fortified, orange';
COMMENT ON COLUMN supplier_wines.moq IS 'Minimum order quantity in bottles (overrides supplier default)';
COMMENT ON COLUMN supplier_wines.case_size IS 'Bottles per case for this wine';
COMMENT ON COLUMN supplier_wines.sku IS 'Supplier article number';
COMMENT ON COLUMN supplier_wines.alcohol_pct IS 'Alcohol percentage';
COMMENT ON COLUMN supplier_wines.bottle_size_ml IS 'Bottle size in ml (default 750)';
COMMENT ON COLUMN supplier_wines.organic IS 'Certified organic';
COMMENT ON COLUMN supplier_wines.biodynamic IS 'Certified biodynamic';
COMMENT ON COLUMN supplier_wines.appellation IS 'Wine appellation (e.g. Saint-Julien, Barolo)';

-- ============================================================================
-- STEP 4: Create request_wines junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS request_wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  supplier_wine_id UUID REFERENCES supplier_wines(id) ON DELETE SET NULL,
  wine_name TEXT,
  producer TEXT,
  vintage TEXT,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  adjusted_quantity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint separately to handle existing table
DO $$ BEGIN
  ALTER TABLE request_wines ADD CONSTRAINT has_wine_info CHECK (
    supplier_wine_id IS NOT NULL OR wine_name IS NOT NULL
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_request_wines_request ON request_wines(request_id);
CREATE INDEX IF NOT EXISTS idx_request_wines_supplier_wine ON request_wines(supplier_wine_id);

ALTER TABLE request_wines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own request wines" ON request_wines;
CREATE POLICY "Users see own request wines" ON request_wines
  FOR ALL USING (
    request_id IN (SELECT id FROM requests WHERE restaurant_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role full access to request_wines" ON request_wines;
CREATE POLICY "Service role full access to request_wines" ON request_wines
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 5: Create wine_import_batches table
-- ============================================================================

CREATE TABLE IF NOT EXISTS wine_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  imported_by UUID REFERENCES auth.users(id),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'previewed', 'imported', 'failed')),
  error_message TEXT,
  validation_errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wine_import_batches_tenant ON wine_import_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wine_import_batches_supplier ON wine_import_batches(supplier_id);

ALTER TABLE wine_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access to wine_import_batches" ON wine_import_batches;
CREATE POLICY "Service role access to wine_import_batches" ON wine_import_batches
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 6: Helper function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_wine_moq(wine_id UUID)
RETURNS INTEGER AS $$
DECLARE
  wine_moq INTEGER;
  supplier_moq INTEGER;
BEGIN
  SELECT moq INTO wine_moq FROM supplier_wines WHERE id = wine_id;
  IF wine_moq IS NOT NULL THEN
    RETURN wine_moq;
  END IF;
  SELECT s.default_moq INTO supplier_moq
  FROM suppliers s
  JOIN supplier_wines sw ON sw.supplier_id = s.id
  WHERE sw.id = wine_id;
  RETURN COALESCE(supplier_moq, 6);
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION: 20260120_required_wine_fields.sql
-- ============================================================================

-- REQUIRED WINE CATALOG FIELDS
-- Migration: 20260120_required_wine_fields
-- Purpose: Enforce required fields for wine import based on pilot requirements

-- ============================================================================
-- DECISION: These fields are required for wine catalog import:
-- - sku (Reference/article_number) - unique identifier per supplier
-- - vintage - wine vintage year
-- - color (Type) - wine type (red, white, etc.)
-- - bottle_size_ml (Volume) - bottle size in ml
-- - stock_qty (Quantity) - available stock
-- ============================================================================

-- STEP 1: Update existing NULL values with placeholders before adding constraints
-- This allows the migration to run on existing data

-- Set default vintage to 0 (NV wines) where NULL
UPDATE supplier_wines SET vintage = 0 WHERE vintage IS NULL;

-- Set default color to 'red' where NULL (most common)
UPDATE supplier_wines SET color = 'red' WHERE color IS NULL;

-- Set default bottle_size_ml to 750 where NULL
UPDATE supplier_wines SET bottle_size_ml = 750 WHERE bottle_size_ml IS NULL;

-- Set default stock_qty to 0 where NULL
UPDATE supplier_wines SET stock_qty = 0 WHERE stock_qty IS NULL;

-- Set default sku to generated value where NULL
UPDATE supplier_wines
SET sku = 'AUTO-' || SUBSTRING(id::text, 1, 8)
WHERE sku IS NULL OR sku = '';

-- ============================================================================
-- STEP 2: Add NOT NULL constraints
-- ============================================================================

-- Make vintage required (0 = NV/Non-Vintage)
ALTER TABLE supplier_wines
ALTER COLUMN vintage SET NOT NULL;

-- Make color (wine type) required
ALTER TABLE supplier_wines
ALTER COLUMN color SET NOT NULL;

-- Make bottle_size_ml required with default
ALTER TABLE supplier_wines
ALTER COLUMN bottle_size_ml SET NOT NULL,
ALTER COLUMN bottle_size_ml SET DEFAULT 750;

-- Make stock_qty required with default 0
ALTER TABLE supplier_wines
ALTER COLUMN stock_qty SET NOT NULL,
ALTER COLUMN stock_qty SET DEFAULT 0;

-- Make sku required
ALTER TABLE supplier_wines
ALTER COLUMN sku SET NOT NULL;

-- ============================================================================
-- STEP 3: Add unique constraint for sku per supplier
-- ============================================================================

-- Each supplier's article numbers must be unique
DO $$ BEGIN
  ALTER TABLE supplier_wines
  ADD CONSTRAINT unique_supplier_sku UNIQUE (supplier_id, sku);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP 4: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN supplier_wines.sku IS 'Supplier article number (Reference) - required, unique per supplier';
COMMENT ON COLUMN supplier_wines.vintage IS 'Wine vintage year - required (use 0 for NV/Non-Vintage wines)';
COMMENT ON COLUMN supplier_wines.color IS 'Wine type (red, white, rose, sparkling, fortified, orange) - required';
COMMENT ON COLUMN supplier_wines.bottle_size_ml IS 'Bottle volume in ml (default 750) - required';
COMMENT ON COLUMN supplier_wines.stock_qty IS 'Available stock quantity in bottles - required (0 if out of stock)';

-- ============================================================================
-- STEP 5: Validation function for imports
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_wine_import_row(
  p_sku TEXT,
  p_name TEXT,
  p_producer TEXT,
  p_vintage INTEGER,
  p_country TEXT,
  p_color TEXT,
  p_bottle_size_ml INTEGER,
  p_price INTEGER,
  p_stock_qty INTEGER
) RETURNS TABLE (is_valid BOOLEAN, errors TEXT[]) AS $$
DECLARE
  error_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check required fields
  IF p_sku IS NULL OR p_sku = '' THEN
    error_list := array_append(error_list, 'Reference (sku) is required');
  END IF;

  IF p_name IS NULL OR p_name = '' THEN
    error_list := array_append(error_list, 'Cuvée (name) is required');
  END IF;

  IF p_producer IS NULL OR p_producer = '' THEN
    error_list := array_append(error_list, 'Producer is required');
  END IF;

  IF p_vintage IS NULL THEN
    error_list := array_append(error_list, 'Vintage is required (use 0 for NV)');
  ELSIF p_vintage < 0 OR (p_vintage > 0 AND p_vintage < 1900) OR p_vintage > 2100 THEN
    error_list := array_append(error_list, 'Vintage must be 0 (NV) or between 1900-2100');
  END IF;

  IF p_country IS NULL OR p_country = '' THEN
    error_list := array_append(error_list, 'Country is required');
  END IF;

  IF p_color IS NULL OR p_color = '' THEN
    error_list := array_append(error_list, 'Type (color) is required');
  ELSIF p_color NOT IN ('red', 'white', 'rose', 'sparkling', 'fortified', 'orange') THEN
    error_list := array_append(error_list, 'Type must be: red, white, rose, sparkling, fortified, or orange');
  END IF;

  IF p_bottle_size_ml IS NULL OR p_bottle_size_ml <= 0 THEN
    error_list := array_append(error_list, 'Volume (bottle_size_ml) is required and must be > 0');
  END IF;

  IF p_price IS NULL OR p_price <= 0 THEN
    error_list := array_append(error_list, 'List price is required and must be > 0');
  END IF;

  IF p_stock_qty IS NULL OR p_stock_qty < 0 THEN
    error_list := array_append(error_list, 'Quantity (stock_qty) is required and must be >= 0');
  END IF;

  RETURN QUERY SELECT array_length(error_list, 1) IS NULL OR array_length(error_list, 1) = 0, error_list;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_wine_import_row IS 'Validates a wine import row against required field rules';


-- ============================================================================
-- SECTION: 20260121_enable_rls_all_tables.sql
-- ============================================================================

/**
 * COMPREHENSIVE RLS POLICIES
 * Migration: 20260121_enable_rls_all_tables
 *
 * Enables RLS with service role access on all tables
 */

-- ============================================================================
-- STEP 1: Drop ALL existing policies first (clean slate)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Enable RLS on all public tables
-- ============================================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma_%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Create service role policies for all tables
-- ============================================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma_%'
  ) LOOP
    EXECUTE format('
      CREATE POLICY "Service role full access" ON public.%I FOR ALL
      USING (auth.jwt() ->> ''role'' = ''service_role'')
      WITH CHECK (auth.jwt() ->> ''role'' = ''service_role'')
    ', t.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Run this to verify:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;


-- ============================================================================
-- SECTION: 20260121_require_case_size.sql
-- ============================================================================

/**
 * REQUIRE CASE_SIZE FOR LOGISTICS
 * Migration: 20260121_require_case_size
 *
 * Purpose: Make case_size mandatory for proper box/case handling
 *
 * Logic:
 * - stock_qty = total bottles in stock
 * - case_size = bottles per case (required, default 6)
 * - moq = minimum order quantity in bottles (default = case_size)
 * - Available cases = floor(stock_qty / case_size)
 * - Orders should be in multiples of case_size
 */

-- ============================================================================
-- STEP 1: Set default case_size where NULL
-- ============================================================================

UPDATE supplier_wines
SET case_size = 6
WHERE case_size IS NULL;

-- ============================================================================
-- STEP 2: Make case_size NOT NULL with default
-- ============================================================================

ALTER TABLE supplier_wines
ALTER COLUMN case_size SET NOT NULL,
ALTER COLUMN case_size SET DEFAULT 6;

-- ============================================================================
-- STEP 3: Add constraint to ensure valid case_size
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE supplier_wines
  DROP CONSTRAINT IF EXISTS valid_case_size;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE supplier_wines
ADD CONSTRAINT valid_case_size CHECK (case_size > 0 AND case_size <= 24);

-- ============================================================================
-- STEP 4: Ensure MOQ defaults to case_size if not set
-- ============================================================================

UPDATE supplier_wines
SET moq = case_size
WHERE moq IS NULL OR moq < case_size;

-- ============================================================================
-- STEP 5: Add helper function for available cases
-- ============================================================================

CREATE OR REPLACE FUNCTION get_available_cases(wine_id UUID)
RETURNS INTEGER AS $$
DECLARE
  wine RECORD;
BEGIN
  SELECT stock_qty, case_size INTO wine
  FROM supplier_wines
  WHERE id = wine_id;

  IF wine IS NULL THEN
    RETURN 0;
  END IF;

  RETURN FLOOR(wine.stock_qty::numeric / wine.case_size);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_cases IS 'Returns number of complete cases available for a wine';

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON COLUMN supplier_wines.case_size IS 'Bottles per case (Q/box) - required for logistics, default 6';
COMMENT ON COLUMN supplier_wines.stock_qty IS 'Total bottles in stock - only full cases are sellable';
COMMENT ON COLUMN supplier_wines.moq IS 'Minimum order quantity in bottles - should be multiple of case_size';


-- ============================================================================
-- SECTION: 20260124_add_delivery_location_to_requests.sql
-- ============================================================================

/**
 * ADD DELIVERY LOCATION TO REQUESTS
 *
 * Allows restaurant to specify delivery city/location in their request
 * so suppliers can calculate accurate shipping costs.
 *
 * Also ensures order value tracking for Winefeed invoicing.
 */

-- Add delivery location fields to requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS leverans_ort TEXT,
  ADD COLUMN IF NOT EXISTS leverans_adress TEXT,
  ADD COLUMN IF NOT EXISTS leverans_postnummer TEXT;

-- Comments
COMMENT ON COLUMN requests.leverans_ort IS 'Delivery city, e.g. Stockholm, Malmö, Göteborg';
COMMENT ON COLUMN requests.leverans_adress IS 'Full delivery address (optional, can be provided later)';
COMMENT ON COLUMN requests.leverans_postnummer IS 'Postal code for delivery location';

-- Verify commercial_intents has order value tracking (for Winefeed invoicing)
-- These should already exist from previous migrations:
-- - total_goods_amount_ore: Wine value in öre
-- - shipping_amount_ore: Shipping cost in öre (if any)
-- - total_payable_estimate_ore: Total order value
-- - service_fee_amount_ore: Winefeed fee (currently 0 for pilot)
-- - service_fee_mode: 'PILOT_FREE' or future modes like 'PERCENTAGE'

-- Add index for querying by delivery location
CREATE INDEX IF NOT EXISTS idx_requests_leverans_ort ON requests(leverans_ort);


-- ============================================================================
-- SECTION: 20260124_add_shipping_to_offers.sql
-- ============================================================================

/**
 * ADD SHIPPING FIELDS TO OFFERS
 *
 * Allows suppliers to include shipping cost when responding to requests.
 * Two options:
 * - is_franco = true: "Fritt levererat" - shipping included in wine price
 * - is_franco = false: shipping_cost_sek specifies the shipping cost
 *
 * Related to: /supplier/requests bulk offer, /supplier/requests/[id] single offer
 */

-- Add shipping columns to offers table
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS is_franco BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_cost_sek INTEGER NULL,
  ADD COLUMN IF NOT EXISTS shipping_notes TEXT NULL;

-- Add index for filtering franco/non-franco offers
CREATE INDEX IF NOT EXISTS idx_offers_is_franco ON offers(is_franco);

-- Comments
COMMENT ON COLUMN offers.is_franco IS 'True = shipping included in price (fritt levererat), False = separate shipping cost';
COMMENT ON COLUMN offers.shipping_cost_sek IS 'Shipping cost in SEK (öre), null if is_franco=true';
COMMENT ON COLUMN offers.shipping_notes IS 'Optional notes about shipping, e.g. "Leverans Sthlm, andra orter +200 kr"';


-- ============================================================================
-- SECTION: 20260124_add_shipping_to_orders.sql
-- ============================================================================

/**
 * ADD SHIPPING AND ORDER VALUE TRACKING TO ORDERS
 *
 * Extends orders table to track:
 * - Shipping info from accepted offer (is_franco, shipping_cost)
 * - Total order value for Winefeed invoicing
 *
 * Business model: Winefeed as Order Facilitator
 * - Tracks order value so Winefeed can invoice commission later
 * - Stores amounts in öre (1/100 SEK) for precision
 */

-- Add shipping columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_franco BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_cost_ore INTEGER NULL,
  ADD COLUMN IF NOT EXISTS shipping_notes TEXT NULL;

-- Add order value columns for Winefeed invoicing
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_goods_amount_ore INTEGER NULL,
  ADD COLUMN IF NOT EXISTS total_order_value_ore INTEGER NULL,
  ADD COLUMN IF NOT EXISTS service_fee_mode TEXT DEFAULT 'PILOT_FREE',
  ADD COLUMN IF NOT EXISTS service_fee_amount_ore INTEGER DEFAULT 0;

-- Comments
COMMENT ON COLUMN orders.is_franco IS 'True = shipping included in wine price (fritt levererat)';
COMMENT ON COLUMN orders.shipping_cost_ore IS 'Shipping cost in öre (1 SEK = 100 öre)';
COMMENT ON COLUMN orders.shipping_notes IS 'Notes about shipping, e.g. delivery location';
COMMENT ON COLUMN orders.total_goods_amount_ore IS 'Total wine value in öre (sum of order_lines.total_price_sek * 100)';
COMMENT ON COLUMN orders.total_order_value_ore IS 'Total order value in öre (goods + shipping)';
COMMENT ON COLUMN orders.service_fee_mode IS 'Winefeed fee mode: PILOT_FREE (no fee), PERCENTAGE (future)';
COMMENT ON COLUMN orders.service_fee_amount_ore IS 'Winefeed service fee in öre (0 for pilot)';

-- Add delivery location from request for email/confirmation
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_city TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT NULL;

COMMENT ON COLUMN orders.delivery_city IS 'Delivery city from request';
COMMENT ON COLUMN orders.delivery_address IS 'Delivery address (if provided)';
COMMENT ON COLUMN orders.delivery_postal_code IS 'Delivery postal code (if provided)';

-- Index for filtering by service fee mode (for future invoicing queries)
CREATE INDEX IF NOT EXISTS idx_orders_service_fee_mode ON orders(service_fee_mode);


-- ============================================================================
-- SECTION: 20260125_import_document_flow.sql
-- ============================================================================

/**
 * IMPORT DOCUMENT FLOW
 *
 * Migration: 20260125_import_document_flow
 *
 * Extends import_documents with:
 * 1. Document status tracking (PENDING, VERIFIED, REJECTED)
 * 2. Document type requirements per import status
 * 3. External document upload support
 * 4. Auto-transition helpers
 */

-- =============================================================================
-- STEP 1: Create document status enum
-- =============================================================================

DO $$
BEGIN
  CREATE TYPE import_document_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- STEP 2: Extend import_documents table
-- =============================================================================

-- Add status column
ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS status import_document_status DEFAULT 'PENDING';

-- Add file metadata for uploads
ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Add verification tracking
ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add document category (for required vs optional)
ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- =============================================================================
-- STEP 3: Create document types reference table
-- =============================================================================

CREATE TABLE IF NOT EXISTS import_document_types (
  code TEXT PRIMARY KEY,
  name_sv TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  required_for_status TEXT[],  -- Array of import statuses where this doc is required
  sort_order INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true
);

-- Insert standard document types for Swedish wine imports
INSERT INTO import_document_types (code, name_sv, name_en, description, required_for_status, sort_order) VALUES
  ('SKV_5369_03', 'Direktförsäljningstillstånd (5369)', 'Direct Delivery License Application', 'Skatteverkets blankett för DDL-ansökan', ARRAY['SUBMITTED'], 10),
  ('INVOICE', 'Faktura', 'Invoice', 'Leverantörsfaktura för varorna', ARRAY['SUBMITTED', 'DOCS_PENDING'], 20),
  ('PACKING_LIST', 'Packlista', 'Packing List', 'Detaljerad innehållsförteckning', ARRAY['SUBMITTED', 'DOCS_PENDING'], 30),
  ('CMR', 'Fraktsedel (CMR)', 'CMR Consignment Note', 'Internationell fraktsedel för vägtransport', ARRAY['IN_TRANSIT'], 40),
  ('CUSTOMS_DECLARATION', 'Tulldeklaration', 'Customs Declaration', 'Tullverkets importdeklaration', ARRAY['IN_TRANSIT', 'CLEARED'], 50),
  ('EXCISE_DOCUMENT', 'Punktskattedokument', 'Excise Document', 'e-AD eller EMCS-dokument', ARRAY['CLEARED'], 60),
  ('DELIVERY_NOTE', 'Följesedel', 'Delivery Note', 'Leveransbekräftelse vid mottagning', ARRAY['CLEARED'], 70),
  ('PROOF_OF_PAYMENT', 'Betalningsbevis', 'Proof of Payment', 'Kvitto eller bankutdrag', ARRAY[]::TEXT[], 80),
  ('OTHER', 'Övrigt', 'Other', 'Andra relevanta dokument', ARRAY[]::TEXT[], 99)
ON CONFLICT (code) DO UPDATE SET
  name_sv = EXCLUDED.name_sv,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  required_for_status = EXCLUDED.required_for_status,
  sort_order = EXCLUDED.sort_order;

-- =============================================================================
-- STEP 4: Create import document requirements view
-- =============================================================================

CREATE OR REPLACE VIEW import_document_requirements AS
SELECT
  i.id AS import_id,
  i.tenant_id,
  i.status AS import_status,
  dt.code AS document_type,
  dt.name_sv AS document_name,
  dt.required_for_status,
  (i.status = ANY(dt.required_for_status)) AS is_required_now,
  (
    SELECT COUNT(*) > 0
    FROM import_documents d
    WHERE d.import_id = i.id
    AND d.type = dt.code
    AND d.status = 'VERIFIED'
  ) AS is_satisfied,
  (
    SELECT d.id
    FROM import_documents d
    WHERE d.import_id = i.id
    AND d.type = dt.code
    ORDER BY d.version DESC
    LIMIT 1
  ) AS latest_document_id,
  (
    SELECT d.status
    FROM import_documents d
    WHERE d.import_id = i.id
    AND d.type = dt.code
    ORDER BY d.version DESC
    LIMIT 1
  ) AS latest_document_status
FROM imports i
CROSS JOIN import_document_types dt
WHERE dt.is_active = true;

-- =============================================================================
-- STEP 5: Helper function - check if import has all required docs
-- =============================================================================

CREATE OR REPLACE FUNCTION import_has_required_documents(p_import_id UUID)
RETURNS boolean AS $$
DECLARE
  v_missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing_count
  FROM import_document_requirements r
  WHERE r.import_id = p_import_id
  AND r.is_required_now = true
  AND r.is_satisfied = false;

  RETURN v_missing_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 6: Helper function - get missing documents for import
-- =============================================================================

CREATE OR REPLACE FUNCTION import_missing_documents(p_import_id UUID)
RETURNS TABLE (
  document_type TEXT,
  document_name TEXT,
  is_required BOOLEAN,
  has_pending BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.document_type,
    r.document_name,
    r.is_required_now AS is_required,
    (r.latest_document_status = 'PENDING') AS has_pending
  FROM import_document_requirements r
  WHERE r.import_id = p_import_id
  AND r.is_required_now = true
  AND r.is_satisfied = false
  ORDER BY (
    SELECT dt.sort_order FROM import_document_types dt WHERE dt.code = r.document_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: Trigger function - auto-update import status when docs verified
-- =============================================================================

CREATE OR REPLACE FUNCTION check_import_docs_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_import_id UUID;
  v_import_status TEXT;
  v_all_required_verified BOOLEAN;
BEGIN
  -- Get import info
  v_import_id := NEW.import_id;

  SELECT status INTO v_import_status
  FROM imports
  WHERE id = v_import_id;

  -- Only auto-transition from DOCS_PENDING
  IF v_import_status != 'DOCS_PENDING' THEN
    RETURN NEW;
  END IF;

  -- Check if all required documents are now verified
  v_all_required_verified := import_has_required_documents(v_import_id);

  -- If all required docs verified, transition to IN_TRANSIT
  IF v_all_required_verified AND NEW.status = 'VERIFIED' THEN
    UPDATE imports
    SET status = 'IN_TRANSIT',
        updated_at = NOW()
    WHERE id = v_import_id;

    -- Log the auto-transition
    INSERT INTO import_status_events (
      tenant_id,
      import_id,
      from_status,
      to_status,
      note,
      changed_by_user_id
    )
    SELECT
      tenant_id,
      v_import_id,
      'DOCS_PENDING',
      'IN_TRANSIT',
      'Automatisk övergång: alla obligatoriska dokument verifierade',
      NEW.verified_by
    FROM imports
    WHERE id = v_import_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_check_import_docs ON import_documents;
CREATE TRIGGER trigger_check_import_docs
  AFTER UPDATE OF status ON import_documents
  FOR EACH ROW
  WHEN (NEW.status = 'VERIFIED')
  EXECUTE FUNCTION check_import_docs_complete();

-- =============================================================================
-- STEP 8: Update state machine transitions in import-service
-- =============================================================================

-- Add comment documenting the expanded transitions
COMMENT ON TABLE imports IS 'Import cases with status flow: NOT_REGISTERED → SUBMITTED → DOCS_PENDING → IN_TRANSIT → CLEARED → APPROVED → CLOSED (or REJECTED at any point)';

-- =============================================================================
-- STEP 9: Indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_import_docs_status ON import_documents(status);
CREATE INDEX IF NOT EXISTS idx_import_docs_type_status ON import_documents(type, status);
CREATE INDEX IF NOT EXISTS idx_import_docs_import_type ON import_documents(import_id, type);

-- =============================================================================
-- STEP 10: RLS for document types (public read)
-- =============================================================================

ALTER TABLE import_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to document types"
  ON import_document_types
  FOR SELECT
  USING (true);

CREATE POLICY "Service role full access to document types"
  ON import_document_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Done!


-- ============================================================================
-- END OF PART 5
