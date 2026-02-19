-- Supplier catalog sharing: public shareable catalog via token
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS catalog_token UUID DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS catalog_shared BOOLEAN DEFAULT FALSE NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_catalog_token ON suppliers (catalog_token) WHERE catalog_token IS NOT NULL;
NOTIFY pgrst, 'reload schema';
