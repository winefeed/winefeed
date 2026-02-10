-- Migration: Add reminder_sent_at to access_requests
-- Purpose: Track when an importer reminder was sent (for idempotency)

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

NOTIFY pgrst, 'reload schema';
