-- PART 8 — Continue from: -- SECTION: 20260205_ior_rls_policies.sql

-- SECTION: 20260205_ior_rls_policies.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 20260208_offer_email_tracking.sql
-- ============================================================================

-- Offer Email Tracking for Pilot
-- Adds columns for idempotent email sending (decline + pending reminders)

-- Add declined_email_sent_at column
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS declined_email_sent_at TIMESTAMPTZ;

-- Add reminder_sent_at column for pending offer reminders
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Index for efficient reminder queries (find offers pending > 48h without reminder)
CREATE INDEX IF NOT EXISTS idx_offers_pending_reminder
ON offers (created_at, status, reminder_sent_at)
WHERE status IN ('SENT', 'VIEWED') AND reminder_sent_at IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- SECTION: 20260208_restaurant_billing_fields.sql
-- ============================================================================

-- Add billing fields to restaurants table
-- These fields allow restaurants to specify separate billing contact and address

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS billing_contact_person text,
ADD COLUMN IF NOT EXISTS billing_contact_phone text,
ADD COLUMN IF NOT EXISTS billing_address text,
ADD COLUMN IF NOT EXISTS billing_postal_code text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS billing_reference text;

-- Add comments for documentation
COMMENT ON COLUMN restaurants.billing_email IS 'Email address for invoices (if different from main email)';
COMMENT ON COLUMN restaurants.billing_contact_person IS 'Contact person for billing/finance questions';
COMMENT ON COLUMN restaurants.billing_contact_phone IS 'Phone number for billing contact';
COMMENT ON COLUMN restaurants.billing_address IS 'Billing address if different from restaurant address';
COMMENT ON COLUMN restaurants.billing_postal_code IS 'Billing postal code';
COMMENT ON COLUMN restaurants.billing_city IS 'Billing city';
COMMENT ON COLUMN restaurants.billing_reference IS 'Customer reference/PO number to show on invoices';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- SECTION: Brasri Pilot Setup
-- ============================================================================

-- 1. Create Winefeed tenant
INSERT INTO tenants (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Winefeed')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Brasri as importer FIRST (needed for supplier FK constraint)
INSERT INTO importers (id, tenant_id, legal_name, org_number, contact_name, contact_email, contact_phone, is_active)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'Brasri AB',
  '556785-0655',
  'Corentin',
  'corentin@brasri.com',
  '',
  true
);

-- 3. Create Brasri as supplier WITH importer link (EU_IMPORTER requires default_importer_id)
INSERT INTO suppliers (id, namn, kontakt_email, type, org_number, is_active, default_importer_id)
VALUES (
  gen_random_uuid(),
  'Brasri AB',
  'corentin@brasri.com',
  'EU_IMPORTER',
  '556785-0655',
  true,
  (SELECT id FROM importers WHERE org_number = '556785-0655' LIMIT 1)
);

-- ============================================================================
-- MANUAL STEPS (run after creating user in Supabase Auth Dashboard)
-- ============================================================================
-- 4. Create user: corentin@brasri.com in Auth Dashboard
--    https://supabase.com/dashboard/project/itpknmhvbdhiprssjwtq/auth/users
--
-- 5. Link auth user to supplier:
-- INSERT INTO supplier_users (id, supplier_id, role)
-- VALUES ('<auth_user_id>', (SELECT id FROM suppliers WHERE org_number = '556785-0655'), 'admin');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
-- END OF PART 8
