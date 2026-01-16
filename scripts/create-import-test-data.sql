-- Create test data for Import Case MVP
-- Run this in Supabase SQL Editor

-- Fixed tenant and user IDs (matching what UI uses)
DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_user_id UUID := '00000000-0000-0000-0000-000000000001';
  v_restaurant_id UUID;
  v_importer_id UUID;
  v_ddl_id UUID;
  v_supplier_id UUID;
BEGIN

  -- 1. Create test restaurant
  INSERT INTO restaurants (
    tenant_id,
    name,
    org_number,
    contact_email,
    contact_phone
  ) VALUES (
    v_tenant_id,
    'Test Restaurant Stockholm AB',
    '556789-1234',
    'info@testrestaurant.se',
    '+46701234567'
  )
  RETURNING id INTO v_restaurant_id;

  RAISE NOTICE 'Restaurant created: %', v_restaurant_id;

  -- 2. Create test importer
  INSERT INTO importers (
    tenant_id,
    legal_name,
    org_number,
    contact_name,
    contact_email,
    contact_phone,
    type
  ) VALUES (
    v_tenant_id,
    'Test Importer AB',
    '559876-5432',
    'Anna Andersson',
    'anna@testimporter.se',
    '+46709876543',
    'SE'
  )
  RETURNING id INTO v_importer_id;

  RAISE NOTICE 'Importer created: %', v_importer_id;

  -- 3. Create test supplier (optional)
  INSERT INTO suppliers (
    tenant_id,
    namn,
    org_number,
    kontakt_email,
    kontakt_phone,
    typ,
    land
  ) VALUES (
    v_tenant_id,
    'Test Vinleverantör AB',
    '551234-5678',
    'order@testvin.se',
    '+46708765432',
    'SE',
    'SE'
  )
  RETURNING id INTO v_supplier_id;

  RAISE NOTICE 'Supplier created: %', v_supplier_id;

  -- 4. Create approved Direct Delivery Location
  INSERT INTO direct_delivery_locations (
    tenant_id,
    restaurant_id,
    importer_id,
    legal_name,
    org_number,
    delivery_address_line1,
    postal_code,
    city,
    country_code,
    contact_name,
    contact_email,
    contact_phone,
    consent_given,
    consent_timestamp,
    status
  ) VALUES (
    v_tenant_id,
    v_restaurant_id,
    v_importer_id,
    'Test Restaurant Stockholm AB',
    '556789-1234',
    'Testgatan 123',
    '11456',
    'Stockholm',
    'SE',
    'Erik Eriksson',
    'erik@testrestaurant.se',
    '+46701112233',
    true,
    NOW(),
    'APPROVED'
  )
  RETURNING id INTO v_ddl_id;

  RAISE NOTICE 'Direct Delivery Location created: %', v_ddl_id;

  -- Print all IDs for easy copy-paste
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST DATA CREATED - USE THESE IDS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Restaurant ID:         %', v_restaurant_id;
  RAISE NOTICE 'Importer ID:           %', v_importer_id;
  RAISE NOTICE 'Delivery Location ID:  %', v_ddl_id;
  RAISE NOTICE 'Supplier ID (optional):%', v_supplier_id;
  RAISE NOTICE '========================================';

END $$;
