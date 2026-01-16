/**
 * ADD INDEX FOR EFFICIENT LATEST MATCH LOOKUP
 *
 * Purpose: Enable efficient queries for "latest match per source"
 * Used by: GET /api/offers/[id] to fetch latest_match per offer_line
 *
 * Query pattern:
 * SELECT DISTINCT ON (source_id) *
 * FROM match_results
 * WHERE tenant_id = ? AND source_type = 'offer_line' AND source_id IN (...)
 * ORDER BY source_id, created_at DESC;
 *
 * This index supports the ORDER BY created_at DESC for fast retrieval
 */

-- Add index for (tenant_id, source_type, source_id, created_at DESC)
-- Note: Keep existing idx_match_results_source as it's still useful for other queries
CREATE INDEX IF NOT EXISTS idx_match_results_source_created
  ON match_results(tenant_id, source_type, source_id, created_at DESC);

-- Comment
COMMENT ON INDEX idx_match_results_source_created IS 'Efficient lookup of latest match per source (DISTINCT ON pattern)';
