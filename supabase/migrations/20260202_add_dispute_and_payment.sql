-- ============================================================================
-- ADD DISPUTE AND PAYMENT TRACKING TO ORDERS
-- ============================================================================
-- Dispute: Restaurants can report problems with orders
-- Payment: Track payment status (pending during pilot, manual handling)
-- ============================================================================

-- Dispute fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS dispute_status TEXT DEFAULT 'none'
    CHECK (dispute_status IN ('none', 'reported', 'investigating', 'resolved')),
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS dispute_reported_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT NULL;

-- Payment fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'invoiced', 'paid', 'overdue', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_due_date DATE NULL,
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT NULL;

-- Index for filtering disputed orders
CREATE INDEX IF NOT EXISTS idx_orders_dispute_status ON orders(dispute_status) WHERE dispute_status != 'none';

-- Index for payment status
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

COMMENT ON COLUMN orders.dispute_status IS 'none=OK, reported=problem flagged, investigating=admin looking, resolved=closed';
COMMENT ON COLUMN orders.payment_status IS 'pending=awaiting invoice, invoiced=sent, paid=done, overdue=late, refunded=returned';
