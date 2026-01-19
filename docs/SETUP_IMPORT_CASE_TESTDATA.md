# Setup Import Case Test Data

## Problem
Migrations för Import Case har inte körts än, så tabellerna `importers`, `imports`, `direct_delivery_locations` etc. finns inte.

## Lösning: Kör SQL i Supabase Dashboard

### Steg 1: Gå till Supabase Dashboard

1. Öppna: https://supabase.com/dashboard
2. Logga in
3. Välj ditt projekt: **pqmmgclfpyydrbjaoump**
4. Klicka på **SQL Editor** i vänstermenyn

### Steg 2: Kör migrations

Kopiera och kör varje SQL-fil i ordning:

**1. Skapa importers tabell:**
```sql
-- File: supabase/migrations/20260115_create_importers_table.sql
```
Öppna filen `/supabase/migrations/20260115_create_importers_table.sql` och kopiera innehållet.

**2. Skapa imports tabell:**
```sql
-- File: supabase/migrations/20260115_create_imports_table.sql
```

**3. Skapa import_status_events:**
```sql
-- File: supabase/migrations/20260115_create_import_status_events.sql
```

**4. Lägg till import_id på supplier_imports:**
```sql
-- File: supabase/migrations/20260115_add_import_id_to_supplier_imports.sql
```

**5. Skapa import_documents:**
```sql
-- File: supabase/migrations/20260115_create_import_documents.sql
```

**6. Enable RLS:**
```sql
-- File: supabase/migrations/20260115_enable_rls_imports.sql
```

### Steg 3: Skapa testdata

Kör detta SQL för att skapa testdata:

```sql
DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_restaurant_id UUID := 'ad82ba05-3496-4c79-a25c-e2a591692820'; -- Existing restaurant
  v_importer_id UUID;
  v_ddl_id UUID;
  v_supplier_id UUID := (SELECT id FROM suppliers LIMIT 1); -- Use existing supplier
BEGIN

  -- Create importer
  INSERT INTO importers (
    tenant_id, legal_name, org_number, contact_name,
    contact_email, contact_phone, type
  ) VALUES (
    v_tenant_id, 'Test Importer AB', '559876-5432', 'Anna Andersson',
    'anna@testimporter.se', '+46709876543', 'SE'
  )
  RETURNING id INTO v_importer_id;

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
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST DATA CREATED:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Restaurant ID:         %', v_restaurant_id;
  RAISE NOTICE 'Importer ID:           %', v_importer_id;
  RAISE NOTICE 'Delivery Location ID:  %', v_ddl_id;
  RAISE NOTICE 'Supplier ID:           %', v_supplier_id;
  RAISE NOTICE '========================================';

END $$;
```

### Steg 4: Kopiera ID:na

När SQL har körts, kolla "Messages" i SQL Editor för att se de genererade UUID:na.

Kopiera:
- **Restaurant ID**
- **Importer ID**
- **Delivery Location ID**
- **Supplier ID** (optional)

### Steg 5: Testa i UI

Gå till: `http://localhost:3000/imports/new`

Klistra in ID:na och klicka "Skapa Import Case"!

---

## Alternativ: Använd befintlig restaurant

Om du redan har en restaurant med ID: `ad82ba05-3496-4c79-a25c-e2a591692820`

Du kan använda det direkt i formuläret (efter att ha kört migrations och skapat importer + DDL).
