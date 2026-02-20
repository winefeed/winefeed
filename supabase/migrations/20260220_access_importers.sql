-- ============================================================================
-- VINKOLL ACCESS — Add access_importers table + align access_lots columns
-- Run in Supabase SQL Editor. All statements are idempotent.
-- ============================================================================

-- 1) Create access_importers table
CREATE TABLE IF NOT EXISTS access_importers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Rename is_available → available on access_lots (code expects "available")
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_lots' AND column_name = 'is_available'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_lots' AND column_name = 'available'
  ) THEN
    ALTER TABLE access_lots RENAME COLUMN is_available TO available;
  END IF;
END$$;

-- 3) Add contact_email to access_lots
ALTER TABLE access_lots ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 4) Make importer_name nullable (name now comes from access_importers join)
ALTER TABLE access_lots ALTER COLUMN importer_name DROP NOT NULL;

-- 5) Add FK from access_lots.importer_id → access_importers.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'access_lots_importer_id_fkey'
      AND table_name = 'access_lots'
  ) THEN
    ALTER TABLE access_lots
      ADD CONSTRAINT access_lots_importer_id_fkey
      FOREIGN KEY (importer_id) REFERENCES access_importers(id);
  END IF;
END$$;

-- 6) Helper function: get importer_id for a batch of lot IDs
--    Used by admin request views to resolve lot → importer
CREATE OR REPLACE FUNCTION get_lot_importer_ids(lot_ids UUID[])
RETURNS TABLE(lot_id UUID, importer_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT l.id AS lot_id, l.importer_id
  FROM access_lots l
  WHERE l.id = ANY(lot_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7) Add reminder_sent_at to access_requests (used by cron reminder system)
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 8) Add order_confirmed_at to access_requests
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS order_confirmed_at TIMESTAMPTZ;

-- 9) Seed Brasri AB as importer
INSERT INTO access_importers (name, description, contact_email)
SELECT 'Brasri AB', 'Importör av franska kvalitetsviner', 'corentin@brasri.com'
WHERE NOT EXISTS (
  SELECT 1 FROM access_importers WHERE name = 'Brasri AB'
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
