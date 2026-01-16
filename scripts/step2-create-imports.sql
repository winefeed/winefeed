-- ============================================================================
-- STEP 2: Create imports tables (run AFTER step 1)
-- ============================================================================

-- 1. Create import status enum
DO $$ BEGIN
  CREATE TYPE import_status AS ENUM ('NOT_REGISTERED', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Create imports table
CREATE TABLE IF NOT EXISTS imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  importer_id UUID NOT NULL REFERENCES importers(id),
  delivery_location_id UUID NOT NULL REFERENCES direct_delivery_locations(id),
  supplier_id UUID NULL REFERENCES suppliers(id),
  status import_status NOT NULL DEFAULT 'NOT_REGISTERED',
  created_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create import status events
CREATE TABLE IF NOT EXISTS import_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES imports(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create import documents
CREATE TABLE IF NOT EXISTS import_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES imports(id),
  type TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Success message
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ STEP 2 COMPLETE!';
  RAISE NOTICE 'Tables created: imports, import_status_events, import_documents';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Run step3-create-testdata.sql';
END $$;
