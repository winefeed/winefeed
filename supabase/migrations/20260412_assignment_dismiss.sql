-- Add dismissed_at to quote_request_assignments
ALTER TABLE quote_request_assignments
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN quote_request_assignments.dismissed_at IS 'When the supplier dismissed/archived this assignment. NULL = active.';
