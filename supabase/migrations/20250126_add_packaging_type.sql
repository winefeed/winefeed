-- Migration: Add packaging_type to supplier_wines
-- Purpose: Allow suppliers to specify packaging format (bottle, keg, bag-in-box, etc.)

-- Create enum for packaging types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'packaging_type') THEN
    CREATE TYPE packaging_type AS ENUM (
      'bottle',      -- Standard bottle (750ml, 375ml, 1.5L, etc.)
      'keg',         -- Draft/keg (various sizes)
      'bag_in_box',  -- Bag-in-box
      'can',         -- Canned wine
      'tetra',       -- Tetra pak
      'other'        -- Other formats
    );
  END IF;
END$$;

-- Add packaging_type column to supplier_wines
ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS packaging_type packaging_type DEFAULT 'bottle';

-- Add comment
COMMENT ON COLUMN supplier_wines.packaging_type IS
  'Packaging format: bottle (standard), keg (draft), bag_in_box, can, tetra, other';

-- Update existing rows to have explicit bottle type
UPDATE supplier_wines SET packaging_type = 'bottle' WHERE packaging_type IS NULL;
