/**
 * MATCH RESULTS TABLE
 *
 * Audit trail for all product matching operations
 * Tracks how incoming products were matched to internal entities
 *
 * Purpose:
 * - Debuggability: trace why a match was made
 * - Quality control: review low-confidence matches
 * - Analytics: understand matching patterns
 * - Audit: compliance and traceability
 *
 * Match Methods (Hierarchy):
 * 1. GTIN_EXACT - GTIN barcode exact match
 * 2. LWIN_EXACT - LWIN identifier exact match
 * 3. SKU_EXACT - Producer/Importer SKU exact match
 * 4. CANONICAL_SUGGEST - Wine-Searcher canonicalization fallback
 * 5. MANUAL - User manually linked
 *
 * Match Status:
 * - AUTO_MATCH: High confidence, auto-accepted
 * - AUTO_MATCH_WITH_GUARDS: Medium confidence, auto-accepted with validation
 * - SUGGESTED: Low-medium confidence, needs review
 * - CONFIRMED: User confirmed suggested match
 * - REJECTED: User rejected match
 */

CREATE TYPE match_method_enum AS ENUM (
  'GTIN_EXACT',
  'LWIN_EXACT',
  'SKU_EXACT',
  'CANONICAL_SUGGEST',
  'MANUAL',
  'NO_MATCH'
);

CREATE TYPE match_status_enum AS ENUM (
  'AUTO_MATCH',
  'AUTO_MATCH_WITH_GUARDS',
  'SUGGESTED',
  'CONFIRMED',
  'REJECTED',
  'PENDING_REVIEW'
);

CREATE TABLE IF NOT EXISTS match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Source (what triggered this match attempt)
  source_type TEXT NOT NULL CHECK (source_type IN ('supplier_import_row', 'offer_line', 'importcase_line', 'manual')),
  source_id UUID NOT NULL,

  -- Match result
  matched_entity_type TEXT CHECK (matched_entity_type IS NULL OR matched_entity_type IN ('wine_sku', 'wine_master')),
  matched_entity_id UUID,

  -- Match metadata
  match_method match_method_enum NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status match_status_enum NOT NULL,

  -- Explanation (human-readable reason)
  explanation TEXT,

  -- Candidates (top alternatives, max 5)
  candidates JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT match_requires_entity CHECK (
    (status IN ('AUTO_MATCH', 'AUTO_MATCH_WITH_GUARDS', 'CONFIRMED') AND matched_entity_id IS NOT NULL)
    OR
    (status IN ('SUGGESTED', 'REJECTED', 'PENDING_REVIEW'))
  ),
  CONSTRAINT candidates_array CHECK (
    candidates IS NULL OR jsonb_typeof(candidates) = 'array'
  )
);

-- Indexes
CREATE INDEX idx_match_results_tenant ON match_results(tenant_id);
CREATE INDEX idx_match_results_source ON match_results(tenant_id, source_type, source_id);
CREATE INDEX idx_match_results_status ON match_results(tenant_id, status);
CREATE INDEX idx_match_results_method ON match_results(tenant_id, match_method);
CREATE INDEX idx_match_results_entity ON match_results(matched_entity_type, matched_entity_id);

-- Comments
COMMENT ON TABLE match_results IS 'Audit trail for product matching operations';
COMMENT ON COLUMN match_results.source_type IS 'What triggered this match: supplier_import_row, offer_line, importcase_line, manual';
COMMENT ON COLUMN match_results.source_id IS 'UUID of the source entity';
COMMENT ON COLUMN match_results.matched_entity_type IS 'Type of matched entity: wine_sku or wine_master';
COMMENT ON COLUMN match_results.matched_entity_id IS 'UUID of matched wine_sku or wine_master';
COMMENT ON COLUMN match_results.match_method IS 'How the match was found: GTIN_EXACT, LWIN_EXACT, SKU_EXACT, etc.';
COMMENT ON COLUMN match_results.confidence IS 'Match confidence 0-1 (1 = certain, <1 = review recommended)';
COMMENT ON COLUMN match_results.status IS 'Match status: AUTO_MATCH, SUGGESTED, CONFIRMED, REJECTED, etc.';
COMMENT ON COLUMN match_results.explanation IS 'Human-readable explanation of why this match was made';
COMMENT ON COLUMN match_results.candidates IS 'Top alternative matches (max 5) as JSON array';
