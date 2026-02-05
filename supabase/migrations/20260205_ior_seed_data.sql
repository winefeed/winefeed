-- IOR Portfolio Seed Data
-- Creates sample producers, products, and cases for development/testing
-- Only runs if no producers exist for the importer

DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_importer_id UUID;
  v_producer_small UUID;
  v_producer_medium UUID;
  v_producer_large UUID;
  v_product_id UUID;
  v_case_id UUID;
  i INTEGER;
BEGIN
  -- Get first importer for tenant (assumes one exists from prior setup)
  SELECT id INTO v_importer_id
  FROM importers
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  -- If no importer exists, skip seeding
  IF v_importer_id IS NULL THEN
    RAISE NOTICE '[IOR Seed] No importer found for tenant %, skipping seed data', v_tenant_id;
    RETURN;
  END IF;

  -- Check if already seeded (idempotent)
  IF EXISTS (SELECT 1 FROM ior_producers WHERE importer_id = v_importer_id LIMIT 1) THEN
    RAISE NOTICE '[IOR Seed] Seed data already exists for importer %, skipping', v_importer_id;
    RETURN;
  END IF;

  RAISE NOTICE '[IOR Seed] Creating seed data for importer %', v_importer_id;

  -- =========================================================================
  -- PRODUCER 1: Small producer (France, 1 product)
  -- =========================================================================
  INSERT INTO ior_producers (
    id, tenant_id, importer_id, name, legal_name, country, region,
    contact_name, contact_email, is_active, onboarded_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_importer_id,
    'Domaine du Petit Vignoble', 'Domaine du Petit Vignoble SARL',
    'France', 'Burgundy',
    'Jean-Pierre Moreau', 'jp.moreau@petitvig.fr',
    true, NOW() - INTERVAL '6 months'
  ) RETURNING id INTO v_producer_small;

  INSERT INTO ior_products (
    tenant_id, importer_id, producer_id, name, vintage, wine_type,
    grape_varieties, appellation, alcohol_pct, is_active
  ) VALUES (
    v_tenant_id, v_importer_id, v_producer_small,
    'Bourgogne Pinot Noir', 2022, 'RED',
    ARRAY['Pinot Noir'], 'Bourgogne AOC', 13.0, true
  );

  RAISE NOTICE '[IOR Seed] Created producer: Domaine du Petit Vignoble (1 product)';

  -- =========================================================================
  -- PRODUCER 2: Medium producer (Argentina, 5 products)
  -- =========================================================================
  INSERT INTO ior_producers (
    id, tenant_id, importer_id, name, legal_name, country, region,
    contact_name, contact_email, contact_phone, website_url,
    is_active, onboarded_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_importer_id,
    'Bodega Los Andes', 'Bodega Los Andes S.A.',
    'Argentina', 'Mendoza',
    'María González', 'maria@losandes.com.ar', '+54 261 555 1234',
    'https://www.bodegalosandes.com.ar',
    true, NOW() - INTERVAL '3 months'
  ) RETURNING id INTO v_producer_medium;

  INSERT INTO ior_products (tenant_id, importer_id, producer_id, name, vintage, wine_type, grape_varieties, appellation, alcohol_pct, is_active) VALUES
    (v_tenant_id, v_importer_id, v_producer_medium, 'Malbec Reserva', 2021, 'RED', ARRAY['Malbec'], 'Mendoza', 14.5, true),
    (v_tenant_id, v_importer_id, v_producer_medium, 'Malbec Gran Reserva', 2020, 'RED', ARRAY['Malbec'], 'Luján de Cuyo', 15.0, true),
    (v_tenant_id, v_importer_id, v_producer_medium, 'Torrontés', 2023, 'WHITE', ARRAY['Torrontés'], 'Salta', 13.5, true),
    (v_tenant_id, v_importer_id, v_producer_medium, 'Cabernet Sauvignon', 2021, 'RED', ARRAY['Cabernet Sauvignon'], 'Mendoza', 14.0, true),
    (v_tenant_id, v_importer_id, v_producer_medium, 'Rosado de Malbec', 2023, 'ROSE', ARRAY['Malbec'], 'Mendoza', 12.5, true);

  RAISE NOTICE '[IOR Seed] Created producer: Bodega Los Andes (5 products)';

  -- =========================================================================
  -- PRODUCER 3: Large producer (Italy, 100 products) - for pagination testing
  -- =========================================================================
  INSERT INTO ior_producers (
    id, tenant_id, importer_id, name, legal_name, country, region,
    contact_name, contact_email, contact_phone, website_url,
    logo_url, is_active, onboarded_at, notes
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_importer_id,
    'Castello Grande Vini', 'Castello Grande Vini S.p.A.',
    'Italy', 'Tuscany',
    'Marco Bianchi', 'export@castellograndevini.it', '+39 055 555 6789',
    'https://www.castellograndevini.it',
    '/images/producers/castello-placeholder.png',
    true, NOW() - INTERVAL '1 year',
    'Major producer with extensive portfolio. Key partner for Italian wines.'
  ) RETURNING id INTO v_producer_large;

  -- Generate 100 products for the large producer
  FOR i IN 1..100 LOOP
    INSERT INTO ior_products (
      tenant_id, importer_id, producer_id, name, vintage, wine_type,
      grape_varieties, appellation, alcohol_pct, bottle_size_ml, case_size, is_active
    ) VALUES (
      v_tenant_id, v_importer_id, v_producer_large,
      CASE
        WHEN i <= 30 THEN 'Chianti Classico ' || CASE WHEN i % 5 = 0 THEN 'Riserva ' ELSE '' END || 'Cru ' || i
        WHEN i <= 50 THEN 'Brunello di Montalcino ' || CASE WHEN i % 3 = 0 THEN 'Riserva ' ELSE '' END || i
        WHEN i <= 70 THEN 'Vino Nobile ' || i
        WHEN i <= 85 THEN 'Vernaccia di San Gimignano ' || i
        ELSE 'Vin Santo ' || i
      END,
      2018 + (i % 6),  -- Vintages from 2018 to 2023
      CASE
        WHEN i <= 70 THEN 'RED'
        WHEN i <= 85 THEN 'WHITE'
        ELSE 'DESSERT'
      END::ior_wine_type,
      CASE
        WHEN i <= 50 THEN ARRAY['Sangiovese']
        WHEN i <= 70 THEN ARRAY['Sangiovese', 'Merlot']
        WHEN i <= 85 THEN ARRAY['Vernaccia']
        ELSE ARRAY['Trebbiano', 'Malvasia']
      END,
      CASE
        WHEN i <= 30 THEN 'Chianti Classico DOCG'
        WHEN i <= 50 THEN 'Brunello di Montalcino DOCG'
        WHEN i <= 70 THEN 'Vino Nobile di Montepulciano DOCG'
        WHEN i <= 85 THEN 'Vernaccia di San Gimignano DOCG'
        ELSE 'Vin Santo del Chianti DOC'
      END,
      CASE WHEN i <= 70 THEN 13.5 + (i % 20) * 0.1 ELSE 15.0 + (i % 5) * 0.5 END,
      CASE WHEN i > 85 THEN 375 ELSE 750 END,  -- Vin Santo in half bottles
      CASE WHEN i > 85 THEN 12 ELSE 6 END,
      true
    );
  END LOOP;

  RAISE NOTICE '[IOR Seed] Created producer: Castello Grande Vini (100 products)';

  -- =========================================================================
  -- SAMPLE PRICE LIST (for Bodega Los Andes, SE market)
  -- =========================================================================
  DECLARE
    v_price_list_id UUID;
  BEGIN
    INSERT INTO ior_price_lists (
      tenant_id, importer_id, producer_id, name, market, currency,
      status, valid_from, valid_to
    ) VALUES (
      v_tenant_id, v_importer_id, v_producer_medium,
      'Sweden 2024', 'SE', 'SEK',
      'ACTIVE', '2024-01-01', '2024-12-31'
    ) RETURNING id INTO v_price_list_id;

    -- Add price list items for all 5 products
    INSERT INTO ior_price_list_items (price_list_id, product_id, price_per_bottle_ore, price_per_case_ore, min_order_qty)
    SELECT
      v_price_list_id,
      id,
      CASE
        WHEN name LIKE '%Gran Reserva%' THEN 34900  -- 349 SEK
        WHEN name LIKE '%Reserva%' THEN 24900      -- 249 SEK
        ELSE 14900                                  -- 149 SEK
      END,
      CASE
        WHEN name LIKE '%Gran Reserva%' THEN 34900 * 6 * 0.95  -- 5% case discount
        WHEN name LIKE '%Reserva%' THEN 24900 * 6 * 0.95
        ELSE 14900 * 6 * 0.95
      END,
      6  -- MOQ 6 bottles
    FROM ior_products
    WHERE producer_id = v_producer_medium;

    RAISE NOTICE '[IOR Seed] Created price list: Sweden 2024 for Bodega Los Andes';
  END;

  -- =========================================================================
  -- SAMPLE TRADE TERMS
  -- =========================================================================
  INSERT INTO ior_trade_terms (
    tenant_id, importer_id, producer_id, market,
    payment_terms_days, incoterms, moq_cases, lead_time_days,
    volume_discounts, notes
  ) VALUES (
    v_tenant_id, v_importer_id, v_producer_medium, 'SE',
    30, 'EXW', 10, 21,
    '[{"qty_cases": 50, "discount_pct": 3}, {"qty_cases": 100, "discount_pct": 5}, {"qty_cases": 200, "discount_pct": 8}]'::jsonb,
    'Standard terms. Volume discounts apply to full pallets.'
  );

  RAISE NOTICE '[IOR Seed] Created trade terms for Bodega Los Andes (SE market)';

  -- =========================================================================
  -- SAMPLE COMMUNICATION CASES
  -- =========================================================================

  -- Case 1: OPEN, HIGH priority (urgent action needed)
  INSERT INTO ior_communication_cases (
    id, tenant_id, importer_id, producer_id, subject, category,
    status, priority, due_at, created_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_importer_id, v_producer_medium,
    'Q2 2024 Price Update Request', 'pricing',
    'OPEN', 'HIGH',
    NOW() + INTERVAL '2 days',
    NOW() - INTERVAL '3 days'
  ) RETURNING id INTO v_case_id;

  INSERT INTO ior_case_messages (case_id, content, direction, sender_type, sender_name, template_id, created_at)
  VALUES (
    v_case_id,
    'Dear María,

We are preparing for Q2 2024 and would like to request your updated price list for the Swedish market.

Please include current vintage availability and any new releases.

Best regards,
Import Team',
    'OUTBOUND', 'IOR_USER', 'Import Team', 'price_update_request',
    NOW() - INTERVAL '3 days'
  );

  RAISE NOTICE '[IOR Seed] Created case: Q2 2024 Price Update Request (OPEN, HIGH)';

  -- Case 2: WAITING_INTERNAL (producer replied, needs IOR action)
  INSERT INTO ior_communication_cases (
    id, tenant_id, importer_id, producer_id, subject, category,
    status, priority, due_at, created_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_importer_id, v_producer_large,
    'Delivery Delay - Order #IT-2024-0089', 'logistics',
    'WAITING_INTERNAL', 'NORMAL',
    NOW() + INTERVAL '5 days',
    NOW() - INTERVAL '7 days'
  ) RETURNING id INTO v_case_id;

  INSERT INTO ior_case_messages (case_id, content, direction, sender_type, sender_name, created_at) VALUES
  (v_case_id, 'Hi Marco,

We noticed that order #IT-2024-0089 has not shipped yet. Could you please provide an update on the expected dispatch date?

Best regards,
Import Team', 'OUTBOUND', 'IOR_USER', 'Import Team', NOW() - INTERVAL '7 days'),
  (v_case_id, 'Dear Import Team,

Apologies for the delay. We had an unexpected issue with the bottling line. The order is now ready and will ship on Monday.

New ETA: 2 weeks from shipment.

Best regards,
Marco Bianchi
Export Manager', 'INBOUND', 'PRODUCER', 'Marco Bianchi', NOW() - INTERVAL '2 days');

  RAISE NOTICE '[IOR Seed] Created case: Delivery Delay (WAITING_INTERNAL)';

  -- Case 3: WAITING_PRODUCER (awaiting producer response)
  INSERT INTO ior_communication_cases (
    id, tenant_id, importer_id, producer_id, subject, category,
    status, priority, due_at, created_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_importer_id, v_producer_small,
    'Vintage 2023 Availability Inquiry', 'general',
    'WAITING_PRODUCER', 'LOW',
    NOW() + INTERVAL '14 days',
    NOW() - INTERVAL '5 days'
  ) RETURNING id INTO v_case_id;

  INSERT INTO ior_case_messages (case_id, content, direction, sender_type, sender_name, created_at)
  VALUES (v_case_id, 'Bonjour Jean-Pierre,

We are interested in the 2023 vintage. Could you let us know when it will be available and expected allocation?

Merci,
Import Team', 'OUTBOUND', 'IOR_USER', 'Import Team', NOW() - INTERVAL '5 days');

  -- Create email thread for reply tracking
  INSERT INTO ior_email_threads (case_id, thread_token, producer_email)
  VALUES (v_case_id, 'WF-' || substring(gen_random_uuid()::text, 1, 8), 'jp.moreau@petitvig.fr');

  RAISE NOTICE '[IOR Seed] Created case: Vintage 2023 Availability (WAITING_PRODUCER)';

  -- Case 4: RESOLVED (completed case for history)
  INSERT INTO ior_communication_cases (
    id, tenant_id, importer_id, producer_id, subject, category,
    status, priority, resolved_at, created_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_importer_id, v_producer_medium,
    'Certificate of Origin - Order #AR-2024-0045', 'logistics',
    'RESOLVED', 'NORMAL',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '14 days'
  ) RETURNING id INTO v_case_id;

  INSERT INTO ior_case_messages (case_id, content, direction, sender_type, sender_name, attachments, created_at) VALUES
  (v_case_id, 'Please provide the Certificate of Origin for order #AR-2024-0045.', 'OUTBOUND', 'IOR_USER', 'Import Team', '[]'::jsonb, NOW() - INTERVAL '14 days'),
  (v_case_id, 'Please find attached the Certificate of Origin.

Best regards,
María', 'INBOUND', 'PRODUCER', 'María González', '[{"name": "COO_AR-2024-0045.pdf", "url": "/attachments/coo-ar-2024-0045.pdf", "size": 245000, "type": "application/pdf"}]'::jsonb, NOW() - INTERVAL '10 days'),
  (v_case_id, 'Received, thank you!', 'OUTBOUND', 'IOR_USER', 'Import Team', '[]'::jsonb, NOW() - INTERVAL '1 day');

  RAISE NOTICE '[IOR Seed] Created case: Certificate of Origin (RESOLVED)';

  -- =========================================================================
  -- AUDIT LOG ENTRIES
  -- =========================================================================
  INSERT INTO ior_audit_log (tenant_id, importer_id, event_type, entity_type, entity_id, actor_name, payload)
  VALUES
    (v_tenant_id, v_importer_id, 'PRODUCER_CREATED', 'producer', v_producer_small, 'System', '{"source": "seed_data"}'::jsonb),
    (v_tenant_id, v_importer_id, 'PRODUCER_CREATED', 'producer', v_producer_medium, 'System', '{"source": "seed_data"}'::jsonb),
    (v_tenant_id, v_importer_id, 'PRODUCER_CREATED', 'producer', v_producer_large, 'System', '{"source": "seed_data"}'::jsonb);

  RAISE NOTICE '[IOR Seed] Seed data creation completed successfully';

END $$;
