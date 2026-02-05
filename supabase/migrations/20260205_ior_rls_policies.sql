-- IOR Portfolio RLS Policies
-- Enable row-level security for all IOR tables with importer-based tenant isolation

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE ior_producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_trade_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_communication_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ior_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICE ROLE FULL ACCESS (for API routes using service_role key)
-- ============================================================================

CREATE POLICY "Service role full access on ior_producers"
  ON ior_producers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_products"
  ON ior_products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_price_lists"
  ON ior_price_lists FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_price_list_items"
  ON ior_price_list_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_trade_terms"
  ON ior_trade_terms FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_communication_cases"
  ON ior_communication_cases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_case_messages"
  ON ior_case_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_email_threads"
  ON ior_email_threads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ior_audit_log"
  ON ior_audit_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- IOR USER ACCESS (via auth_entity_id helper function)
-- Users can only access data for their own importer
-- ============================================================================

-- ior_producers: IOR users can manage their own producers
CREATE POLICY "IOR users manage own producers"
  ON ior_producers FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_products: IOR users can manage their own products
CREATE POLICY "IOR users manage own products"
  ON ior_products FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_price_lists: IOR users can manage their own price lists
CREATE POLICY "IOR users manage own price lists"
  ON ior_price_lists FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_price_list_items: IOR users can manage items in their price lists
CREATE POLICY "IOR users manage own price list items"
  ON ior_price_list_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_price_lists pl
      WHERE pl.id = ior_price_list_items.price_list_id
      AND pl.importer_id = auth_entity_id('IOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ior_price_lists pl
      WHERE pl.id = ior_price_list_items.price_list_id
      AND pl.importer_id = auth_entity_id('IOR')
    )
  );

-- ior_trade_terms: IOR users can manage their own trade terms
CREATE POLICY "IOR users manage own trade terms"
  ON ior_trade_terms FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_communication_cases: IOR users can manage their own cases
CREATE POLICY "IOR users manage own cases"
  ON ior_communication_cases FOR ALL
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- ior_case_messages: IOR users can manage messages in their cases
CREATE POLICY "IOR users manage own case messages"
  ON ior_case_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c
      WHERE c.id = ior_case_messages.case_id
      AND c.importer_id = auth_entity_id('IOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c
      WHERE c.id = ior_case_messages.case_id
      AND c.importer_id = auth_entity_id('IOR')
    )
  );

-- ior_email_threads: IOR users can manage threads in their cases
CREATE POLICY "IOR users manage own email threads"
  ON ior_email_threads FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c
      WHERE c.id = ior_email_threads.case_id
      AND c.importer_id = auth_entity_id('IOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c
      WHERE c.id = ior_email_threads.case_id
      AND c.importer_id = auth_entity_id('IOR')
    )
  );

-- ior_audit_log: IOR users can only read their own audit log (no write)
CREATE POLICY "IOR users read own audit log"
  ON ior_audit_log FOR SELECT
  TO authenticated
  USING (importer_id = auth_entity_id('IOR'));

-- ============================================================================
-- ADMIN ACCESS (admins can access all IOR data for support/debugging)
-- ============================================================================

CREATE POLICY "Admins read all ior_producers"
  ON ior_producers FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_products"
  ON ior_products FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_price_lists"
  ON ior_price_lists FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_price_list_items"
  ON ior_price_list_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_price_lists pl WHERE pl.id = ior_price_list_items.price_list_id
    )
    AND auth_has_role('ADMIN')
  );

CREATE POLICY "Admins read all ior_trade_terms"
  ON ior_trade_terms FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_communication_cases"
  ON ior_communication_cases FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));

CREATE POLICY "Admins read all ior_case_messages"
  ON ior_case_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c WHERE c.id = ior_case_messages.case_id
    )
    AND auth_has_role('ADMIN')
  );

CREATE POLICY "Admins read all ior_email_threads"
  ON ior_email_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ior_communication_cases c WHERE c.id = ior_email_threads.case_id
    )
    AND auth_has_role('ADMIN')
  );

CREATE POLICY "Admins read all ior_audit_log"
  ON ior_audit_log FOR SELECT
  TO authenticated
  USING (auth_has_role('ADMIN'));
