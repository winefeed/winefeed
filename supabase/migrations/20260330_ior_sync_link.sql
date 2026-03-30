-- Link supplier_wines back to source ior_product (for sync tracking)
ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS ior_product_id UUID REFERENCES ior_products(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_wines_ior_product
  ON supplier_wines(ior_product_id) WHERE ior_product_id IS NOT NULL;

-- Link suppliers back to source ior_producer (for sync tracking)
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS ior_producer_id UUID REFERENCES ior_producers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_ior_producer
  ON suppliers(ior_producer_id) WHERE ior_producer_id IS NOT NULL;
