-- Add language column to readiness_packs
-- Allows scope labels to be sent in producer's language (EN, FR, ES, IT)
ALTER TABLE readiness_packs ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
