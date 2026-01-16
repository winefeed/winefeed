-- ============================================================================
-- Wine Enrichment Table
-- ============================================================================
-- Purpose: Cache Wine-Searcher "Wine Check" results for normalization
-- Policy: NO PRICE DATA - only canonical name, producer, region, match score
-- ============================================================================

CREATE TYPE match_status_enum AS ENUM (
  'EXACT',      -- Perfect match found
  'FUZZY',      -- Close match found
  'MULTIPLE',   -- Multiple candidates found
  'NOT_FOUND',  -- No match found
  'ERROR'       -- API error
);

CREATE TABLE IF NOT EXISTS wine_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Query parameters (what user searched for)
  query_name TEXT NOT NULL,
  query_vintage TEXT,

  -- Normalized result (allowlist only)
  canonical_name TEXT,
  producer TEXT,
  region TEXT,
  appellation TEXT,
  match_score INTEGER, -- 0-100
  match_status match_status_enum NOT NULL,

  -- Candidates (for MULTIPLE/FUZZY matches)
  -- JSONB array of max 3 objects: { name, producer, region, appellation, score }
  candidates JSONB DEFAULT '[]'::jsonb,

  -- Wine-Searcher ID (optional, for future reference)
  ws_id TEXT,

  -- Cache metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Raw API response (DEV ONLY - never sent to client)
  -- CRITICAL: Must not contain price/offer/currency fields
  raw_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_match_score CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
  CONSTRAINT valid_candidates CHECK (jsonb_array_length(candidates) <= 3)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Lookup by tenant + query (cache hit)
CREATE UNIQUE INDEX idx_wine_enrichment_cache_key
  ON wine_enrichment(tenant_id, query_name, COALESCE(query_vintage, ''));

-- Query by tenant + status
CREATE INDEX idx_wine_enrichment_tenant_status
  ON wine_enrichment(tenant_id, match_status);

-- Cleanup expired entries
CREATE INDEX idx_wine_enrichment_expires
  ON wine_enrichment(expires_at);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE wine_enrichment ENABLE ROW LEVEL SECURITY;

-- Service role full access (for API routes)
CREATE POLICY "Service role full access" ON wine_enrichment FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation (for SELECT queries)
CREATE POLICY "Tenant isolation" ON wine_enrichment FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE wine_enrichment IS
  'Wine-Searcher Wine Check cache - NO PRICE DATA allowed';

COMMENT ON COLUMN wine_enrichment.raw_response IS
  'Raw API response (DEV ONLY) - never sent to client, must not contain price fields';

COMMENT ON COLUMN wine_enrichment.candidates IS
  'Max 3 alternative matches (JSONB array) - only name, producer, region, appellation, score';

-- ============================================================================
-- Cleanup Function (optional - remove expired entries)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_wine_enrichment()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM wine_enrichment
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_wine_enrichment IS
  'Removes expired wine enrichment cache entries. Can be run manually or via cron.';
