-- Add status column to access_wines
-- Default ACTIVE so existing wines remain visible. Admin UI defaults to DRAFT for new wines.
ALTER TABLE access_wines ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_access_wines_status ON access_wines (status);

NOTIFY pgrst, 'reload schema';
