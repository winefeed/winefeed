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
