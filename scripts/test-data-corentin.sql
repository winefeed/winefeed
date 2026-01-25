/**
 * TEST DATA FOR CORENTIN (BRASRI)
 *
 * Creates:
 * 1. Test restaurant "Test Kitchen Stockholm"
 * 2. Wine request from the restaurant
 * 3. Offer from Brasri (ACCEPTED)
 * 4. Order with Brasri as IOR (various statuses for testing)
 *
 * Run in Supabase SQL Editor
 */

-- ============================================================================
-- CONFIGURATION - DO NOT EDIT
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_corentin_user_id UUID := 'd185cbb0-8309-43fa-be94-53904bb02d10';
  v_brasri_importer_id UUID := 'b7540acf-fd0d-4fec-8347-394911c3c835';
  v_brasri_supplier_id UUID;

  -- Generated IDs
  v_restaurant_id UUID;
  v_request_id UUID;
  v_offer_id UUID;
  v_offer_2_id UUID;
  v_order_id UUID;
  v_order_2_id UUID;
  v_order_3_id UUID;
BEGIN
  -- Get Brasri supplier ID
  SELECT id INTO v_brasri_supplier_id
  FROM suppliers
  WHERE org_number = '556785-0655'
  LIMIT 1;

  IF v_brasri_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Brasri supplier not found! Make sure supplier setup SQL was run.';
  END IF;

  RAISE NOTICE 'Using Brasri supplier ID: %', v_brasri_supplier_id;

  -- ============================================================================
  -- 1. CREATE TEST RESTAURANT
  -- ============================================================================

  INSERT INTO restaurants (id, namn, kontaktperson, email, telefon)
  VALUES (
    gen_random_uuid(),
    'Test Kitchen Stockholm',
    'Anna Testsson',
    'anna@testkitchen.se',
    '08-123 45 67'
  )
  RETURNING id INTO v_restaurant_id;

  RAISE NOTICE 'Created restaurant: %', v_restaurant_id;

  -- ============================================================================
  -- 2. CREATE WINE REQUEST
  -- ============================================================================

  INSERT INTO requests (id, restaurant_id, fritext, budget_per_flaska, antal_flaskor, leverans_senast, specialkrav)
  VALUES (
    gen_random_uuid(),
    v_restaurant_id,
    'Vi söker eleganta franska rödviner för vår nya vinlista. Gärna Bourgogne eller Rhône.',
    25000, -- 250 SEK budget per bottle
    48,    -- 48 bottles
    CURRENT_DATE + INTERVAL '30 days',
    ARRAY['ekologiskt']
  )
  RETURNING id INTO v_request_id;

  RAISE NOTICE 'Created request: %', v_request_id;

  -- ============================================================================
  -- 3. CREATE ACCEPTED OFFER FROM BRASRI
  -- ============================================================================

  INSERT INTO offers (id, tenant_id, restaurant_id, request_id, supplier_id, title, currency, status, accepted_at, locked_at)
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    v_restaurant_id,
    v_request_id,
    v_brasri_supplier_id,
    'Franska kvalitetsviner - Bourgogne & Rhône',
    'SEK',
    'ACCEPTED',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  )
  RETURNING id INTO v_offer_id;

  RAISE NOTICE 'Created offer: %', v_offer_id;

  -- Create offer lines
  INSERT INTO offer_lines (tenant_id, offer_id, line_no, name, vintage, quantity, offered_unit_price_ore, producer, country, region)
  VALUES
    (v_tenant_id, v_offer_id, 1, 'Château de Beaucastel Châteauneuf-du-Pape', 2019, 12, 45000, 'Château de Beaucastel', 'France', 'Rhône'),
    (v_tenant_id, v_offer_id, 2, 'Domaine Leflaive Puligny-Montrachet', 2020, 12, 75000, 'Domaine Leflaive', 'France', 'Burgundy'),
    (v_tenant_id, v_offer_id, 3, 'E. Guigal Côte-Rôtie La Mouline', 2018, 6, 150000, 'E. Guigal', 'France', 'Rhône'),
    (v_tenant_id, v_offer_id, 4, 'Louis Jadot Gevrey-Chambertin', 2019, 18, 35000, 'Louis Jadot', 'France', 'Burgundy');

  RAISE NOTICE 'Created 4 offer lines';

  -- ============================================================================
  -- 4. CREATE ORDERS (DIFFERENT STATUSES FOR TESTING)
  -- ============================================================================

  -- Order 1: CONFIRMED (new order waiting for IOR action)
  INSERT INTO orders (id, tenant_id, restaurant_id, offer_id, request_id, seller_supplier_id, importer_of_record_id, status, total_lines, total_quantity, currency, created_by, created_at)
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    v_restaurant_id,
    v_offer_id,
    v_request_id,
    v_brasri_supplier_id,
    v_brasri_importer_id,
    'CONFIRMED',
    4,
    48,
    'SEK',
    v_corentin_user_id,
    NOW() - INTERVAL '5 days'
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE 'Created order (CONFIRMED): %', v_order_id;

  -- Create order lines for order 1
  INSERT INTO order_lines (tenant_id, order_id, wine_name, producer, vintage, country, region, quantity, unit, unit_price_sek, total_price_sek, line_number)
  VALUES
    (v_tenant_id, v_order_id, 'Château de Beaucastel Châteauneuf-du-Pape', 'Château de Beaucastel', '2019', 'France', 'Rhône', 12, 'flaska', 450.00, 5400.00, 1),
    (v_tenant_id, v_order_id, 'Domaine Leflaive Puligny-Montrachet', 'Domaine Leflaive', '2020', 'France', 'Burgundy', 12, 'flaska', 750.00, 9000.00, 2),
    (v_tenant_id, v_order_id, 'E. Guigal Côte-Rôtie La Mouline', 'E. Guigal', '2018', 'France', 'Rhône', 6, 'flaska', 1500.00, 9000.00, 3),
    (v_tenant_id, v_order_id, 'Louis Jadot Gevrey-Chambertin', 'Louis Jadot', '2019', 'France', 'Burgundy', 18, 'flaska', 350.00, 6300.00, 4);

  -- Create order event for order 1
  INSERT INTO order_events (tenant_id, order_id, event_type, to_status, note, actor_user_id, actor_name)
  VALUES (v_tenant_id, v_order_id, 'ORDER_CREATED', 'CONFIRMED', 'Order created from accepted offer', v_corentin_user_id, 'Corentin (Brasri)');

  -- ============================================================================
  -- SECOND OFFER AND ORDER (IN_FULFILLMENT status)
  -- ============================================================================

  INSERT INTO offers (id, tenant_id, restaurant_id, supplier_id, title, currency, status, accepted_at, locked_at)
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    v_restaurant_id,
    v_brasri_supplier_id,
    'Italienska viner - Piedmont',
    'SEK',
    'ACCEPTED',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
  )
  RETURNING id INTO v_offer_2_id;

  -- Offer lines for offer 2
  INSERT INTO offer_lines (tenant_id, offer_id, line_no, name, vintage, quantity, offered_unit_price_ore, producer, country, region)
  VALUES
    (v_tenant_id, v_offer_2_id, 1, 'Gaja Barbaresco', 2018, 6, 200000, 'Gaja', 'Italy', 'Piedmont'),
    (v_tenant_id, v_offer_2_id, 2, 'Giacomo Conterno Barolo', 2017, 6, 180000, 'Giacomo Conterno', 'Italy', 'Piedmont');

  -- Order 2: IN_FULFILLMENT (IOR is processing)
  INSERT INTO orders (id, tenant_id, restaurant_id, offer_id, seller_supplier_id, importer_of_record_id, status, total_lines, total_quantity, currency, created_by, created_at)
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    v_restaurant_id,
    v_offer_2_id,
    v_brasri_supplier_id,
    v_brasri_importer_id,
    'IN_FULFILLMENT',
    2,
    12,
    'SEK',
    v_corentin_user_id,
    NOW() - INTERVAL '10 days'
  )
  RETURNING id INTO v_order_2_id;

  RAISE NOTICE 'Created order (IN_FULFILLMENT): %', v_order_2_id;

  -- Order lines for order 2
  INSERT INTO order_lines (tenant_id, order_id, wine_name, producer, vintage, country, region, quantity, unit, unit_price_sek, total_price_sek, line_number)
  VALUES
    (v_tenant_id, v_order_2_id, 'Gaja Barbaresco', 'Gaja', '2018', 'Italy', 'Piedmont', 6, 'flaska', 2000.00, 12000.00, 1),
    (v_tenant_id, v_order_2_id, 'Giacomo Conterno Barolo', 'Giacomo Conterno', '2017', 'Italy', 'Piedmont', 6, 'flaska', 1800.00, 10800.00, 2);

  -- Events for order 2
  INSERT INTO order_events (tenant_id, order_id, event_type, to_status, note, actor_user_id, actor_name, created_at)
  VALUES
    (v_tenant_id, v_order_2_id, 'ORDER_CREATED', 'CONFIRMED', 'Order created from accepted offer', v_corentin_user_id, 'Corentin (Brasri)', NOW() - INTERVAL '10 days'),
    (v_tenant_id, v_order_2_id, 'STATUS_CHANGED', 'IN_FULFILLMENT', 'Started fulfillment process', v_corentin_user_id, 'Corentin (Brasri)', NOW() - INTERVAL '8 days');

  -- ============================================================================
  -- THIRD ORDER (SHIPPED status)
  -- ============================================================================

  INSERT INTO orders (id, tenant_id, restaurant_id, offer_id, seller_supplier_id, importer_of_record_id, status, total_lines, total_quantity, currency, created_by, created_at)
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    v_restaurant_id,
    v_offer_2_id,  -- Reuse offer for simplicity
    v_brasri_supplier_id,
    v_brasri_importer_id,
    'SHIPPED',
    2,
    12,
    'SEK',
    v_corentin_user_id,
    NOW() - INTERVAL '15 days'
  )
  RETURNING id INTO v_order_3_id;

  RAISE NOTICE 'Created order (SHIPPED): %', v_order_3_id;

  -- Order lines for order 3
  INSERT INTO order_lines (tenant_id, order_id, wine_name, producer, vintage, country, region, quantity, unit, unit_price_sek, total_price_sek, line_number)
  VALUES
    (v_tenant_id, v_order_3_id, 'Gaja Barbaresco', 'Gaja', '2018', 'Italy', 'Piedmont', 6, 'flaska', 2000.00, 12000.00, 1),
    (v_tenant_id, v_order_3_id, 'Giacomo Conterno Barolo', 'Giacomo Conterno', '2017', 'Italy', 'Piedmont', 6, 'flaska', 1800.00, 10800.00, 2);

  -- Events for order 3
  INSERT INTO order_events (tenant_id, order_id, event_type, to_status, note, actor_user_id, actor_name, created_at)
  VALUES
    (v_tenant_id, v_order_3_id, 'ORDER_CREATED', 'CONFIRMED', 'Order created from accepted offer', v_corentin_user_id, 'Corentin (Brasri)', NOW() - INTERVAL '15 days'),
    (v_tenant_id, v_order_3_id, 'STATUS_CHANGED', 'IN_FULFILLMENT', 'Started fulfillment process', v_corentin_user_id, 'Corentin (Brasri)', NOW() - INTERVAL '12 days'),
    (v_tenant_id, v_order_3_id, 'STATUS_CHANGED', 'SHIPPED', 'Order shipped via DHL', v_corentin_user_id, 'Corentin (Brasri)', NOW() - INTERVAL '3 days');

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST DATA CREATED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Restaurant: Test Kitchen Stockholm';
  RAISE NOTICE 'Request: French wines (Bourgogne/Rhône)';
  RAISE NOTICE '';
  RAISE NOTICE 'Orders for Brasri IOR:';
  RAISE NOTICE '  1. CONFIRMED - 4 lines, 48 bottles (French wines)';
  RAISE NOTICE '  2. IN_FULFILLMENT - 2 lines, 12 bottles (Italian wines)';
  RAISE NOTICE '  3. SHIPPED - 2 lines, 12 bottles (Italian wines)';
  RAISE NOTICE '';
  RAISE NOTICE 'Corentin can now:';
  RAISE NOTICE '  - View orders as IOR in /supplier/orders';
  RAISE NOTICE '  - Update order statuses';
  RAISE NOTICE '  - See order history and events';
  RAISE NOTICE '========================================';

END $$;
