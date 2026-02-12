-- ============================================================================
-- WINEFEED GO-LIVE CLEANUP — Rensa testdata
-- ============================================================================
--
-- Syfte: Ta bort ~95% testdata inför go-live med Brasri som enda leverantör
--
-- BEHÅLLS:
--   - Brasri AB som supplier + importer (tom vinkatalog)
--   - 7 IOR-producenter kopplade till Brasri
--   - 3 auth users: markus@esima.se, corentin@brasri.com, markus_nilsson@hotmail.com
--   - 1 admin_user: markus@esima.se (corentin tas bort som admin)
--   - 1 493 wine_knowledge (RAG-data)
--   - 1 tenant (Winefeed)
--
-- RADERAS:
--   - Alla restauranger, förfrågningar, offerter, ordrar
--   - Alla supplier_wines (även Brasris testviner)
--   - Alla test-leverantörer (utom Brasri AB)
--   - Test Importer AB + 3 seed-producenter
--   - 72 test-auth-konton
--   - Corentin som admin (behåller auth + supplier-koppling)
--
-- KÖR I: Supabase SQL Editor (service_role)
-- https://supabase.com/dashboard/project/pqmmgclfpyydrbjaoump/sql
--
-- ⚠️  VIKTIGT: Kör HELA skriptet i en körning.
--     Transaktionen rullas tillbaka om något steg misslyckas.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PRE-CLEANUP: Räkna rader före rensning
-- ============================================================================
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  RAISE NOTICE '========== PRE-CLEANUP COUNTS ==========';

  SELECT count(*) INTO v_count FROM suppliers;
  RAISE NOTICE 'suppliers = %', v_count;

  SELECT count(*) INTO v_count FROM supplier_wines;
  RAISE NOTICE 'supplier_wines = %', v_count;

  SELECT count(*) INTO v_count FROM supplier_users;
  RAISE NOTICE 'supplier_users = %', v_count;

  SELECT count(*) INTO v_count FROM restaurants;
  RAISE NOTICE 'restaurants = %', v_count;

  SELECT count(*) INTO v_count FROM restaurant_users;
  RAISE NOTICE 'restaurant_users = %', v_count;

  SELECT count(*) INTO v_count FROM requests;
  RAISE NOTICE 'requests = %', v_count;

  SELECT count(*) INTO v_count FROM offers;
  RAISE NOTICE 'offers = %', v_count;

  SELECT count(*) INTO v_count FROM orders;
  RAISE NOTICE 'orders = %', v_count;

  SELECT count(*) INTO v_count FROM importers;
  RAISE NOTICE 'importers = %', v_count;

  SELECT count(*) INTO v_count FROM ior_producers;
  RAISE NOTICE 'ior_producers = %', v_count;

  SELECT count(*) INTO v_count FROM ior_case_messages;
  RAISE NOTICE 'ior_case_messages = %', v_count;

  SELECT count(*) INTO v_count FROM admin_users;
  RAISE NOTICE 'admin_users = %', v_count;

  SELECT count(*) INTO v_count FROM auth.users;
  RAISE NOTICE 'auth.users = %', v_count;

  SELECT count(*) INTO v_count FROM wine_knowledge;
  RAISE NOTICE 'wine_knowledge = %', v_count;

  RAISE NOTICE '=========================================';
END $$;


-- ============================================================================
-- STEG 1: IOR-kommunikation (leaf-tabeller först)
-- ============================================================================
-- ior_case_messages → FK till ior_communication_cases
DELETE FROM ior_case_messages;

-- ior_email_threads → FK till ior_communication_cases
DELETE FROM ior_email_threads;

-- ior_communication_cases → FK till ior_producers
DELETE FROM ior_communication_cases;

-- ior_audit_log → FK till importers
DELETE FROM ior_audit_log;


-- ============================================================================
-- STEG 2: IOR produkt/pris-data för seed-producenter
-- (Brasris 7 riktiga producenter har inga price lists/trade terms ännu)
-- ============================================================================
DELETE FROM ior_price_list_items;
DELETE FROM ior_price_lists;
DELETE FROM ior_trade_terms;
DELETE FROM ior_products;


-- ============================================================================
-- STEG 3: Order-kedjan (RESTRICT-FKs kräver exakt ordning)
-- order_events → orders (CASCADE, men explicit för tydlighet)
-- order_lines → orders (CASCADE)
-- orders → restaurants, offers, suppliers, importers (alla RESTRICT)
-- ============================================================================
DELETE FROM order_events;
DELETE FROM order_lines;
DELETE FROM orders;


-- ============================================================================
-- STEG 4: Offert-kedjan
-- offer_lines → offers (CASCADE)
-- offer_events → offers (CASCADE)
-- offers → restaurants (CASCADE), requests (SET NULL)
-- ============================================================================
DELETE FROM offer_lines;

DO $$ BEGIN
  DELETE FROM offer_events;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Tabell offer_events finns inte, hoppar över';
END $$;

DELETE FROM commercial_intents;
DELETE FROM offers;


-- ============================================================================
-- STEG 5: Förfrågnings-kedjan
-- request_items → requests (CASCADE)
-- request_events → requests (CASCADE)
-- suggestions → requests (CASCADE)
-- offers_sent → requests (CASCADE) (gammal tabell, kanske finns)
-- requests → restaurants (CASCADE)
-- ============================================================================
DELETE FROM request_items;

DO $$ BEGIN
  DELETE FROM request_events;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Tabell request_events finns inte, hoppar över';
END $$;

DELETE FROM suggestions;

-- offers_sent existerar kanske inte i B2B-schemat, hantera med DO-block
DO $$ BEGIN
  DELETE FROM offers_sent;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Tabell offers_sent finns inte, hoppar över';
END $$;

DELETE FROM requests;


-- ============================================================================
-- STEG 6: Restauranger
-- restaurant_users → restaurants (CASCADE), auth.users (CASCADE)
-- restaurant_delivery_addresses → restaurants
-- restaurants → auth.users (CASCADE)
-- ============================================================================
DELETE FROM restaurant_users;

DO $$ BEGIN
  DELETE FROM restaurant_delivery_addresses;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Tabell restaurant_delivery_addresses finns inte, hoppar över';
END $$;

DO $$ BEGIN
  DELETE FROM sommelier_profiles;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Tabell sommelier_profiles finns inte, hoppar över';
END $$;

-- Import-kedjan (refererar till restaurants)
DO $$ BEGIN
  DELETE FROM import_documents;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM import_status_events;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM supplier_imports;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM imports;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM direct_delivery_locations;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DELETE FROM restaurants;


-- ============================================================================
-- STEG 7: Supplier wines (ALLA — även Brasris testviner)
-- supplier_wines → suppliers (CASCADE)
-- ============================================================================
DELETE FROM supplier_wines;


-- ============================================================================
-- STEG 8: Supplier users (behåll Brasri-kopplingar)
-- supplier_users → suppliers (CASCADE), auth.users (CASCADE)
-- ============================================================================
DELETE FROM supplier_users
WHERE supplier_id NOT IN (
  SELECT id FROM suppliers WHERE namn = 'Brasri AB'
);


-- ============================================================================
-- STEG 9: Suppliers (behåll Brasri AB)
-- suppliers → CASCADE till supplier_wines, supplier_users (redan tömda)
-- ============================================================================
DELETE FROM suppliers WHERE namn != 'Brasri AB';


-- ============================================================================
-- STEG 10: IOR seed-producenter (de 3 från Test Importer)
-- ior_producers → importers (CASCADE)
-- Producenter kopplade till Brasri behålls (7 st)
-- ============================================================================
DELETE FROM ior_producers
WHERE importer_id IN (
  SELECT id FROM importers WHERE legal_name != 'Brasri AB'
);


-- ============================================================================
-- STEG 11: Importers (ta bort Test Importer AB, behåll Brasri AB)
-- ============================================================================
DELETE FROM importers WHERE legal_name != 'Brasri AB';


-- ============================================================================
-- STEG 12: Ta bort corentin som admin
-- (behåller auth-konto + supplier_users-koppling till Brasri)
-- ============================================================================
DELETE FROM admin_users
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'corentin@brasri.com'
);


-- ============================================================================
-- STEG 13: Övriga test-tabeller
-- ============================================================================

-- Inbjudningar
DO $$ BEGIN
  DELETE FROM invites;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Notifieringar
DO $$ BEGIN
  DELETE FROM notifications;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Prenumerationer & sponsring
DO $$ BEGIN
  DELETE FROM subscriptions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM sponsored_slots;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Gamla schematabeller
DO $$ BEGIN
  DELETE FROM wine_suppliers;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM wines;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ============================================================================
-- STEG 14: Auth users (ta bort 72 testkonton)
-- Behåller: markus@esima.se, corentin@brasri.com, markus_nilsson@hotmail.com
--
-- CASCADE hanterar:
--   - restaurant_users (redan borta)
--   - supplier_users (redan borta för test-users)
--   - admin_users (redan borta för corentin)
-- ============================================================================
DELETE FROM auth.users
WHERE email NOT IN (
  'markus@esima.se',
  'corentin@brasri.com',
  'markus_nilsson@hotmail.com'
);


-- ============================================================================
-- POST-CLEANUP: Verifiera resultat
-- ============================================================================
DO $$
DECLARE
  v_count BIGINT;
  v_ok BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '========== POST-CLEANUP VERIFICATION ==========';

  -- suppliers → 1 (Brasri AB)
  SELECT count(*) INTO v_count FROM suppliers;
  RAISE NOTICE 'suppliers = % (förväntat: 1)', v_count;
  IF v_count != 1 THEN v_ok := FALSE; RAISE WARNING '❌ suppliers: förväntat 1, fick %', v_count; END IF;

  -- supplier_wines → 0
  SELECT count(*) INTO v_count FROM supplier_wines;
  RAISE NOTICE 'supplier_wines = % (förväntat: 0)', v_count;
  IF v_count != 0 THEN v_ok := FALSE; RAISE WARNING '❌ supplier_wines: förväntat 0, fick %', v_count; END IF;

  -- restaurants → 0
  SELECT count(*) INTO v_count FROM restaurants;
  RAISE NOTICE 'restaurants = % (förväntat: 0)', v_count;
  IF v_count != 0 THEN v_ok := FALSE; RAISE WARNING '❌ restaurants: förväntat 0, fick %', v_count; END IF;

  -- requests → 0
  SELECT count(*) INTO v_count FROM requests;
  RAISE NOTICE 'requests = % (förväntat: 0)', v_count;
  IF v_count != 0 THEN v_ok := FALSE; RAISE WARNING '❌ requests: förväntat 0, fick %', v_count; END IF;

  -- offers → 0
  SELECT count(*) INTO v_count FROM offers;
  RAISE NOTICE 'offers = % (förväntat: 0)', v_count;
  IF v_count != 0 THEN v_ok := FALSE; RAISE WARNING '❌ offers: förväntat 0, fick %', v_count; END IF;

  -- orders → 0
  SELECT count(*) INTO v_count FROM orders;
  RAISE NOTICE 'orders = % (förväntat: 0)', v_count;
  IF v_count != 0 THEN v_ok := FALSE; RAISE WARNING '❌ orders: förväntat 0, fick %', v_count; END IF;

  -- importers → 1 (Brasri AB)
  SELECT count(*) INTO v_count FROM importers;
  RAISE NOTICE 'importers = % (förväntat: 1)', v_count;
  IF v_count != 1 THEN v_ok := FALSE; RAISE WARNING '❌ importers: förväntat 1, fick %', v_count; END IF;

  -- ior_producers → 7 (Brasris riktiga producenter)
  SELECT count(*) INTO v_count FROM ior_producers;
  RAISE NOTICE 'ior_producers = % (förväntat: 7)', v_count;
  IF v_count != 7 THEN v_ok := FALSE; RAISE WARNING '❌ ior_producers: förväntat 7, fick %', v_count; END IF;

  -- wine_knowledge → ~1493 (RAG-data, orörda)
  SELECT count(*) INTO v_count FROM wine_knowledge;
  RAISE NOTICE 'wine_knowledge = % (förväntat: ~1493)', v_count;
  IF v_count < 1400 THEN v_ok := FALSE; RAISE WARNING '❌ wine_knowledge: förväntat ~1493, fick %', v_count; END IF;

  -- admin_users → 1 (markus@esima.se)
  SELECT count(*) INTO v_count FROM admin_users;
  RAISE NOTICE 'admin_users = % (förväntat: 1)', v_count;

  -- auth.users → 3
  SELECT count(*) INTO v_count FROM auth.users;
  RAISE NOTICE 'auth.users = % (förväntat: 3)', v_count;
  IF v_count != 3 THEN v_ok := FALSE; RAISE WARNING '❌ auth.users: förväntat 3, fick %', v_count; END IF;

  -- supplier_users (Brasri-kopplingar kvar)
  SELECT count(*) INTO v_count FROM supplier_users;
  RAISE NOTICE 'supplier_users = % (Brasri-kopplingar)', v_count;

  -- Visa kvarvarande auth users
  RAISE NOTICE '--- Kvarvarande auth users ---';
  FOR v_count IN
    SELECT 1  -- dummy, vi använder en separat loop
  LOOP NULL; END LOOP;

  IF v_ok THEN
    RAISE NOTICE '✅ Alla verifieringar passerade!';
  ELSE
    RAISE WARNING '⚠️  Vissa verifieringar misslyckades — kontrollera ovan';
  END IF;

  RAISE NOTICE '===============================================';
END $$;

-- Lista kvarvarande auth users (utanför DO-blocket för att se resultatet)
SELECT email, created_at FROM auth.users ORDER BY created_at;

-- Lista kvarvarande suppliers
SELECT id, namn, kontakt_email FROM suppliers;

-- Lista kvarvarande importers
SELECT id, legal_name, contact_email FROM importers;

-- Lista kvarvarande ior_producers
SELECT id, name, country, region FROM ior_producers;

-- Lista kvarvarande admin_users
SELECT au.id, u.email, au.created_at
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id;

COMMIT;
