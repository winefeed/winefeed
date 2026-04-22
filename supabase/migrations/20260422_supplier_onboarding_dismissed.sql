/**
 * Document the suppliers.onboarding_dismissed_at column used by the
 * supplier dashboard to persist the "dismissed onboarding banner" state
 * across devices (previously localStorage only).
 *
 * Column was added directly in prod before this migration existed —
 * this file is idempotent so it's safe to run in any environment
 * (fresh setup creates it, existing prod is a no-op).
 */

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN suppliers.onboarding_dismissed_at IS
  'Timestamp when the supplier dismissed the onboarding banner on the dashboard. NULL = still showing.';
