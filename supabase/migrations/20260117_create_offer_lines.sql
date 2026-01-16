/**
 * OFFER LINES TABLE - PILOT LOOP 1.0
 *
 * Line items for multi-line offers
 * Each line can be enriched via Wine Check (allowlist fields only)
 *
 * Security: NO PRICE DATA from Wine-Searcher
 * Enrichment allowlist: canonical_name, producer, country, region, appellation, ws_id, match_status, match_score
 * Commercial pricing: offered_unit_price_ore (from supplier, not Wine-Searcher)
 */

CREATE TABLE IF NOT EXISTS offer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

  -- Line ordering
  line_no INTEGER NOT NULL,

  -- Core wine data (user input)
  name TEXT NOT NULL,
  vintage INTEGER NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  bottle_ml INTEGER NULL,
  packaging TEXT NULL,

  -- Commercial pricing (supplier sets this, NOT from Wine-Searcher)
  offered_unit_price_ore INTEGER NULL,  -- Price in öre (100 = 1 SEK), ex VAT

  -- Wine Check enrichment (allowlist only - NO PRICE DATA)
  canonical_name TEXT NULL,
  producer TEXT NULL,
  country TEXT NULL,
  region TEXT NULL,
  appellation TEXT NULL,
  ws_id TEXT NULL,
  match_status TEXT NULL,  -- From Wine Check (e.g., "verified", "suggested")
  match_score INTEGER NULL,  -- 0-100 confidence score

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_offer_line UNIQUE (offer_id, line_no),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_price CHECK (offered_unit_price_ore IS NULL OR offered_unit_price_ore >= 0)
);

-- Indexes for performance
CREATE INDEX idx_offer_lines_tenant_offer ON offer_lines(tenant_id, offer_id);
CREATE INDEX idx_offer_lines_tenant_ws_id ON offer_lines(tenant_id, ws_id);
CREATE INDEX idx_offer_lines_offer ON offer_lines(offer_id);
CREATE INDEX idx_offer_lines_offer_lineno ON offer_lines(offer_id, line_no);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_offer_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_offer_lines_updated_at
  BEFORE UPDATE ON offer_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_lines_updated_at();

COMMENT ON TABLE offer_lines IS 'Line items for multi-line offers with Wine Check enrichment (allowlist only)';
COMMENT ON COLUMN offer_lines.offered_unit_price_ore IS 'Supplier commercial price in öre (NOT from Wine-Searcher)';
COMMENT ON COLUMN offer_lines.canonical_name IS 'Wine Check enrichment: canonical wine name';
COMMENT ON COLUMN offer_lines.match_status IS 'Wine Check match status (verified/suggested)';
COMMENT ON COLUMN offer_lines.match_score IS 'Wine Check confidence score (0-100)';
