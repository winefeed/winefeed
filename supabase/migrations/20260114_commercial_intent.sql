-- COMMERCIAL INTENT & OFFER ACCEPTANCE
-- Migration: 20260114_commercial_intent
-- Purpose: Enable restaurant to accept offers and create commercial intents

-- ============================================================================
-- STEP 1: Create CommercialIntent table
-- ============================================================================

CREATE TABLE commercial_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  quote_request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  accepted_offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  -- Snapshots at time of acceptance (amounts in öre for precision)
  total_goods_amount_ore INT NOT NULL,       -- Price ex VAT * quantity
  shipping_amount_ore INT DEFAULT 0,         -- Shipping cost (0 in MVP)
  vat_amount_ore INT NOT NULL,               -- Goods * VAT rate
  service_fee_amount_ore INT DEFAULT 0,      -- Winefeed service fee (0 in MVP)
  total_payable_estimate_ore INT NOT NULL,   -- Sum of all above

  -- VAT rate snapshot
  vat_rate DECIMAL(4,2) NOT NULL,            -- e.g., 25.00

  -- Wine details snapshot
  wine_name TEXT NOT NULL,
  wine_producer TEXT NOT NULL,
  quantity INT NOT NULL,

  -- Delivery snapshot
  estimated_delivery_date DATE,
  lead_time_days INT NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),

  -- Metadata
  goods_seller_id UUID NOT NULL REFERENCES suppliers(id),  -- Who sells the wine

  -- Timestamps
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_amounts CHECK (
    total_goods_amount_ore > 0 AND
    vat_amount_ore >= 0 AND
    total_payable_estimate_ore > 0 AND
    quantity > 0
  ),
  CONSTRAINT valid_vat_rate CHECK (vat_rate >= 0 AND vat_rate <= 100),

  -- CRITICAL: Only one accepted offer per quote request
  CONSTRAINT unique_quote_request UNIQUE (quote_request_id)
);

-- Indexes
CREATE INDEX idx_commercial_intents_quote_request ON commercial_intents(quote_request_id);
CREATE INDEX idx_commercial_intents_restaurant ON commercial_intents(restaurant_id);
CREATE INDEX idx_commercial_intents_supplier ON commercial_intents(supplier_id);
CREATE INDEX idx_commercial_intents_status ON commercial_intents(status);

-- ============================================================================
-- STEP 2: Add index to offers table for faster lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_offers_quote_request ON offers(request_id);

-- ============================================================================
-- STEP 3: Enable RLS on CommercialIntent
-- ============================================================================

ALTER TABLE commercial_intents ENABLE ROW LEVEL SECURITY;

-- Restaurants can see their own commercial intents
CREATE POLICY "Restaurants see own commercial intents"
  ON commercial_intents FOR SELECT
  USING (restaurant_id = auth.uid());

-- Suppliers can see commercial intents where they are the supplier
CREATE POLICY "Suppliers see their commercial intents"
  ON commercial_intents FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Only service role can create commercial intents (via API)
-- (No INSERT policy means only service role)

-- ============================================================================
-- STEP 4: Helper functions
-- ============================================================================

-- Function to check if offer can be accepted
CREATE OR REPLACE FUNCTION can_accept_offer(
  p_offer_id UUID,
  p_restaurant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_offer RECORD;
  v_assignment RECORD;
  v_existing_intent UUID;
BEGIN
  -- Get offer details
  SELECT o.*, r.restaurant_id
  INTO v_offer
  FROM offers o
  JOIN requests r ON o.request_id = r.id
  WHERE o.id = p_offer_id;

  -- Offer not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Restaurant doesn't own the quote request
  IF v_offer.restaurant_id != p_restaurant_id THEN
    RETURN FALSE;
  END IF;

  -- Check if assignment exists and is not expired
  SELECT *
  INTO v_assignment
  FROM quote_request_assignments
  WHERE quote_request_id = v_offer.request_id
    AND supplier_id = v_offer.supplier_id;

  -- No assignment found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Assignment expired
  IF v_assignment.expires_at < NOW() OR v_assignment.status = 'EXPIRED' THEN
    RETURN FALSE;
  END IF;

  -- Check if quote request already has a commercial intent
  SELECT id INTO v_existing_intent
  FROM commercial_intents
  WHERE quote_request_id = v_offer.request_id;

  -- Already accepted
  IF FOUND THEN
    RETURN FALSE;
  END IF;

  -- All checks passed
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_accept_offer IS
  'Validates if a restaurant can accept an offer. Checks ownership, assignment validity, and concurrency.';

-- ============================================================================
-- STEP 5: Audit trail
-- ============================================================================

-- Add trigger for updated_at
CREATE TRIGGER update_commercial_intents_updated_at
  BEFORE UPDATE ON commercial_intents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: Comments for documentation
-- ============================================================================

COMMENT ON TABLE commercial_intents IS
  'Represents a restaurants acceptance of a supplier offer. Creates a snapshot of pricing and terms at acceptance time. One per quote request (enforced by UNIQUE constraint).';

COMMENT ON COLUMN commercial_intents.total_goods_amount_ore IS
  'Total cost of goods excluding VAT (price_ex_vat * quantity) in öre';

COMMENT ON COLUMN commercial_intents.vat_amount_ore IS
  'VAT amount calculated from goods amount and VAT rate, in öre';

COMMENT ON COLUMN commercial_intents.service_fee_amount_ore IS
  'Winefeed service fee (0 in MVP, future pricing model)';

COMMENT ON COLUMN commercial_intents.goods_seller_id IS
  'The supplier who actually sells the wine (always supplier_id in MVP, important for compliance)';

COMMENT ON CONSTRAINT unique_quote_request ON commercial_intents IS
  'Ensures only one offer can be accepted per quote request (prevents double-acceptance)';
