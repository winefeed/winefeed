/**
 * PRODUCT IDENTIFIERS TABLE
 *
 * Multi-tenant registry of product identifiers (GTIN, LWIN, SKUs, etc.)
 * Links external identifiers to internal entities (wine_masters, wine_skus)
 *
 * Purpose:
 * - Central lookup for matching incoming products
 * - Support multiple identifier types per entity
 * - Track identifier provenance (source, issuer, confidence)
 *
 * Identifier Types:
 * - GTIN: Global Trade Item Number (barcode) → wine_sku
 * - LWIN: Liv-ex Wine Identification Number → wine_master
 * - PRODUCER_SKU: Producer's internal SKU → wine_sku or wine_master
 * - IMPORTER_SKU: Importer's internal SKU → wine_sku or wine_master
 * - WS_ID: Wine-Searcher internal ID → wine_master
 *
 * Hierarchy:
 * 1. GTIN (strongest) → wine_sku
 * 2. LWIN (strong) → wine_master
 * 3. PRODUCER_SKU (medium, requires issuer match) → entity
 * 4. IMPORTER_SKU (medium, requires issuer match) → entity
 * 5. WS_ID (weak, for reference) → wine_master
 */

CREATE TABLE IF NOT EXISTS product_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('wine_master', 'wine_sku')),
  entity_id UUID NOT NULL,

  -- Identifier details
  id_type TEXT NOT NULL CHECK (id_type IN ('GTIN', 'LWIN', 'PRODUCER_SKU', 'IMPORTER_SKU', 'WS_ID')),
  id_value TEXT NOT NULL,

  -- Issuer context (for scoped identifiers like PRODUCER_SKU)
  issuer_type TEXT CHECK (issuer_type IS NULL OR issuer_type IN ('producer', 'importer')),
  issuer_id UUID,  -- Reference to suppliers.id or importers.id

  -- Provenance
  source TEXT,  -- 'manual' | 'supplier_csv' | 'wine_searcher' | 'importer_csv'
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_identifier UNIQUE (
    tenant_id,
    id_type,
    id_value,
    COALESCE(issuer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ),

  -- Validation rules
  CONSTRAINT gtin_requires_sku CHECK (
    id_type != 'GTIN' OR entity_type = 'wine_sku'
  ),
  CONSTRAINT lwin_requires_master CHECK (
    id_type != 'LWIN' OR entity_type = 'wine_master'
  ),
  CONSTRAINT producer_sku_requires_issuer CHECK (
    id_type != 'PRODUCER_SKU' OR (issuer_type = 'producer' AND issuer_id IS NOT NULL)
  ),
  CONSTRAINT importer_sku_requires_issuer CHECK (
    id_type != 'IMPORTER_SKU' OR (issuer_type = 'importer' AND issuer_id IS NOT NULL)
  )
);

-- Indexes for fast lookups
CREATE INDEX idx_product_identifiers_tenant ON product_identifiers(tenant_id);
CREATE INDEX idx_product_identifiers_lookup ON product_identifiers(tenant_id, id_type, id_value);
CREATE INDEX idx_product_identifiers_issuer_lookup ON product_identifiers(tenant_id, issuer_id, id_type, id_value);
CREATE INDEX idx_product_identifiers_entity ON product_identifiers(entity_type, entity_id);

-- Comments
COMMENT ON TABLE product_identifiers IS 'Registry of external identifiers mapped to internal wine entities';
COMMENT ON COLUMN product_identifiers.entity_type IS 'Type of entity: wine_master (identity) or wine_sku (sellable variant)';
COMMENT ON COLUMN product_identifiers.entity_id IS 'UUID of wine_master or wine_sku';
COMMENT ON COLUMN product_identifiers.id_type IS 'Type of identifier: GTIN, LWIN, PRODUCER_SKU, IMPORTER_SKU, WS_ID';
COMMENT ON COLUMN product_identifiers.id_value IS 'Actual identifier value (barcode, SKU code, etc.)';
COMMENT ON COLUMN product_identifiers.issuer_type IS 'Who issued this identifier (producer or importer)';
COMMENT ON COLUMN product_identifiers.issuer_id IS 'Reference to suppliers or importers table';
COMMENT ON COLUMN product_identifiers.source IS 'How this identifier was registered (manual, CSV import, Wine-Searcher)';
COMMENT ON COLUMN product_identifiers.confidence IS 'Match confidence 0-1 (1 = certain, <1 = needs review)';
