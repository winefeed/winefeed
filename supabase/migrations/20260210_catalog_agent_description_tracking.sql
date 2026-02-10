-- Catalog Agent: Description source tracking
-- Tracks whether a wine description was manually entered or AI-generated

ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS description_source TEXT DEFAULT 'manual'
  CHECK (description_source IN ('manual', 'ai'));

ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS description_original TEXT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
