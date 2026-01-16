/**
 * MIGRATION: Create orders + order_lines + order_events tables
 *
 * Purpose: Enable operational fulfillment tracking for accepted offers
 *
 * Flow:
 * 1. Offer ACCEPTED → order created (snapshot of offer)
 * 2. IOR manages order fulfillment via status updates
 * 3. order_events provides audit trail
 *
 * Key Relationships:
 * - orders.offer_id → offers.id (source of truth)
 * - orders.seller_supplier_id → suppliers.id (who sells the wine)
 * - orders.importer_of_record_id → importers.id (who handles import/fulfillment)
 * - order_lines: snapshot of offer_lines at acceptance time
 */

-- ============================================================================
-- ORDER STATUS ENUM
-- ============================================================================

CREATE TYPE order_status AS ENUM (
  'CONFIRMED',       -- Order created from accepted offer (initial state)
  'IN_FULFILLMENT',  -- IOR has started fulfillment process
  'SHIPPED',         -- IOR has shipped the order
  'DELIVERED',       -- Restaurant confirmed receipt
  'CANCELLED'        -- Order cancelled (exceptional case)
);

COMMENT ON TYPE order_status IS 'Order fulfillment status lifecycle';

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core relationships
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  request_id UUID NULL REFERENCES requests(id) ON DELETE SET NULL,

  -- Operational roles
  seller_supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  importer_of_record_id UUID NOT NULL REFERENCES importers(id) ON DELETE RESTRICT,

  -- Delivery (optional link to import case/DDL)
  delivery_location_id UUID NULL REFERENCES direct_delivery_locations(id) ON DELETE SET NULL,
  import_case_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL,

  -- Status tracking
  status order_status NOT NULL DEFAULT 'CONFIRMED',

  -- Snapshot metadata (from offer at acceptance time)
  total_lines INTEGER NOT NULL DEFAULT 0,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SEK',

  -- Audit
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_total_lines CHECK (total_lines >= 0),
  CONSTRAINT valid_total_quantity CHECK (total_quantity >= 0)
);

-- Indexes for common queries
CREATE INDEX idx_orders_tenant_restaurant ON orders(tenant_id, restaurant_id);
CREATE INDEX idx_orders_tenant_seller ON orders(tenant_id, seller_supplier_id);
CREATE INDEX idx_orders_tenant_ior ON orders(tenant_id, importer_of_record_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_offer ON orders(offer_id);
CREATE INDEX idx_orders_request ON orders(request_id);

-- Composite index for IOR console queries (most common)
CREATE INDEX idx_orders_ior_status_created ON orders(importer_of_record_id, status, created_at DESC);

COMMENT ON TABLE orders IS 'Operational orders created from accepted offers, managed by IOR for fulfillment';
COMMENT ON COLUMN orders.seller_supplier_id IS 'Supplier selling the wine (owns the assortment)';
COMMENT ON COLUMN orders.importer_of_record_id IS 'Swedish IOR responsible for import/compliance/fulfillment';
COMMENT ON COLUMN orders.import_case_id IS 'Optional link to 5369 import case (if EU direct delivery)';

-- ============================================================================
-- ORDER LINES TABLE (snapshot of offer_lines)
-- ============================================================================

CREATE TABLE order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Parent order
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Wine reference (snapshot from offer_line)
  wine_sku_id UUID NULL REFERENCES wine_skus(id) ON DELETE SET NULL,
  wine_master_id UUID NULL REFERENCES wine_masters(id) ON DELETE SET NULL,

  -- Wine details (denormalized snapshot for history)
  wine_name TEXT NOT NULL,
  producer TEXT,
  vintage TEXT,
  country TEXT,
  region TEXT,
  article_number TEXT,

  -- Quantities
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'flaska',

  -- Pricing (internal - offer prices, NOT WS market prices)
  unit_price_sek DECIMAL(10,2),
  total_price_sek DECIMAL(10,2),

  -- Metadata
  line_number INTEGER NOT NULL,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_unit_price CHECK (unit_price_sek IS NULL OR unit_price_sek >= 0),
  CONSTRAINT valid_total_price CHECK (total_price_sek IS NULL OR total_price_sek >= 0),
  CONSTRAINT valid_line_number CHECK (line_number > 0)
);

-- Indexes
CREATE INDEX idx_order_lines_tenant ON order_lines(tenant_id);
CREATE INDEX idx_order_lines_order ON order_lines(order_id, line_number);
CREATE INDEX idx_order_lines_wine_sku ON order_lines(wine_sku_id);
CREATE INDEX idx_order_lines_wine_master ON order_lines(wine_master_id);

COMMENT ON TABLE order_lines IS 'Line items snapshot from offer at acceptance time';
COMMENT ON COLUMN order_lines.wine_name IS 'Denormalized wine name for history (even if SKU deleted)';
COMMENT ON COLUMN order_lines.unit_price_sek IS 'Internal offer price (NOT WS market price)';

-- ============================================================================
-- ORDER EVENTS TABLE (audit trail)
-- ============================================================================

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Parent order
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL,

  -- Status transition (if applicable)
  from_status TEXT,
  to_status TEXT,

  -- Event details
  note TEXT,
  metadata JSONB,

  -- Actor
  actor_user_id UUID NULL,
  actor_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_events_tenant ON order_events(tenant_id);
CREATE INDEX idx_order_events_order ON order_events(order_id, created_at DESC);
CREATE INDEX idx_order_events_type ON order_events(event_type);
CREATE INDEX idx_order_events_created ON order_events(created_at DESC);

COMMENT ON TABLE order_events IS 'Audit trail for all order actions (status changes, updates, etc)';
COMMENT ON COLUMN order_events.event_type IS 'Event type: ORDER_CREATED, STATUS_CHANGED, SHIPMENT_UPDATED, etc';
COMMENT ON COLUMN order_events.metadata IS 'Additional event data (e.g., tracking_number, shipment_details)';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON orders FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON order_lines FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON order_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Tenant isolation (if using custom JWT claims)
CREATE POLICY "Tenant isolation" ON orders FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation" ON order_lines FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation" ON order_events FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- VALIDATION QUERIES (to run after migration)
-- ============================================================================

-- Check that orders table is ready
-- SELECT COUNT(*) FROM orders;

-- Check indexes exist
-- SELECT indexname FROM pg_indexes WHERE tablename = 'orders';

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('orders', 'order_lines', 'order_events');
