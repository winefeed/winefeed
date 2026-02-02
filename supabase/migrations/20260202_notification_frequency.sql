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
