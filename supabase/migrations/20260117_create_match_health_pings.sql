/**
 * MATCH HEALTH PINGS TABLE
 *
 * Minimal table for safe write-test in health checks
 * Used to verify database write permissions without touching match_results
 *
 * Policy:
 * - DEV: Allow insert 1 ping per request
 * - PROD: Skip write test entirely (read-only mode)
 */

CREATE TABLE IF NOT EXISTS match_health_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT NULL
);

-- Index for tenant isolation and cleanup queries
CREATE INDEX idx_match_health_pings_tenant ON match_health_pings(tenant_id);
CREATE INDEX idx_match_health_pings_created ON match_health_pings(created_at DESC);

-- Enable RLS
ALTER TABLE match_health_pings ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access (API routes use service role)
CREATE POLICY "Service role full access" ON match_health_pings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Tenant isolation for direct access
CREATE POLICY "Tenant isolation" ON match_health_pings FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

COMMENT ON TABLE match_health_pings IS 'Health check write test table - minimal footprint, safe for dev write tests';
COMMENT ON COLUMN match_health_pings.note IS 'Optional context for health check (e.g., "healthcheck", "status-api")';
