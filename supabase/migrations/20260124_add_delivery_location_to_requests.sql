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
