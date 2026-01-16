/**
 * WINE MASTERS TABLE
 *
 * Represents canonical wine identity (NOT a sellable variant)
 * A wine_master is the "Platonic ideal" of a wine - its core identity.
 *
 * Examples:
 * - "Château Margaux" from Bordeaux
 * - "Barolo Cannubi" from Piedmont
 *
 * NOT: vintage-specific or bottle-size-specific (those are wine_skus)
 *
 * Purpose:
 * - Central reference for LWIN identifiers
 * - Canonical naming authority
 * - Foundation for matching/deduplication
 */

CREATE TABLE IF NOT EXISTS wine_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core identity (from Wine-Searcher or manual)
  canonical_name TEXT,
  producer TEXT,
  country TEXT,
  region TEXT,
  appellation TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wine_masters_tenant ON wine_masters(tenant_id);
CREATE INDEX idx_wine_masters_canonical ON wine_masters(tenant_id, canonical_name);
CREATE INDEX idx_wine_masters_producer ON wine_masters(tenant_id, producer);

-- Comments
COMMENT ON TABLE wine_masters IS 'Canonical wine identities (not sellable variants)';
COMMENT ON COLUMN wine_masters.canonical_name IS 'Normalized wine name from Wine-Searcher or manual entry';
COMMENT ON COLUMN wine_masters.producer IS 'Canonical producer name';
COMMENT ON COLUMN wine_masters.region IS 'Wine region (e.g. Bordeaux, Tuscany)';
COMMENT ON COLUMN wine_masters.appellation IS 'Specific appellation/denomination (e.g. Margaux, Barolo DOCG)';
