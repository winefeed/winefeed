/**
 * MIGRATION: Add concierge mode fields to orders
 *
 * Purpose: Track orders that Winefeed handles on behalf of the customer
 *
 * Use case: During pilot, offer "we handle everything for you" as a feature
 * - Admin marks order as handled_by_winefeed = true
 * - Admin can add notes about what was done
 * - Useful for first customers who want to test without risk
 */

-- Add concierge fields to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS handled_by_winefeed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS concierge_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS concierge_handled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS concierge_handled_by UUID NULL;

-- Index for filtering concierge orders
CREATE INDEX IF NOT EXISTS idx_orders_concierge ON orders(handled_by_winefeed) WHERE handled_by_winefeed = TRUE;

-- Comments
COMMENT ON COLUMN orders.handled_by_winefeed IS 'If true, Winefeed team handles fulfillment on behalf of customer';
COMMENT ON COLUMN orders.concierge_notes IS 'Admin notes about concierge handling (internal only)';
COMMENT ON COLUMN orders.concierge_handled_at IS 'When concierge mode was enabled';
COMMENT ON COLUMN orders.concierge_handled_by IS 'Admin user who enabled concierge mode';
