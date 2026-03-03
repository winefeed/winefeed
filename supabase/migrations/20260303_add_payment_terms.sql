-- Add payment_terms to suppliers (e.g. "30 dagar netto")
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms TEXT;
