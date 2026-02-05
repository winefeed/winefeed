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
