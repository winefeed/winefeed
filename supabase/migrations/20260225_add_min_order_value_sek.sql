-- ==========================================================================
-- ADD MIN ORDER VALUE (SEK)
--
-- Allows importers to set a minimum order value in SEK as an alternative
-- to the existing bottle/case minimum. Order is accepted if EITHER
-- threshold is met (OR logic).
--
-- Feedback from pilot importers: most use case count OR monetary threshold.
-- ==========================================================================

ALTER TABLE suppliers
ADD COLUMN min_order_value_sek INTEGER;

COMMENT ON COLUMN suppliers.min_order_value_sek IS 'Minimum order value in SEK (öre). NULL = no value minimum. OR logic with min_order_bottles.';
