-- ============================================================================
-- STEP 3: Create test data (run AFTER step 1 and 2)
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_restaurant_id UUID;
  v_importer_id UUID;
  v_ddl_id UUID;
  v_supplier_id UUID;
BEGIN

  -- Get existing restaurant
  SELECT id INTO v_restaurant_id FROM restaurants LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'No restaurant found in database';
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

  -- Get existing supplier
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

  -- Print IDs
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ TEST DATA CREATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Restaurant ID:         %', v_restaurant_id;
  RAISE NOTICE 'Importer ID:           %', v_importer_id;
  RAISE NOTICE 'Delivery Location ID:  %', v_ddl_id;
  IF v_supplier_id IS NOT NULL THEN
    RAISE NOTICE 'Supplier ID:           %', v_supplier_id;
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 ALL DONE! Go to: http://localhost:3000/imports/new';
  RAISE NOTICE 'Copy the IDs above and create your first import case!';
  RAISE NOTICE '';

END $$;
