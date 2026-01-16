/**
 * ADD TENANT_ID TO RESTAURANTS - ROBUST TENANT SCOPING
 *
 * Purpose: Enable proper tenant scoping for requests via restaurants
 * Flow: requests → restaurants → tenant_id (instead of indirect via offers)
 *
 * Changes:
 * 1. Add tenant_id column to restaurants
 * 2. Create index for performance
 * 3. Set default tenant for existing restaurants (MVP single-tenant)
 *
 * Security:
 * - Enables robust tenant scoping: requests JOIN restaurants WHERE tenant_id = X
 * - No dependency on offers for request visibility
 * - Prevents cross-tenant request leakage
 */

-- Step 1: Add tenant_id column to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- Step 2: Create index for efficient tenant filtering
CREATE INDEX IF NOT EXISTS idx_restaurants_tenant ON restaurants(tenant_id);

-- Step 3: Add comment
COMMENT ON COLUMN restaurants.tenant_id IS 'Tenant isolation for multi-tenant platform - enables secure request scoping';

-- Step 4: Future: Remove default after data migration
-- After all restaurants have proper tenant_id assigned:
-- ALTER TABLE restaurants ALTER COLUMN tenant_id DROP DEFAULT;
