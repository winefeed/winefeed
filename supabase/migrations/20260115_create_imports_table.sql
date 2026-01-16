-- Create imports table and import_status enum
-- This table represents import cases linking restaurant + importer + delivery location

CREATE TYPE import_status AS ENUM (
  'NOT_REGISTERED',
  'SUBMITTED',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core relationships
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  delivery_location_id UUID NOT NULL REFERENCES direct_delivery_locations(id) ON DELETE CASCADE,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Status workflow
  status import_status NOT NULL DEFAULT 'NOT_REGISTERED',

  -- Audit
  created_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_imports_tenant_restaurant ON imports(tenant_id, restaurant_id);
CREATE INDEX idx_imports_tenant_status ON imports(tenant_id, status);
CREATE INDEX idx_imports_tenant_created ON imports(tenant_id, created_at);
CREATE INDEX idx_imports_restaurant ON imports(restaurant_id);
CREATE INDEX idx_imports_importer ON imports(importer_id);
CREATE INDEX idx_imports_delivery_location ON imports(delivery_location_id);

COMMENT ON TABLE imports IS 'Import cases linking restaurant + importer + delivery location';
