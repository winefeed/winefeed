-- SUPPLIER ONBOARDING & CATALOG MANAGEMENT
-- Migration: 20260114_supplier_onboarding
-- Purpose: Enable suppliers to onboard, manage catalogs, and respond to quote requests

-- ============================================================================
-- STEP 1: Extend suppliers table with type and compliance fields
-- ============================================================================

-- Add supplier type enum
CREATE TYPE supplier_type AS ENUM (
  'SWEDISH_IMPORTER',  -- Swedish licensed importer (direct sales)
  'EU_PRODUCER',       -- EU-based wine producer
  'EU_IMPORTER'        -- Compliance partner (Brasri-type)
);

-- Extend suppliers table
ALTER TABLE suppliers
ADD COLUMN type supplier_type DEFAULT 'SWEDISH_IMPORTER',
ADD COLUMN org_number TEXT,  -- Swedish org number for SWEDISH_IMPORTER
ADD COLUMN license_number TEXT,  -- Alcohol license number
ADD COLUMN license_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for filtering by type
CREATE INDEX idx_suppliers_type ON suppliers(type);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);

-- ============================================================================
-- STEP 2: Create supplier_users table for authentication (multi-tenant)
-- ============================================================================

CREATE TABLE supplier_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast supplier lookup
CREATE INDEX idx_supplier_users_supplier ON supplier_users(supplier_id);

-- ============================================================================
-- STEP 3: Create supplier_wines table (catalog)
-- ============================================================================

CREATE TABLE supplier_wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Wine details
  name TEXT NOT NULL,
  producer TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  vintage INTEGER,
  grape TEXT,

  -- Pricing (excluding VAT)
  price_ex_vat_sek INTEGER NOT NULL,  -- Integer in öre (100 = 1 SEK)
  vat_rate DECIMAL(4,2) DEFAULT 25.00,  -- 25% VAT standard

  -- Inventory
  stock_qty INTEGER,  -- NULL = unlimited
  min_order_qty INTEGER DEFAULT 6,  -- Minimum bottles per order

  -- Delivery
  lead_time_days INTEGER DEFAULT 3,
  delivery_areas TEXT[],  -- Array of regions/cities, NULL = nationwide

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_price CHECK (price_ex_vat_sek > 0),
  CONSTRAINT valid_vat_rate CHECK (vat_rate >= 0 AND vat_rate <= 100),
  CONSTRAINT positive_min_order CHECK (min_order_qty > 0)
);

-- Indexes for catalog queries
CREATE INDEX idx_supplier_wines_supplier ON supplier_wines(supplier_id);
CREATE INDEX idx_supplier_wines_active ON supplier_wines(is_active);
CREATE INDEX idx_supplier_wines_country ON supplier_wines(country);
CREATE INDEX idx_supplier_wines_price ON supplier_wines(price_ex_vat_sek);

-- ============================================================================
-- STEP 4: Create offers table (supplier responses to quote requests)
-- ============================================================================

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_wine_id UUID NOT NULL REFERENCES supplier_wines(id) ON DELETE CASCADE,

  -- Offer details
  offered_price_ex_vat_sek INTEGER NOT NULL,  -- May differ from catalog price
  vat_rate DECIMAL(4,2) DEFAULT 25.00,
  quantity INTEGER NOT NULL,  -- Number of bottles offered

  -- Delivery commitment
  delivery_date DATE NOT NULL,
  lead_time_days INTEGER NOT NULL,

  -- Optional notes
  notes TEXT,  -- Special conditions, discounts, etc.

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ,  -- Offer validity deadline

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_offered_price CHECK (offered_price_ex_vat_sek > 0),
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- Indexes for offer queries
CREATE INDEX idx_offers_request ON offers(request_id);
CREATE INDEX idx_offers_supplier ON offers(supplier_id);
CREATE INDEX idx_offers_status ON offers(status);

-- ============================================================================
-- STEP 5: Row Level Security (RLS) for multi-tenancy
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE supplier_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Supplier users can only see their own record
CREATE POLICY "Supplier users see own record"
  ON supplier_users FOR ALL
  USING (auth.uid() = id);

-- Supplier users can only see wines from their supplier
CREATE POLICY "Supplier users see own wines"
  ON supplier_wines FOR ALL
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Supplier users can only see/create offers from their supplier
CREATE POLICY "Supplier users see own offers"
  ON offers FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Supplier users create own offers"
  ON offers FOR INSERT
  WITH CHECK (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Restaurants can see offers on their requests
CREATE POLICY "Restaurants see offers on their requests"
  ON offers FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM requests WHERE restaurant_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Helper functions
-- ============================================================================

-- Function to create supplier user on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_supplier_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user metadata indicates supplier role
  IF NEW.raw_user_meta_data->>'user_type' = 'supplier' THEN
    INSERT INTO public.supplier_users (id, supplier_id, role)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'supplier_id')::UUID,
      COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for supplier user creation
CREATE OR REPLACE TRIGGER on_auth_supplier_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'user_type' = 'supplier')
  EXECUTE FUNCTION public.handle_new_supplier_user();

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_wines_updated_at BEFORE UPDATE ON supplier_wines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Sample data constraints validation
-- ============================================================================

-- Ensure Swedish importers don't have EU-specific fields (if added later)
-- This is a placeholder for future compliance fields

COMMENT ON TABLE suppliers IS 'Extended with supplier types for compliance-safe architecture';
COMMENT ON TABLE supplier_users IS 'Multi-tenant authentication for supplier access';
COMMENT ON TABLE supplier_wines IS 'Supplier-managed wine catalog with pricing and inventory';
COMMENT ON TABLE offers IS 'Supplier responses to restaurant quote requests';
