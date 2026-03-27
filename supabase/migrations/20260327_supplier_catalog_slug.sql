-- Add catalog_slug for vanity URLs (e.g., /brasri instead of /catalog/uuid)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS catalog_slug TEXT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_catalog_slug
  ON suppliers (catalog_slug) WHERE catalog_slug IS NOT NULL;

-- Seed Brasri's slug
UPDATE suppliers SET catalog_slug = 'brasri' WHERE name ILIKE '%brasri%';
