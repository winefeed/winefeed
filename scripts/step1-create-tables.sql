-- ============================================================================
-- STEP 1: Create base tables (run this FIRST)
-- ============================================================================

-- 1. Create tenants (if not exists)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tenants (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant')
ON CONFLICT (id) DO NOTHING;

-- 2. Create importers table
CREATE TABLE IF NOT EXISTS importers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  legal_name TEXT NOT NULL,
  org_number TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create DDL status enum
DO $$ BEGIN
  CREATE TYPE ddl_status AS ENUM ('NOT_REGISTERED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4. Create direct_delivery_locations table
CREATE TABLE IF NOT EXISTS direct_delivery_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  importer_id UUID NOT NULL REFERENCES importers(id),
  legal_name TEXT NOT NULL,
  org_number TEXT NOT NULL,
  delivery_address_line1 TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'SE',
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  status ddl_status NOT NULL DEFAULT 'NOT_REGISTERED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Success message
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ STEP 1 COMPLETE!';
  RAISE NOTICE 'Tables created: tenants, importers, direct_delivery_locations';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Run step2-create-imports.sql';
END $$;
