-- Add price_sek column to access_wines (numeric, nullable)
ALTER TABLE access_wines ADD COLUMN IF NOT EXISTS price_sek NUMERIC(10,2);

NOTIFY pgrst, 'reload schema';
