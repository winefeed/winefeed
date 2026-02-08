-- Offer Email Tracking for Pilot
-- Adds columns for idempotent email sending (decline + pending reminders)

-- Add declined_email_sent_at column
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS declined_email_sent_at TIMESTAMPTZ;

-- Add reminder_sent_at column for pending offer reminders
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Index for efficient reminder queries (find offers pending > 48h without reminder)
CREATE INDEX IF NOT EXISTS idx_offers_pending_reminder
ON offers (created_at, status, reminder_sent_at)
WHERE status IN ('SENT', 'VIEWED') AND reminder_sent_at IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
