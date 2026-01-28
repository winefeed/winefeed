-- SUPPLIER PROVORDER (DISCOVERY MODE)
-- Migration: 20260128_supplier_provorder
-- Purpose: Enable suppliers to accept small orders with a flat fee

-- ============================================================================
-- Add provorder fields to suppliers table
-- ============================================================================

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS provorder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS provorder_fee_sek INTEGER DEFAULT 500;

-- Constraint to ensure fee is positive
ALTER TABLE suppliers
ADD CONSTRAINT positive_provorder_fee CHECK (provorder_fee_sek IS NULL OR provorder_fee_sek >= 0);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN suppliers.provorder_enabled IS 'Whether supplier accepts small orders below MOQ with a fee';
COMMENT ON COLUMN suppliers.provorder_fee_sek IS 'Flat fee in SEK for provorder (default 500)';
