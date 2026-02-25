-- PART 7 — Continue from: -- SECTION: 20260126_subscriptions.sql

-- SECTION: 20260126_subscriptions.sql
-- ============================================================================

-- ============================================================================
-- SUBSCRIPTIONS & MONETIZATION
--
-- Adds support for:
-- 1. Subscription tiers (free, pro, premium)
-- 2. Stripe integration
-- 3. Feature limits tracking
-- ============================================================================

-- Create subscription tier enum
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create subscription status enum
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add tier to suppliers for fast lookup
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS tier subscription_tier DEFAULT 'free';

-- Create index for tier filtering
CREATE INDEX IF NOT EXISTS idx_suppliers_tier ON suppliers(tier);

-- Subscriptions table (links to Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Tier info
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Stripe references
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One active subscription per supplier
  CONSTRAINT unique_active_subscription UNIQUE (supplier_id)
);

-- Index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- Usage tracking table (for feature limits)
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Usage metrics (reset monthly)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Counts
  wines_count INTEGER DEFAULT 0,
  leads_received INTEGER DEFAULT 0,
  offers_sent INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per supplier per period
  CONSTRAINT unique_usage_period UNIQUE (supplier_id, period_start)
);

-- Index for usage lookups
CREATE INDEX IF NOT EXISTS idx_subscription_usage_supplier ON subscription_usage(supplier_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON subscription_usage(period_start, period_end);

-- ============================================================================
-- TIER LIMITS CONFIG (as a reference table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tier_limits (
  tier subscription_tier PRIMARY KEY,
  max_wines INTEGER,           -- NULL = unlimited
  max_leads_per_month INTEGER, -- NULL = unlimited
  max_offers_per_month INTEGER, -- NULL = unlimited
  priority_in_search INTEGER DEFAULT 0,  -- Higher = better placement
  features JSONB DEFAULT '{}'  -- Flexible feature flags
);

-- Insert default limits
INSERT INTO tier_limits (tier, max_wines, max_leads_per_month, max_offers_per_month, priority_in_search, features)
VALUES
  ('free', NULL, 5, 10, 0, '{"analytics": false, "extended_profile": false, "support": "self-service"}'),
  ('pro', NULL, NULL, NULL, 10, '{"analytics": true, "extended_profile": true, "support": "email"}'),
  ('premium', NULL, NULL, NULL, 20, '{"analytics": true, "analytics_competitors": true, "extended_profile": true, "video_profile": true, "support": "dedicated"}')
ON CONFLICT (tier) DO UPDATE SET
  max_wines = EXCLUDED.max_wines,
  max_leads_per_month = EXCLUDED.max_leads_per_month,
  max_offers_per_month = EXCLUDED.max_offers_per_month,
  priority_in_search = EXCLUDED.priority_in_search,
  features = EXCLUDED.features;

-- ============================================================================
-- HELPER FUNCTION: Get supplier's current limits
-- ============================================================================
CREATE OR REPLACE FUNCTION get_supplier_limits(p_supplier_id UUID)
RETURNS TABLE (
  tier subscription_tier,
  max_wines INTEGER,
  max_leads_per_month INTEGER,
  current_wines INTEGER,
  current_leads INTEGER,
  can_add_wine BOOLEAN,
  can_receive_lead BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.tier,
    tl.max_wines,
    tl.max_leads_per_month,
    COALESCE((SELECT COUNT(*)::INTEGER FROM supplier_wines WHERE supplier_id = p_supplier_id AND is_active = true), 0),
    COALESCE(su.leads_received, 0),
    (tl.max_wines IS NULL OR COALESCE((SELECT COUNT(*) FROM supplier_wines WHERE supplier_id = p_supplier_id AND is_active = true), 0) < tl.max_wines),
    (tl.max_leads_per_month IS NULL OR COALESCE(su.leads_received, 0) < tl.max_leads_per_month)
  FROM suppliers s
  JOIN tier_limits tl ON s.tier = tl.tier
  LEFT JOIN subscription_usage su ON su.supplier_id = p_supplier_id
    AND su.period_start <= CURRENT_DATE
    AND su.period_end >= CURRENT_DATE
  WHERE s.id = p_supplier_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Sync tier between subscriptions and suppliers
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_supplier_tier()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers
  SET tier = NEW.tier
  WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_supplier_tier ON subscriptions;
CREATE TRIGGER trigger_sync_supplier_tier
AFTER INSERT OR UPDATE OF tier ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION sync_supplier_tier();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE subscriptions IS 'Tracks supplier subscription status and Stripe integration';
COMMENT ON TABLE subscription_usage IS 'Monthly usage tracking for feature limits';
COMMENT ON TABLE tier_limits IS 'Configuration for tier-based feature limits';
COMMENT ON COLUMN suppliers.tier IS 'Current subscription tier (synced from subscriptions table)';


-- ============================================================================
-- SECTION: 20260126_supplier_ior_location.sql
-- ============================================================================

-- ============================================================================
-- SUPPLIER IOR & WINE LOCATION
--
-- Adds support for:
-- 1. Linking suppliers to their IOR (Importer of Record)
-- 2. Marking wine location (domestic Sweden, EU, non-EU)
-- ============================================================================

-- Create wine location enum
DO $$ BEGIN
  CREATE TYPE wine_location AS ENUM ('domestic', 'eu', 'non_eu');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add importer_id to suppliers (which IOR handles their imports)
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS importer_id UUID REFERENCES importers(id);

-- Add index for importer lookup
CREATE INDEX IF NOT EXISTS idx_suppliers_importer_id ON suppliers(importer_id);

-- Add comment explaining the field
COMMENT ON COLUMN suppliers.importer_id IS 'The IOR (Importer of Record) that handles imports for this supplier. NULL for domestic Swedish suppliers.';

-- Add location to supplier_wines
ALTER TABLE supplier_wines
ADD COLUMN IF NOT EXISTS location wine_location DEFAULT 'domestic';

-- Add index for location filtering
CREATE INDEX IF NOT EXISTS idx_supplier_wines_location ON supplier_wines(location);

-- Add comment explaining the field
COMMENT ON COLUMN supplier_wines.location IS 'Where the wine is stored: domestic (Sweden), eu (EU warehouse), non_eu (outside EU)';

-- ============================================================================
-- HELPER VIEW: Wines with IOR info
-- ============================================================================
CREATE OR REPLACE VIEW supplier_wines_with_ior AS
SELECT
  sw.*,
  s.namn AS supplier_name,
  s.importer_id,
  i.legal_name AS importer_name,
  CASE
    WHEN sw.location = 'domestic' THEN 'Leverans från Sverige'
    WHEN sw.location = 'eu' AND i.id IS NOT NULL THEN 'Import via ' || i.legal_name
    WHEN sw.location = 'eu' THEN 'Import från EU'
    WHEN sw.location = 'non_eu' THEN 'Import från land utanför EU'
    ELSE 'Okänd'
  END AS delivery_info
FROM supplier_wines sw
JOIN suppliers s ON sw.supplier_id = s.id
LEFT JOIN importers i ON s.importer_id = i.id;


-- ============================================================================
-- SECTION: 20260128_request_items.sql
-- ============================================================================

-- REQUEST ITEMS TABLE
-- Migration: 20260128_request_items
-- Purpose: Store individual wine items in a quote request with provorder support

-- ============================================================================
-- Create request_items table
-- ============================================================================

CREATE TABLE IF NOT EXISTS request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  wine_id UUID REFERENCES supplier_wines(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Wine snapshot (in case wine is deleted)
  wine_name TEXT NOT NULL,
  producer TEXT,
  country TEXT,
  region TEXT,
  vintage INTEGER,
  color TEXT,

  -- Order details
  quantity INTEGER NOT NULL,
  price_sek INTEGER, -- Price at time of request (öre)
  moq INTEGER DEFAULT 0,

  -- Provorder info
  provorder BOOLEAN DEFAULT FALSE,
  provorder_fee INTEGER, -- Fee in SEK if provorder

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_supplier_id ON request_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_request_items_wine_id ON request_items(wine_id);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE request_items IS 'Individual wine items in a quote request';
COMMENT ON COLUMN request_items.provorder IS 'Whether this item is ordered as provorder (below MOQ with fee)';
COMMENT ON COLUMN request_items.provorder_fee IS 'Flat fee in SEK for this provorder item';


-- ============================================================================
-- SECTION: 20260128_supplier_provorder.sql
-- ============================================================================

-- SUPPLIER PROVORDER (DISCOVERY MODE)
-- Migration: 20260128_supplier_provorder
-- Purpose: Enable suppliers to accept small orders with a flat fee

-- ============================================================================
-- Add provorder fields to suppliers table
-- ============================================================================

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS provorder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS provorder_fee_sek INTEGER DEFAULT 500;

-- Constraint to ensure fee is positive
ALTER TABLE suppliers
ADD CONSTRAINT positive_provorder_fee CHECK (provorder_fee_sek IS NULL OR provorder_fee_sek >= 0);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN suppliers.provorder_enabled IS 'Whether supplier accepts small orders below MOQ with a fee';
COMMENT ON COLUMN suppliers.provorder_fee_sek IS 'Flat fee in SEK for provorder (default 500)';


-- ============================================================================
-- SECTION: 20260201_notifications.sql
-- ============================================================================

-- Notification System Tables
-- Created: 2026-02-01

-- Push subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Notification log (for debugging and analytics)
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  recipient TEXT, -- email address or push endpoint
  subject TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying logs
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_event_type ON notification_log(event_type);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  -- Granular settings per event type
  notify_new_offer BOOLEAN DEFAULT true,
  notify_offer_accepted BOOLEAN DEFAULT true,
  notify_order_confirmed BOOLEAN DEFAULT true,
  notify_offer_expiring BOOLEAN DEFAULT true,
  notify_new_request_match BOOLEAN DEFAULT true, -- for suppliers
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push subscriptions
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Users can view their own notification logs
CREATE POLICY "Users can view own notification logs"
  ON notification_log FOR SELECT
  USING (auth.uid() = user_id);

-- Users can manage their own preferences
CREATE POLICY "Users can manage own notification preferences"
  ON user_notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend)
CREATE POLICY "Service role full access to push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to notification_log"
  ON notification_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to preferences"
  ON user_notification_preferences FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');


-- ============================================================================
-- SECTION: 20260202_add_concierge_fields.sql
-- ============================================================================

/**
 * MIGRATION: Add concierge mode fields to orders
 *
 * Purpose: Track orders that Winefeed handles on behalf of the customer
 *
 * Use case: During pilot, offer "we handle everything for you" as a feature
 * - Admin marks order as handled_by_winefeed = true
 * - Admin can add notes about what was done
 * - Useful for first customers who want to test without risk
 */

-- Add concierge fields to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS handled_by_winefeed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS concierge_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS concierge_handled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS concierge_handled_by UUID NULL;

-- Index for filtering concierge orders
CREATE INDEX IF NOT EXISTS idx_orders_concierge ON orders(handled_by_winefeed) WHERE handled_by_winefeed = TRUE;

-- Comments
COMMENT ON COLUMN orders.handled_by_winefeed IS 'If true, Winefeed team handles fulfillment on behalf of customer';
COMMENT ON COLUMN orders.concierge_notes IS 'Admin notes about concierge handling (internal only)';
COMMENT ON COLUMN orders.concierge_handled_at IS 'When concierge mode was enabled';
COMMENT ON COLUMN orders.concierge_handled_by IS 'Admin user who enabled concierge mode';


-- ============================================================================
-- SECTION: 20260202_add_dispute_and_payment.sql
-- ============================================================================

-- ============================================================================
-- ADD DISPUTE AND PAYMENT TRACKING TO ORDERS
-- ============================================================================
-- Dispute: Restaurants can report problems with orders
-- Payment: Track payment status (pending during pilot, manual handling)
-- ============================================================================

-- Dispute fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS dispute_status TEXT DEFAULT 'none'
    CHECK (dispute_status IN ('none', 'reported', 'investigating', 'resolved')),
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS dispute_reported_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT NULL;

-- Payment fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'invoiced', 'paid', 'overdue', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_due_date DATE NULL,
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT NULL;

-- Index for filtering disputed orders
CREATE INDEX IF NOT EXISTS idx_orders_dispute_status ON orders(dispute_status) WHERE dispute_status != 'none';

-- Index for payment status
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

COMMENT ON COLUMN orders.dispute_status IS 'none=OK, reported=problem flagged, investigating=admin looking, resolved=closed';
COMMENT ON COLUMN orders.payment_status IS 'pending=awaiting invoice, invoiced=sent, paid=done, overdue=late, refunded=returned';


-- ============================================================================
-- SECTION: 20260202_notification_frequency.sql
-- ============================================================================

-- Add email frequency to notification preferences
-- Created: 2026-02-02

-- Add frequency column (immediate, daily, weekly)
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS email_frequency TEXT DEFAULT 'immediate'
    CHECK (email_frequency IN ('immediate', 'daily', 'weekly'));

-- Add reminder setting
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_offer_reminder BOOLEAN DEFAULT true;

-- Comment
COMMENT ON COLUMN user_notification_preferences.email_frequency IS 'How often to send email summaries: immediate, daily (08:00), weekly (Monday)';
COMMENT ON COLUMN user_notification_preferences.notify_offer_reminder IS 'Send reminder for unanswered offers after 48h';


-- ============================================================================
-- SECTION: 20260205_add_orange_wine_type.sql
-- ============================================================================

-- Add ORANGE to ior_wine_type enum
-- Orange wines are skin-contact white wines, popular in natural wine segment

ALTER TYPE ior_wine_type ADD VALUE IF NOT EXISTS 'ORANGE' AFTER 'ROSE';


-- ============================================================================
-- SECTION: 20260205_ior_combi_tag.sql
-- ============================================================================

-- Add combi_tag to ior_producers
-- Enables grouping producers for combined orders to reach MOQ easier

ALTER TABLE ior_producers
ADD COLUMN IF NOT EXISTS combi_tag VARCHAR(100);

-- Index for filtering by combi
CREATE INDEX IF NOT EXISTS idx_ior_producers_combi ON ior_producers(combi_tag)
WHERE combi_tag IS NOT NULL;

COMMENT ON COLUMN ior_producers.combi_tag IS 'Tag for grouping producers - customers can combine orders across producers with same tag to reach MOQ';


-- ============================================================================
-- SECTION: 20260205_ior_feedback.sql
-- ============================================================================

-- =============================================================================
-- IOR FEEDBACK ITEMS
-- Structured feedback collection from importers testing the IOR module
-- =============================================================================

CREATE TABLE IF NOT EXISTS ior_feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  importer_id uuid NOT NULL,

  -- Optional context links
  producer_id uuid REFERENCES ior_producers(id) ON DELETE SET NULL,
  product_id uuid REFERENCES ior_products(id) ON DELETE SET NULL,
  case_id uuid REFERENCES ior_communication_cases(id) ON DELETE SET NULL,

  -- Feedback metadata
  page_path text NOT NULL,
  category text NOT NULL CHECK (category IN ('UX', 'Bug', 'Data', 'Workflow', 'Missing feature', 'Other')),
  severity text NOT NULL CHECK (severity IN ('Low', 'Medium', 'High')),

  -- Feedback content
  title text NOT NULL,
  details text NOT NULL,
  expected text,

  -- Status tracking
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'DONE', 'WONTFIX')),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_ior_feedback_tenant_importer ON ior_feedback_items(tenant_id, importer_id);
CREATE INDEX idx_ior_feedback_created_at ON ior_feedback_items(created_at DESC);
CREATE INDEX idx_ior_feedback_status ON ior_feedback_items(status);
CREATE INDEX idx_ior_feedback_category ON ior_feedback_items(category);

-- Enable RLS
ALTER TABLE ior_feedback_items ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON ior_feedback_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- IOR users can manage their own feedback
CREATE POLICY "IOR access own feedback" ON ior_feedback_items
  FOR ALL
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ior_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ior_feedback_updated_at
  BEFORE UPDATE ON ior_feedback_items
  FOR EACH ROW
  EXECUTE FUNCTION update_ior_feedback_updated_at();

-- =============================================================================
-- SAMPLE DATA (optional, for testing)
-- =============================================================================

-- Sample feedback items will be inserted via the app during testing


-- ============================================================================
-- SECTION: 20260205_ior_portfolio_schema.sql
-- ============================================================================

-- IOR Portfolio Operator Schema
-- Enables IORs to manage producer portfolios with products, pricing, and communication

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Price list status
DO $$ BEGIN
  CREATE TYPE ior_price_list_status AS ENUM ('DRAFT', 'ACTIVE', 'NEXT', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Case status (WAITING_INTERNAL for producer replies, compute overdue from due_at)
DO $$ BEGIN
  CREATE TYPE ior_case_status AS ENUM ('OPEN', 'WAITING_PRODUCER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Case priority
DO $$ BEGIN
  CREATE TYPE ior_case_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Wine type
DO $$ BEGIN
  CREATE TYPE ior_wine_type AS ENUM ('RED', 'WHITE', 'ROSE', 'SPARKLING', 'DESSERT', 'FORTIFIED', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- ior_producers: Wine producers managed by an IOR
CREATE TABLE IF NOT EXISTS ior_producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,

  -- Producer identity
  name TEXT NOT NULL,
  legal_name TEXT,
  country TEXT NOT NULL,
  region TEXT,

  -- Contact
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Branding
  logo_url TEXT,
  website_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  onboarded_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ior_producers_unique_name UNIQUE(importer_id, name)
);

-- ior_products: Wine products from producers
CREATE TABLE IF NOT EXISTS ior_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES ior_producers(id) ON DELETE CASCADE,

  -- Product identity
  name TEXT NOT NULL,
  vintage INTEGER,
  sku TEXT,

  -- Wine details
  grape_varieties TEXT[],
  wine_type ior_wine_type,
  appellation TEXT,
  alcohol_pct DECIMAL(4,2),

  -- Packaging
  bottle_size_ml INTEGER DEFAULT 750,
  case_size INTEGER DEFAULT 6,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  tasting_notes TEXT,
  awards JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ior_products_unique UNIQUE(importer_id, producer_id, name, vintage)
);

-- ior_price_lists: Price lists by market for producers
CREATE TABLE IF NOT EXISTS ior_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES ior_producers(id) ON DELETE CASCADE,

  -- Price list metadata
  name TEXT NOT NULL,
  market TEXT NOT NULL,  -- e.g., 'SE', 'NO', 'DK'
  currency TEXT NOT NULL DEFAULT 'SEK',

  -- Status
  status ior_price_list_status DEFAULT 'DRAFT',
  valid_from DATE,
  valid_to DATE,

  -- Audit
  created_by UUID,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ior_price_list_items: Line items in price lists
CREATE TABLE IF NOT EXISTS ior_price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES ior_price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ior_products(id) ON DELETE CASCADE,

  -- Pricing (in smallest currency unit, e.g., öre)
  price_per_bottle_ore INTEGER NOT NULL,
  price_per_case_ore INTEGER,

  -- MOQ
  min_order_qty INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ior_price_list_items_unique UNIQUE(price_list_id, product_id)
);

-- ior_trade_terms: Trade terms per market per producer
CREATE TABLE IF NOT EXISTS ior_trade_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES ior_producers(id) ON DELETE CASCADE,

  -- Market
  market TEXT NOT NULL,  -- 'SE', 'NO', 'DK', etc.

  -- Terms
  payment_terms_days INTEGER DEFAULT 30,
  incoterms TEXT,  -- e.g., 'EXW', 'DDP', 'CIF'
  moq_cases INTEGER,
  lead_time_days INTEGER,

  -- Discounts (JSONB for flexibility)
  volume_discounts JSONB DEFAULT '[]',  -- [{qty: 100, discount_pct: 5}, ...]

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ior_trade_terms_unique UNIQUE(importer_id, producer_id, market)
);

-- ior_communication_cases: Case-based communication with producers
CREATE TABLE IF NOT EXISTS ior_communication_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES ior_producers(id) ON DELETE CASCADE,

  -- Case metadata
  subject TEXT NOT NULL,
  category TEXT,  -- 'pricing', 'logistics', 'quality', 'general'

  -- Status (overdue is computed from due_at, not stored)
  status ior_case_status DEFAULT 'OPEN',
  priority ior_case_priority DEFAULT 'NORMAL',

  -- Due date tracking
  due_at TIMESTAMPTZ,

  -- Audit
  created_by UUID,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ior_case_messages: Messages within communication cases
CREATE TABLE IF NOT EXISTS ior_case_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES ior_communication_cases(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL,
  content_html TEXT,

  -- Direction
  direction TEXT NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),

  -- Sender
  sender_type TEXT NOT NULL CHECK (sender_type IN ('IOR_USER', 'PRODUCER', 'SYSTEM')),
  sender_name TEXT,
  sender_email TEXT,

  -- Template info (if sent from template)
  template_id TEXT,

  -- Email metadata
  email_message_id TEXT,  -- For threading

  -- Attachments (JSONB for flexibility)
  attachments JSONB DEFAULT '[]',  -- [{name, url, size, type}, ...]

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ior_email_threads: Email thread tokens for inbound reply routing
CREATE TABLE IF NOT EXISTS ior_email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES ior_communication_cases(id) ON DELETE CASCADE,
  thread_token TEXT NOT NULL UNIQUE,  -- The [WF:<token>] value
  producer_email TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- ior_audit_log: Audit trail for IOR portfolio operations
CREATE TABLE IF NOT EXISTS ior_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  importer_id UUID NOT NULL,

  -- Event
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,  -- 'producer', 'product', 'price_list', 'case', etc.
  entity_id UUID NOT NULL,

  -- Actor
  actor_user_id UUID,
  actor_name TEXT,

  -- Payload (JSONB for flexibility)
  payload JSONB DEFAULT '{}',

  -- Idempotency (for deduplication)
  idempotency_key TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- ior_producers indexes
CREATE INDEX IF NOT EXISTS idx_ior_producers_importer ON ior_producers(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_producers_tenant ON ior_producers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ior_producers_country ON ior_producers(country);
CREATE INDEX IF NOT EXISTS idx_ior_producers_active ON ior_producers(importer_id, is_active);

-- ior_products indexes
CREATE INDEX IF NOT EXISTS idx_ior_products_importer ON ior_products(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_products_producer ON ior_products(producer_id);
CREATE INDEX IF NOT EXISTS idx_ior_products_tenant ON ior_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ior_products_active ON ior_products(importer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ior_products_type ON ior_products(wine_type);

-- ior_price_lists indexes
CREATE INDEX IF NOT EXISTS idx_ior_price_lists_importer ON ior_price_lists(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_price_lists_producer ON ior_price_lists(producer_id);
CREATE INDEX IF NOT EXISTS idx_ior_price_lists_status ON ior_price_lists(status);
CREATE INDEX IF NOT EXISTS idx_ior_price_lists_market ON ior_price_lists(market);

-- ior_price_list_items indexes
CREATE INDEX IF NOT EXISTS idx_ior_price_list_items_list ON ior_price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_ior_price_list_items_product ON ior_price_list_items(product_id);

-- ior_trade_terms indexes
CREATE INDEX IF NOT EXISTS idx_ior_trade_terms_importer ON ior_trade_terms(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_trade_terms_producer ON ior_trade_terms(producer_id);
CREATE INDEX IF NOT EXISTS idx_ior_trade_terms_market ON ior_trade_terms(market);

-- ior_communication_cases indexes
CREATE INDEX IF NOT EXISTS idx_ior_cases_importer ON ior_communication_cases(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_cases_producer ON ior_communication_cases(producer_id);
CREATE INDEX IF NOT EXISTS idx_ior_cases_status ON ior_communication_cases(status);
CREATE INDEX IF NOT EXISTS idx_ior_cases_priority ON ior_communication_cases(priority);
-- Partial index for open cases with due dates (for overdue queries)
CREATE INDEX IF NOT EXISTS idx_ior_cases_due ON ior_communication_cases(due_at)
  WHERE status NOT IN ('RESOLVED', 'CLOSED');

-- ior_case_messages indexes
CREATE INDEX IF NOT EXISTS idx_ior_messages_case ON ior_case_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_ior_messages_created ON ior_case_messages(case_id, created_at);

-- ior_email_threads indexes
CREATE INDEX IF NOT EXISTS idx_ior_email_threads_token ON ior_email_threads(thread_token);
CREATE INDEX IF NOT EXISTS idx_ior_email_threads_case ON ior_email_threads(case_id);

-- ior_audit_log indexes
CREATE INDEX IF NOT EXISTS idx_ior_audit_tenant ON ior_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ior_audit_importer ON ior_audit_log(importer_id);
CREATE INDEX IF NOT EXISTS idx_ior_audit_entity ON ior_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ior_audit_event ON ior_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_ior_audit_created ON ior_audit_log(created_at DESC);

-- Unique partial index for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_ior_audit_idempotency
  ON ior_audit_log(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on ior_producers
CREATE OR REPLACE FUNCTION ior_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER ior_producers_updated_at
    BEFORE UPDATE ON ior_producers
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_products_updated_at
    BEFORE UPDATE ON ior_products
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_price_lists_updated_at
    BEFORE UPDATE ON ior_price_lists
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_price_list_items_updated_at
    BEFORE UPDATE ON ior_price_list_items
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_trade_terms_updated_at
    BEFORE UPDATE ON ior_trade_terms
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ior_cases_updated_at
    BEFORE UPDATE ON ior_communication_cases
    FOR EACH ROW EXECUTE FUNCTION ior_update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ior_producers IS 'Wine producers managed by an IOR (Importer of Record)';
COMMENT ON TABLE ior_products IS 'Wine products from IOR-managed producers';
COMMENT ON TABLE ior_price_lists IS 'Price lists by market for IOR producers';
COMMENT ON TABLE ior_price_list_items IS 'Line items in IOR price lists';
COMMENT ON TABLE ior_trade_terms IS 'Trade terms per market for IOR-producer relationships';
COMMENT ON TABLE ior_communication_cases IS 'Communication cases between IOR and producers';
COMMENT ON TABLE ior_case_messages IS 'Messages within IOR communication cases';
COMMENT ON TABLE ior_email_threads IS 'Email thread tokens for inbound reply routing';
COMMENT ON TABLE ior_audit_log IS 'Audit trail for IOR portfolio operations';


-- ============================================================================
-- END OF PART 7
