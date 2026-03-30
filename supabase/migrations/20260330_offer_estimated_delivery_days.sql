-- Add estimated_delivery_days to offers (optional field for supplier to indicate delivery timeline)
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS estimated_delivery_days INTEGER;

COMMENT ON COLUMN offers.estimated_delivery_days IS 'Estimated delivery time in business days from order confirmation';
