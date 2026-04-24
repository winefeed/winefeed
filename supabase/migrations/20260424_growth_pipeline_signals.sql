-- Growth Pipeline 2.0 — signal tracking + auto-link to restaurants
--
-- Adds three signal fields for LinkedIn/press intel (job changes, post
-- engagement, new openings etc.) and a restaurant_id FK so a lead can be
-- auto-linked to its registered Winefeed account when the contact_email
-- matches an existing restaurant.
--
-- All columns are nullable — no behavioural change for existing 192 rows.

ALTER TABLE restaurant_leads
  ADD COLUMN IF NOT EXISTS signal_type TEXT,
  ADD COLUMN IF NOT EXISTS signal_date DATE,
  ADD COLUMN IF NOT EXISTS signal_context TEXT,
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_leads_email       ON restaurant_leads(contact_email);
CREATE INDEX IF NOT EXISTS idx_restaurant_leads_stale       ON restaurant_leads(last_contact_at);
CREATE INDEX IF NOT EXISTS idx_restaurant_leads_restaurant  ON restaurant_leads(restaurant_id);

COMMENT ON COLUMN restaurant_leads.signal_type    IS 'Type of intent signal: job_change, post_engagement, new_opening, wine_list_update, etc.';
COMMENT ON COLUMN restaurant_leads.signal_date    IS 'When the signal was observed (not when lead was created)';
COMMENT ON COLUMN restaurant_leads.signal_context IS 'Freetext context — LinkedIn post excerpt, article URL, etc.';
COMMENT ON COLUMN restaurant_leads.restaurant_id  IS 'Auto-resolved FK when contact_email matches restaurants.contact_email';
