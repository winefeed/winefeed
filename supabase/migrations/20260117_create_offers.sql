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
