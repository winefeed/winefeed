-- Make legacy single-wine columns nullable on offers table.
-- Multi-line offers store price/quantity per line in offer_lines,
-- so the offer header no longer needs these fields.

ALTER TABLE offers ALTER COLUMN offered_price_ex_vat_sek DROP NOT NULL;
ALTER TABLE offers ALTER COLUMN quantity DROP NOT NULL;

-- Drop constraints that assume these are always set
ALTER TABLE offers DROP CONSTRAINT IF EXISTS positive_offered_price;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS positive_quantity;

-- Re-add constraints that allow NULL but enforce > 0 when set
ALTER TABLE offers ADD CONSTRAINT positive_offered_price
  CHECK (offered_price_ex_vat_sek IS NULL OR offered_price_ex_vat_sek > 0);
ALTER TABLE offers ADD CONSTRAINT positive_quantity
  CHECK (quantity IS NULL OR quantity > 0);

COMMENT ON COLUMN offers.offered_price_ex_vat_sek IS 'Legacy: single-wine price. NULL for multi-line offers (see offer_lines).';
COMMENT ON COLUMN offers.quantity IS 'Legacy: single-wine quantity. NULL for multi-line offers (see offer_lines).';
