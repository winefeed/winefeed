-- ============================================================================
-- Food Scan Agent — DB Schema
-- 2026-02-20
--
-- Two tables:
-- 1. food_scan_results — scan results per restaurant/source
-- 2. food_pairing_suggestions — suggested + approved pairing overrides
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table 1: food_scan_results
-- Stores scan results from Wolt menus, manual input, or trend sources
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_scan_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  restaurant_name text NOT NULL,
  wolt_slug       text,
  city            text,
  scan_source     text NOT NULL DEFAULT 'wolt' CHECK (scan_source IN ('wolt', 'manual', 'trend')),
  total_dishes    integer NOT NULL DEFAULT 0,
  matched_dishes  integer NOT NULL DEFAULT 0,
  unmatched_dishes integer NOT NULL DEFAULT 0,
  dishes_json     jsonb NOT NULL DEFAULT '[]'::jsonb,
  scanned_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_scan_results_restaurant ON food_scan_results(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_food_scan_results_scanned_at ON food_scan_results(scanned_at DESC);

-- ----------------------------------------------------------------------------
-- Table 2: food_pairing_suggestions
-- Pending suggestions + approved overrides used at runtime
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_pairing_suggestions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_name               text NOT NULL,
  dish_name_original      text,
  source                  text NOT NULL DEFAULT 'wolt' CHECK (source IN ('wolt', 'manual', 'trend')),
  source_detail           text,
  suggested_colors        text[] NOT NULL DEFAULT '{}',
  suggested_regions       text[] NOT NULL DEFAULT '{}',
  suggested_grapes        text[] NOT NULL DEFAULT '{}',
  confidence              real NOT NULL DEFAULT 0.0,
  categorization_method   text,
  status                  text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  approved_colors         text[] NOT NULL DEFAULT '{}',
  approved_regions        text[] NOT NULL DEFAULT '{}',
  approved_grapes         text[] NOT NULL DEFAULT '{}',
  reviewed_by             uuid,
  reviewed_at             timestamptz,
  occurrence_count        integer NOT NULL DEFAULT 1,
  first_seen_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at            timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Unique index for deduplication: one active suggestion per normalized dish name
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_pairing_suggestions_dish
  ON food_pairing_suggestions(dish_name)
  WHERE status NOT IN ('rejected');

CREATE INDEX IF NOT EXISTS idx_food_pairing_suggestions_status ON food_pairing_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_food_pairing_suggestions_occurrence ON food_pairing_suggestions(occurrence_count DESC);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
