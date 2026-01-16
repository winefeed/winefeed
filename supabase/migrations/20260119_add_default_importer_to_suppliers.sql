/**
 * MIGRATION: Add default_importer_id to suppliers
 *
 * Purpose: Establish persistent EU-seller → IOR (Importer-of-Record) relationship
 *
 * Changes:
 * - Add suppliers.default_importer_id (nullable FK to importers.id)
 * - Add constraint: EU suppliers (EU_PRODUCER, EU_IMPORTER) must have default_importer_id
 *
 * Business Rule:
 * - SWEDISH_IMPORTER: can operate without IOR (they ARE the importer)
 * - EU_PRODUCER/EU_IMPORTER: MUST have a Swedish IOR assigned
 */

-- Add default_importer_id column (nullable FK to importers table)
ALTER TABLE suppliers
ADD COLUMN default_importer_id UUID NULL REFERENCES importers(id) ON DELETE SET NULL;

-- Create index for FK lookups
CREATE INDEX idx_suppliers_default_importer ON suppliers(default_importer_id);

-- Create index for tenant + type queries (common for EU supplier filtering)
CREATE INDEX idx_suppliers_tenant_type ON suppliers(tenant_id, type);

-- Add constraint: EU suppliers must have default IOR
-- SWEDISH_IMPORTER can operate without (they are their own importer)
ALTER TABLE suppliers
ADD CONSTRAINT eu_requires_default_ior CHECK (
  (type = 'SWEDISH_IMPORTER') OR (default_importer_id IS NOT NULL)
);

-- Comment for documentation
COMMENT ON COLUMN suppliers.default_importer_id IS
  'Default Swedish Importer-of-Record for EU suppliers. Required for EU_PRODUCER and EU_IMPORTER types. NULL for SWEDISH_IMPORTER (they are their own importer).';

-- Validation query (to run after migration)
-- SELECT id, namn, type, default_importer_id
-- FROM suppliers
-- WHERE type IN ('EU_PRODUCER', 'EU_IMPORTER')
-- AND default_importer_id IS NULL;
-- ^ Should return 0 rows after constraint is active
