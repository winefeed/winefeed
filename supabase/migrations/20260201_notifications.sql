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
