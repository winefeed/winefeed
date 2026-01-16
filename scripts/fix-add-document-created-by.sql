-- ============================================================================
-- FIX: Add missing created_by column to import_documents table
-- ============================================================================

-- Add created_by column (for user tracking)
ALTER TABLE import_documents
ADD COLUMN IF NOT EXISTS created_by UUID NULL;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'import_documents'
ORDER BY ordinal_position;
