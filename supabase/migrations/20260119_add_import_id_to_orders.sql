/**
 * MIGRATION: Add import_id to orders table
 *
 * Purpose: Link orders to import cases for EU compliance tracking
 *
 * Flow:
 * - EU order created → import case auto-created (if DDL available)
 * - Order linked to import case via orders.import_id
 * - IOR can view compliance status (5369, DDL) in order detail
 *
 * Business Rule:
 * - import_id is nullable (not all orders need import case, e.g., Swedish domestic)
 * - EU orders should have import_id (auto-created or manually linked)
 */

-- Add import_id column (nullable FK to imports table)
ALTER TABLE orders
ADD COLUMN import_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL;

-- Create index for FK lookups and filtering
CREATE INDEX idx_orders_import ON orders(import_id);

-- Composite index for tenant + import queries
CREATE INDEX idx_orders_tenant_import ON orders(tenant_id, import_id);

-- Comment for documentation
COMMENT ON COLUMN orders.import_id IS
  'Link to import case for EU compliance tracking. NULL for domestic orders or if import case not yet created. Auto-created for EU orders when DDL is available.';

-- Validation query (to run after migration)
-- SELECT
--   o.id,
--   o.status,
--   o.import_id,
--   s.type as supplier_type,
--   i.status as import_status
-- FROM orders o
-- JOIN suppliers s ON o.seller_supplier_id = s.id
-- LEFT JOIN imports i ON o.import_id = i.id
-- WHERE s.type IN ('EU_PRODUCER', 'EU_IMPORTER')
-- ORDER BY o.created_at DESC
-- LIMIT 20;
