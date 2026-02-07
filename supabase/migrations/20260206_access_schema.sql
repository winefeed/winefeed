-- ============================================================================
-- VINKOLL ACCESS - Consumer-facing wine discovery & request platform
-- ============================================================================

-- Producers (wine estates/domaines)
CREATE TABLE IF NOT EXISTS access_producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  region TEXT,
  description TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wines
CREATE TABLE IF NOT EXISTS access_wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES access_producers(id),
  name TEXT NOT NULL,
  wine_type TEXT NOT NULL DEFAULT 'red', -- red, white, rose, sparkling, orange, fortified
  grape TEXT,
  vintage INT,
  country TEXT,
  region TEXT,
  appellation TEXT,
  description TEXT,
  price_indication TEXT, -- e.g. "200-300 kr/fl"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_wines_producer ON access_wines(producer_id);
CREATE INDEX idx_access_wines_type ON access_wines(wine_type);
CREATE INDEX idx_access_wines_country ON access_wines(country);

-- Lots (available inventory from importers)
CREATE TABLE IF NOT EXISTS access_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id UUID NOT NULL REFERENCES access_wines(id),
  importer_id UUID,
  importer_name TEXT NOT NULL,
  importer_description TEXT,
  note_public TEXT,  -- visible to consumers
  note_private TEXT, -- admin only
  price_sek NUMERIC(10,2),
  min_quantity INT DEFAULT 1,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_lots_wine ON access_lots(wine_id);
CREATE INDEX idx_access_lots_available ON access_lots(is_available) WHERE is_available = true;

-- Consumers (end-users who browse & request)
CREATE TABLE IF NOT EXISTS access_consumers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_access_consumers_email ON access_consumers(email);

-- Auth tokens (magic link)
CREATE TABLE IF NOT EXISTS access_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  subject_type TEXT NOT NULL DEFAULT 'consumer', -- consumer
  subject_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_auth_tokens_hash ON access_auth_tokens(token_hash);

-- Watchlists (bevakningar)
CREATE TABLE IF NOT EXISTS access_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES access_consumers(id),
  target_type TEXT NOT NULL DEFAULT 'wine', -- wine, producer, free_text
  target_id UUID, -- wine_id or producer_id
  query_json JSONB, -- saved search criteria
  note TEXT, -- free text description
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_watchlists_consumer ON access_watchlists(consumer_id);

-- Requests (consumer purchase requests to importers)
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES access_consumers(id),
  wine_id UUID REFERENCES access_wines(id),
  lot_id UUID REFERENCES access_lots(id),
  importer_id UUID,
  importer_name TEXT,
  quantity INT NOT NULL DEFAULT 1,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined, expired
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_requests_consumer ON access_requests(consumer_id);
CREATE INDEX idx_access_requests_status ON access_requests(status);

-- Event log
CREATE TABLE IF NOT EXISTS access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  consumer_id UUID REFERENCES access_consumers(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_events_consumer ON access_events(consumer_id);
CREATE INDEX idx_access_events_type ON access_events(event_type);

-- Enable RLS on all tables
ALTER TABLE access_producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access (all queries go through supabaseAdmin)
CREATE POLICY "service_role_all" ON access_producers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON access_wines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON access_lots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON access_consumers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON access_auth_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON access_watchlists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON access_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON access_events FOR ALL USING (true) WITH CHECK (true);

-- Grant table permissions (required for PostgREST schema cache discovery)
GRANT SELECT, INSERT, UPDATE, DELETE ON access_producers TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_wines TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_lots TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_consumers TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_auth_tokens TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_watchlists TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_requests TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_events TO anon, authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Seed data for testing
INSERT INTO access_producers (id, name, country, region, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Domaine de la Romanée', 'Frankrike', 'Bourgogne', 'Legendarisk producent i Bourgogne med fokus på Pinot Noir.'),
  ('a0000000-0000-0000-0000-000000000002', 'Bodegas Muga', 'Spanien', 'Rioja', 'Familjeägt sedan 1932. Klassisk Rioja med modern precision.');

INSERT INTO access_wines (id, producer_id, name, wine_type, grape, vintage, country, region, price_indication) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Vosne-Romanée 1er Cru Les Suchots', 'red', 'Pinot Noir', 2021, 'Frankrike', 'Bourgogne', '800-1200 kr/fl'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Bourgogne Blanc', 'white', 'Chardonnay', 2022, 'Frankrike', 'Bourgogne', '250-350 kr/fl'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Muga Reserva', 'red', 'Tempranillo', 2019, 'Spanien', 'Rioja', '180-250 kr/fl'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Muga Rosado', 'rose', 'Garnacha', 2023, 'Spanien', 'Rioja', '120-160 kr/fl');

INSERT INTO access_lots (wine_id, importer_name, note_public, price_sek, min_quantity, is_available) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Nordic Wine Imports', 'Begränsat lager, 24 flaskor kvar.', 950, 6, true),
  ('b0000000-0000-0000-0000-000000000003', 'Iberiska Vinhuset', 'Direkt från producent. Leverans 2-3 veckor.', 210, 12, true),
  ('b0000000-0000-0000-0000-000000000003', 'Nordic Wine Imports', 'Finns på svenskt lager.', 225, 6, true),
  ('b0000000-0000-0000-0000-000000000004', 'Iberiska Vinhuset', 'Sommarvin! Fri frakt vid 24+ flaskor.', 140, 6, true);
