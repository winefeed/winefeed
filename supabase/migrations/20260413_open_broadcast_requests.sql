/**
 * OPEN BROADCAST REQUESTS — v1
 *
 * Lets restaurants post a request by category/criteria instead of specific SKUs.
 * Fan-out to all matching suppliers; each supplier proposes wines from their
 * own catalogue. Admin review gate on first version.
 *
 * Changes:
 * 1. requests.request_type TEXT — 'targeted' (default, existing behaviour) | 'open'
 * 2. requests.open_criteria JSONB — structured criteria for open requests
 * 3. requests.status CHECK — add 'PENDING_REVIEW' to allowed values
 *
 * open_criteria shape:
 * {
 *   "color": "white" | "red" | "rose" | "sparkling" | ...,
 *   "appellation": "Chablis" | null,
 *   "region": "Bourgogne" | null,
 *   "country": "France" | null,
 *   "grape": "Chardonnay" | null,
 *   "max_price_ex_vat_sek": 200,
 *   "min_bottles": 12,
 *   "vintage_from": 2022 | null,
 *   "organic": true | false | null,
 *   "biodynamic": true | false | null,
 *   "free_text": "helst ekologiskt, lågt ingrepp"
 * }
 * All fields optional except at least one of color/appellation/region/country/grape.
 */

-- 1. request_type column (targeted | open)
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'targeted'
  CHECK (request_type IN ('targeted', 'open'));

COMMENT ON COLUMN requests.request_type IS 'targeted = specific SKUs chosen by restaurant; open = broadcast by criteria, suppliers propose from their catalogue';

-- 2. open_criteria JSONB (populated for request_type = 'open')
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS open_criteria JSONB;

COMMENT ON COLUMN requests.open_criteria IS 'Structured criteria for open requests — drives supplier fan-out and catalogue filter';

-- 3. Extend status check to include PENDING_REVIEW
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('OPEN', 'ACCEPTED', 'CLOSED', 'CANCELLED', 'PENDING_REVIEW', 'REJECTED'));

COMMENT ON COLUMN requests.status IS 'OPEN (live, suppliers can offer) | PENDING_REVIEW (open request awaiting admin approval) | ACCEPTED | CLOSED | CANCELLED | REJECTED (admin rejected an open request)';

-- 4. Index for admin review queue
CREATE INDEX IF NOT EXISTS idx_requests_pending_review
  ON requests(created_at DESC)
  WHERE status = 'PENDING_REVIEW';

-- 5. Index for open-type listings
CREATE INDEX IF NOT EXISTS idx_requests_type_status
  ON requests(request_type, status);
