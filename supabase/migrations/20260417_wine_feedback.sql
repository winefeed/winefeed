/**
 * WINE FEEDBACK — negative signal from restaurants
 *
 * Restaurants can mark individual wines with structured feedback
 * (too expensive, wrong style, wrong region, already tried). This
 * feeds into the pre-scorer to suppress poor matches over time
 * and gives importers aggregated trend visibility (never per-restaurant).
 */

CREATE TABLE IF NOT EXISTS wine_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  wine_id UUID NOT NULL REFERENCES supplier_wines(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'too_expensive', 'wrong_style', 'wrong_region', 'already_tried', 'other'
  )),
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wine_feedback_restaurant
  ON wine_feedback(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_wine_feedback_wine
  ON wine_feedback(wine_id);

CREATE INDEX IF NOT EXISTS idx_wine_feedback_supplier
  ON wine_feedback(supplier_id);

COMMENT ON TABLE wine_feedback IS 'Structured negative feedback from restaurants on individual wines — powers pre-scorer personalization and aggregated supplier trends';
