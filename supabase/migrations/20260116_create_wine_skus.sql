/**
 * WINE SKUS TABLE
 *
 * Represents sellable wine variants (vintage + bottle size + packaging)
 * A wine_sku is a specific, orderable product.
 *
 * Examples:
 * - "Château Margaux 2015, 750ml bottle" (SKU 1)
 * - "Château Margaux 2015, 6x750ml case" (SKU 2)
 * - "Château Margaux 2016, 750ml bottle" (SKU 3)
 *
 * Relationship:
 * - wine_sku belongs to ONE wine_master
 * - wine_master can have MANY wine_skus
 *
 * Purpose:
 * - Central reference for GTIN identifiers
 * - Inventory/pricing/ordering unit
 * - Foundation for supplier catalog mapping
 */

CREATE TABLE IF NOT EXISTS wine_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Identity (belongs to wine_master)
  wine_master_id UUID NOT NULL REFERENCES wine_masters(id) ON DELETE CASCADE,

  -- Variant attributes
  vintage INTEGER CHECK (vintage IS NULL OR (vintage >= 1800 AND vintage <= 2100)),
  bottle_ml INTEGER CHECK (bottle_ml IS NULL OR bottle_ml > 0),  -- e.g. 750, 1500, 375
  packaging TEXT,  -- e.g. "6x750ml", "12x750ml", "single", "magnum"

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_wine_sku UNIQUE (tenant_id, wine_master_id, COALESCE(vintage, 0), COALESCE(bottle_ml, 0), COALESCE(packaging, ''))
);

-- Indexes
CREATE INDEX idx_wine_skus_tenant ON wine_skus(tenant_id);
CREATE INDEX idx_wine_skus_master ON wine_skus(wine_master_id);
CREATE INDEX idx_wine_skus_tenant_master_vintage ON wine_skus(tenant_id, wine_master_id, vintage, bottle_ml);

-- Comments
COMMENT ON TABLE wine_skus IS 'Sellable wine variants (vintage + bottle size + packaging)';
COMMENT ON COLUMN wine_skus.wine_master_id IS 'Reference to canonical wine identity';
COMMENT ON COLUMN wine_skus.vintage IS 'Wine vintage year (NULL for NV/multi-vintage)';
COMMENT ON COLUMN wine_skus.bottle_ml IS 'Bottle volume in milliliters (750, 1500, etc.)';
COMMENT ON COLUMN wine_skus.packaging IS 'Packaging description (case size, single bottle, etc.)';
