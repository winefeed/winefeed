/**
 * RLS POLICIES FOR OFFERS - PILOT LOOP 1.0
 *
 * Multi-tenant security for offers, offer_lines, offer_events
 *
 * MVP policies (can be refined later):
 * - Service role: Full access (API routes use service role)
 * - Tenant isolation: Users can only access offers in their tenant
 * - Restaurant users: Read offers where restaurant_id matches
 * - Supplier users: Read/write offers where supplier_id matches
 */

-- ============================================================================
-- OFFERS TABLE
-- ============================================================================

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offers"
  ON offers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offers"
  ON offers FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- OFFER_LINES TABLE
-- ============================================================================

ALTER TABLE offer_lines ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offer_lines"
  ON offer_lines FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offer_lines"
  ON offer_lines FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- OFFER_EVENTS TABLE
-- ============================================================================

ALTER TABLE offer_events ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes)
CREATE POLICY "Service role full access on offer_events"
  ON offer_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation for direct access
CREATE POLICY "Tenant isolation on offer_events"
  ON offer_events FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- FUTURE: More granular policies
-- ============================================================================
-- TODO: Add policies for restaurant-specific and supplier-specific access
-- For example:
-- - Restaurants can only see offers where restaurant_id = their profile
-- - Suppliers can only see/edit offers where supplier_id = their profile
-- - Requires proper user-to-restaurant/supplier mapping in auth
