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
