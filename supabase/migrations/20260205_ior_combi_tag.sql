-- Add combi_tag to ior_producers
-- Enables grouping producers for combined orders to reach MOQ easier

ALTER TABLE ior_producers
ADD COLUMN IF NOT EXISTS combi_tag VARCHAR(100);

-- Index for filtering by combi
CREATE INDEX IF NOT EXISTS idx_ior_producers_combi ON ior_producers(combi_tag)
WHERE combi_tag IS NOT NULL;

COMMENT ON COLUMN ior_producers.combi_tag IS 'Tag for grouping producers - customers can combine orders across producers with same tag to reach MOQ';
