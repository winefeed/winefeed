-- ============================================================================
-- COMPLETE SETUP FOR IMPORT CASE MVP
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- 1. CREATE IMPORTERS TABLE
CREATE TABLE IF NOT EXISTS importers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  legal_name TEXT NOT NULL,
  org_number TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  license_number TEXT,
  license_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL DEFAULT 'SE' CHECK (type IN ('SE', 'EU_PARTNER', 'THIRD_COUNTRY')),
  CONSTRAINT valid_org_number CHECK (org_number ~ '^\d{6}-\d{4}$')
);

CREATE INDEX IF NOT EXISTS idx_importers_tenant ON importers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_importers_org_number ON importers(org_number);

-- 2. CREATE IMPORTS TABLE
-- Create enum type (skip if already exists)
DO $$ BEGIN
  CREATE TYPE import_status AS ENUM (
    'NOT_REGISTERED',
    'SUBMITTED',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  importer_id UUID NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  delivery_location_id UUID NOT NULL REFERENCES direct_delivery_locations(id) ON DELETE CASCADE,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  status import_status NOT NULL DEFAULT 'NOT_REGISTERED',
  created_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imports_tenant_restaurant ON imports(tenant_id, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_imports_tenant_status ON imports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_imports_restaurant ON imports(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_imports_importer ON imports(importer_id);
CREATE INDEX IF NOT EXISTS idx_imports_delivery_location ON imports(delivery_location_id);

-- 3. CREATE IMPORT STATUS EVENTS
CREATE TABLE IF NOT EXISTS import_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_events_tenant ON import_status_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_events_import ON import_status_events(import_id);

-- 4. CREATE IMPORT DOCUMENTS
CREATE TABLE IF NOT EXISTS import_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SKV_5369_03', 'CUSTOMS_DECLARATION', 'SHIPPING_MANIFEST')),
  version INT NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  generated_by_user_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_import_doc_type_version UNIQUE (import_id, type, version)
);

CREATE INDEX IF NOT EXISTS idx_import_docs_tenant ON import_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_docs_import ON import_documents(import_id);

-- 5. ADD import_id TO supplier_imports
ALTER TABLE supplier_imports
ADD COLUMN IF NOT EXISTS import_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_imports_tenant_import ON supplier_imports(tenant_id, import_id);

-- 6. ENABLE RLS
ALTER TABLE importers ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_documents ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
DO $$ BEGIN
  CREATE POLICY "Service role full access" ON importers FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access" ON imports FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access" ON import_status_events FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access" ON import_documents FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CREATE TEST DATA
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_restaurant_id UUID;
  v_importer_id UUID;
  v_ddl_id UUID;
  v_supplier_id UUID;
BEGIN

  -- Get or use existing restaurant
  SELECT id INTO v_restaurant_id FROM restaurants LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'No restaurant found. Create a restaurant first.';
  END IF;

  -- Create importer
  INSERT INTO importers (
    tenant_id, legal_name, org_number, contact_name,
    contact_email, contact_phone, type
  ) VALUES (
    v_tenant_id, 'Test Importer AB', '559876-5432', 'Anna Andersson',
    'anna@testimporter.se', '+46709876543', 'SE'
  )
  RETURNING id INTO v_importer_id;

  -- Get existing supplier or skip
  SELECT id INTO v_supplier_id FROM suppliers LIMIT 1;

  -- Create approved DDL
  INSERT INTO direct_delivery_locations (
    tenant_id, restaurant_id, importer_id, legal_name, org_number,
    delivery_address_line1, postal_code, city, country_code,
    contact_name, contact_email, contact_phone,
    consent_given, consent_timestamp, status
  ) VALUES (
    v_tenant_id, v_restaurant_id, v_importer_id,
    'Test Restaurant AB', '556789-1234',
    'Testgatan 123', '11456', 'Stockholm', 'SE',
    'Erik Eriksson', 'erik@test.se', '+46701112233',
    true, NOW(), 'APPROVED'
  )
  RETURNING id INTO v_ddl_id;

  -- Print IDs to use in UI
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST DATA CREATED - COPY THESE IDS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Restaurant ID:         %', v_restaurant_id;
  RAISE NOTICE 'Importer ID:           %', v_importer_id;
  RAISE NOTICE 'Delivery Location ID:  %', v_ddl_id;
  IF v_supplier_id IS NOT NULL THEN
    RAISE NOTICE 'Supplier ID (optional):%', v_supplier_id;
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Go to: http://localhost:3000/imports/new';
  RAISE NOTICE 'Paste the IDs above and create an import case!';
  RAISE NOTICE '';

END $$;
