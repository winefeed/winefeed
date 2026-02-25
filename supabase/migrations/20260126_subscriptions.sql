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
