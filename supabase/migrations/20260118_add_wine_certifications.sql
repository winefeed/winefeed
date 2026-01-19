-- Add wine certification columns
-- Migration: 20260118_add_wine_certifications.sql
-- Purpose: Add biodynamiskt and veganskt certification columns to wines table

-- Add biodynamiskt column (ekologisk already exists)
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS biodynamiskt BOOLEAN DEFAULT FALSE;

-- Add veganskt column
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS veganskt BOOLEAN DEFAULT FALSE;

-- Create index for certification filtering (compound index for common queries)
CREATE INDEX IF NOT EXISTS idx_wines_certifications
ON wines(ekologisk, biodynamiskt, veganskt)
WHERE ekologisk = TRUE OR biodynamiskt = TRUE OR veganskt = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN wines.ekologisk IS 'Wine is certified organic (already existed)';
COMMENT ON COLUMN wines.biodynamiskt IS 'Wine is certified biodynamic';
COMMENT ON COLUMN wines.veganskt IS 'Wine is certified vegan';

-- Verify columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wines' AND column_name = 'biodynamiskt'
  ) THEN
    RAISE EXCEPTION 'Column biodynamiskt was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wines' AND column_name = 'veganskt'
  ) THEN
    RAISE EXCEPTION 'Column veganskt was not created';
  END IF;

  RAISE NOTICE 'Wine certification columns created successfully';
END $$;
