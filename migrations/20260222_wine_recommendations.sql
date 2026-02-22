-- Wine Recommendations (Sommelier Outreach MVP)
-- Stores generated wine recommendation drafts and sent emails

CREATE TABLE wine_recommendations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_result_id    uuid REFERENCES food_scan_results(id) ON DELETE SET NULL,
  restaurant_name   text NOT NULL,
  recommended_wines jsonb NOT NULL DEFAULT '[]',
  email_subject     text,
  email_html        text,
  email_text        text,
  recipient_email   text,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','failed')),
  sent_at           timestamptz,
  resend_id         text,
  dominant_styles   text[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wine_rec_status ON wine_recommendations(status);
CREATE INDEX idx_wine_rec_scan ON wine_recommendations(scan_result_id);
