/**
 * RLS POLICIES FOR CORE TABLES
 *
 * Adds user-facing (authenticated) RLS policies to tables that previously
 * only had service_role access. Enables migration from service_role key
 * to anon key + session cookies in API routes.
 *
 * Uses existing helper functions:
 *   auth_has_role(text) -> boolean
 *   auth_entity_id(text) -> uuid
 *   auth_has_entity_access(text, uuid) -> boolean
 *
 * Policies are ADDITIVE — existing service_role policies are unaffected.
 */

-- ============================================================================
-- RESTAURANTS
-- ============================================================================

-- Restaurant users manage their own restaurant
CREATE POLICY "Restaurant users manage own restaurant"
  ON restaurants FOR ALL
  TO authenticated
  USING (id = auth_entity_id('RESTAURANT'))
  WITH CHECK (id = auth_entity_id('RESTAURANT'));

-- Admins manage all restaurants
CREATE POLICY "Admins manage all restaurants"
  ON restaurants FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- Sellers can read restaurants (needed for offer/request context)
CREATE POLICY "Sellers read restaurants"
  ON restaurants FOR SELECT
  TO authenticated
  USING (auth_has_role('SELLER'));

-- ============================================================================
-- SUPPLIERS
-- ============================================================================

-- Seller users manage their own supplier
CREATE POLICY "Seller users manage own supplier"
  ON suppliers FOR ALL
  TO authenticated
  USING (id = auth_entity_id('SELLER'))
  WITH CHECK (id = auth_entity_id('SELLER'));

-- Admins manage all suppliers
CREATE POLICY "Admins manage all suppliers"
  ON suppliers FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- Restaurant users can read suppliers (needed for offer/request context)
CREATE POLICY "Restaurant users read suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (auth_has_role('RESTAURANT'));

-- ============================================================================
-- SUPPLIER_WINES
-- ============================================================================

-- Seller users manage their own wines (SELECT policy may already exist — add write)
CREATE POLICY "Seller users manage own wines"
  ON supplier_wines FOR ALL
  TO authenticated
  USING (supplier_id = auth_entity_id('SELLER'))
  WITH CHECK (supplier_id = auth_entity_id('SELLER'));

-- Admins manage all wines
CREATE POLICY "Admins manage all supplier_wines"
  ON supplier_wines FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- Restaurant users can read wines (browse catalog)
CREATE POLICY "Restaurant users read supplier wines"
  ON supplier_wines FOR SELECT
  TO authenticated
  USING (auth_has_role('RESTAURANT'));

-- ============================================================================
-- REQUESTS
-- ============================================================================

-- Restaurant users manage their own requests
CREATE POLICY "Restaurant users manage own requests"
  ON requests FOR ALL
  TO authenticated
  USING (restaurant_id = auth_entity_id('RESTAURANT'))
  WITH CHECK (restaurant_id = auth_entity_id('RESTAURANT'));

-- Sellers can read requests they are assigned to (via quote_request_assignments)
CREATE POLICY "Sellers read assigned requests"
  ON requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quote_request_assignments qra
      WHERE qra.quote_request_id = requests.id
      AND qra.supplier_id = auth_entity_id('SELLER')
    )
  );

-- Admins manage all requests
CREATE POLICY "Admins manage all requests"
  ON requests FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- REQUEST_ITEMS
-- ============================================================================

-- Restaurant users manage items on their own requests
CREATE POLICY "Restaurant users manage own request items"
  ON request_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_items.request_id
      AND r.restaurant_id = auth_entity_id('RESTAURANT')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_items.request_id
      AND r.restaurant_id = auth_entity_id('RESTAURANT')
    )
  );

-- Sellers can read request items for assigned requests
CREATE POLICY "Sellers read assigned request items"
  ON request_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quote_request_assignments qra
      WHERE qra.quote_request_id = request_items.request_id
      AND qra.supplier_id = auth_entity_id('SELLER')
    )
  );

-- Admins manage all request items
CREATE POLICY "Admins manage all request items"
  ON request_items FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- REQUEST_EVENTS
-- ============================================================================

-- Restaurant users read events on their own requests
CREATE POLICY "Restaurant users read own request events"
  ON request_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_events.request_id
      AND r.restaurant_id = auth_entity_id('RESTAURANT')
    )
  );

-- Admins read all request events
CREATE POLICY "Admins read all request events"
  ON request_events FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- OFFERS
-- ============================================================================

-- Sellers manage their own offers
CREATE POLICY "Sellers manage own offers"
  ON offers FOR ALL
  TO authenticated
  USING (supplier_id = auth_entity_id('SELLER'))
  WITH CHECK (supplier_id = auth_entity_id('SELLER'));

-- Restaurant users read offers on their requests
CREATE POLICY "Restaurant users read own offers"
  ON offers FOR SELECT
  TO authenticated
  USING (restaurant_id = auth_entity_id('RESTAURANT'));

-- Admins manage all offers
CREATE POLICY "Admins manage all offers"
  ON offers FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- OFFER_LINES
-- ============================================================================

-- Sellers manage lines on their own offers
CREATE POLICY "Sellers manage own offer lines"
  ON offer_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers o
      WHERE o.id = offer_lines.offer_id
      AND o.supplier_id = auth_entity_id('SELLER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offers o
      WHERE o.id = offer_lines.offer_id
      AND o.supplier_id = auth_entity_id('SELLER')
    )
  );

-- Restaurant users read lines on offers to them
CREATE POLICY "Restaurant users read own offer lines"
  ON offer_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers o
      WHERE o.id = offer_lines.offer_id
      AND o.restaurant_id = auth_entity_id('RESTAURANT')
    )
  );

-- Admins manage all offer lines
CREATE POLICY "Admins manage all offer lines"
  ON offer_lines FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- OFFER_EVENTS
-- ============================================================================

-- Sellers read events on their own offers
CREATE POLICY "Sellers read own offer events"
  ON offer_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers o
      WHERE o.id = offer_events.offer_id
      AND o.supplier_id = auth_entity_id('SELLER')
    )
  );

-- Restaurant users read events on offers to them
CREATE POLICY "Restaurant users read own offer events"
  ON offer_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers o
      WHERE o.id = offer_events.offer_id
      AND o.restaurant_id = auth_entity_id('RESTAURANT')
    )
  );

-- Admins read all offer events
CREATE POLICY "Admins read all offer events"
  ON offer_events FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- ORDERS
-- ============================================================================

-- Restaurant users read their own orders
CREATE POLICY "Restaurant users read own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (restaurant_id = auth_entity_id('RESTAURANT'));

-- Sellers read orders where they are the seller
CREATE POLICY "Sellers read own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (seller_supplier_id = auth_entity_id('SELLER'));

-- Admins manage all orders
CREATE POLICY "Admins manage all orders"
  ON orders FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- ORDER_LINES
-- ============================================================================

-- Restaurant users read lines on their own orders
CREATE POLICY "Restaurant users read own order lines"
  ON order_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_lines.order_id
      AND o.restaurant_id = auth_entity_id('RESTAURANT')
    )
  );

-- Sellers read lines on their orders
CREATE POLICY "Sellers read own order lines"
  ON order_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_lines.order_id
      AND o.seller_supplier_id = auth_entity_id('SELLER')
    )
  );

-- Admins manage all order lines
CREATE POLICY "Admins manage all order lines"
  ON order_lines FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- ORDER_EVENTS
-- ============================================================================

-- Restaurant users read events on their own orders
CREATE POLICY "Restaurant users read own order events"
  ON order_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_events.order_id
      AND o.restaurant_id = auth_entity_id('RESTAURANT')
    )
  );

-- Sellers read events on their orders
CREATE POLICY "Sellers read own order events"
  ON order_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_events.order_id
      AND o.seller_supplier_id = auth_entity_id('SELLER')
    )
  );

-- Admins read all order events
CREATE POLICY "Admins read all order events"
  ON order_events FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- RESTAURANT_DELIVERY_ADDRESSES
-- ============================================================================

-- Restaurant users manage their own addresses
CREATE POLICY "Restaurant users manage own addresses"
  ON restaurant_delivery_addresses FOR ALL
  TO authenticated
  USING (restaurant_id = auth_entity_id('RESTAURANT'))
  WITH CHECK (restaurant_id = auth_entity_id('RESTAURANT'));

-- Admins manage all addresses
CREATE POLICY "Admins manage all addresses"
  ON restaurant_delivery_addresses FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

-- Sellers read their own subscriptions
CREATE POLICY "Sellers read own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (supplier_id = auth_entity_id('SELLER'));

-- Admins manage all subscriptions
CREATE POLICY "Admins manage all subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- SUPPLIER_USERS (add manage policy — SELECT already exists)
-- ============================================================================

-- Supplier users read their own supplier's users
CREATE POLICY "Supplier users read own supplier users"
  ON supplier_users FOR SELECT
  TO authenticated
  USING (supplier_id = auth_entity_id('SELLER'));

-- ============================================================================
-- RESTAURANT_USERS
-- ============================================================================

-- Restaurant users read their own restaurant's users
CREATE POLICY "Restaurant users read own restaurant users"
  ON restaurant_users FOR SELECT
  TO authenticated
  USING (restaurant_id = auth_entity_id('RESTAURANT'));

-- Admins read all restaurant users
CREATE POLICY "Admins read all restaurant users"
  ON restaurant_users FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- IMPORTERS (needed by IOR and supplier contexts)
-- ============================================================================

-- IOR users read their own importer
CREATE POLICY "IOR users read own importer"
  ON importers FOR SELECT
  TO authenticated
  USING (id = auth_entity_id('IOR'));

-- Admins manage all importers
CREATE POLICY "Admins manage all importers"
  ON importers FOR ALL
  TO authenticated
  USING (auth_has_role('ADMIN'));

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_offers_supplier_id ON offers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_offers_restaurant_id ON offers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_offer_lines_offer_id ON offer_lines(offer_id);
CREATE INDEX IF NOT EXISTS idx_qra_supplier ON quote_request_assignments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_events_request_id ON request_events(request_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
