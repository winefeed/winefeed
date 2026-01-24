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
