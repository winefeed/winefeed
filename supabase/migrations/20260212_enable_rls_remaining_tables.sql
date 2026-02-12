-- Enable RLS on all remaining public tables flagged by Security Advisor
-- Policy: deny anon, allow service_role (all access is server-side via API routes)

-- restaurant_users
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON restaurant_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- offer_lines
ALTER TABLE offer_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON offer_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- request_items
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON request_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- subscription_usage
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON subscription_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- tier_limits
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON tier_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- import_document_types
ALTER TABLE import_document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON import_document_types FOR ALL TO service_role USING (true) WITH CHECK (true);

-- wine_knowledge
ALTER TABLE wine_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON wine_knowledge FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
