-- Migration: Add min_order_bottles to suppliers
-- Purpose: Allow suppliers to set a total minimum order (in bottles)
--          that can be fulfilled with any combination of products

-- Add min_order_bottles column
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS min_order_bottles INTEGER DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN suppliers.min_order_bottles IS
  'Total minimum order in bottles across all products (e.g., 90 bottles = 15 cases of 6). NULL means no total minimum.';

-- Example: Banjo Vino with min 90 bottles (can be any combination of their wines)
-- UPDATE suppliers SET min_order_bottles = 90 WHERE namn = 'Banjo Vino';
