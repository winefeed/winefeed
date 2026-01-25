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
