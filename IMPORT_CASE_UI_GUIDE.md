# Import Case UI - Användningsguide

## Översikt

Minimal klickbar UI för Import Case MVP. Konsumerar befintliga API endpoints utan att lägga till ny backend-logik.

## Sidor

### 1. `/imports/new` - Skapa nytt import case

**Funktionalitet:**
- Formulär för att skapa ett nytt importcase
- Input för: restaurant_id, importer_id, delivery_location_id, supplier_id (valfri)
- POST till `/api/imports`
- Redirectar till `/imports/[id]` vid framgång

**URL:** `http://localhost:3000/imports/new`

**Test:**
1. Navigera till `/imports/new`
2. Fyll i UUID:n för restaurang, importör och leveransplats
3. Klicka "Skapa Import Case"
4. Redirectas till detaljsidan

### 2. `/imports/[id]` - Import case detaljer

**Funktionalitet:**
- Visar grundläggande information (restaurang, importör, leveransplats)
- Status timeline med alla statusändringar
- Lista över genererade dokument
- Åtgärdspanel med knappar
- Supplier import widget

**URL:** `http://localhost:3000/imports/<import-id>`

**Komponenter:**

#### Grundläggande Information
- Restaurangnamn och kontakt
- Importörnamn och org nummer
- Leveransplats adress och status
- Leverantör (om angiven)

#### Status Timeline (`StatusTimeline`)
- Visar aktuell status med färgkodad badge
- Timeline med alla statusändringar
- Visar from_status → to_status
- Tidsstämplar och noter

#### Dokument (`DocumentList`)
- Lista över genererade dokument
- Visar typ, version, skapad datum
- SHA-256 hash (trunkerad)
- Storage path
- Nedladdningslänk (placeholder)

#### Åtgärdspanel (`ActionsPanel`)

**1. Validate Shipment**
- Knapp: "🚚 Validate Shipment"
- POST till `/api/imports/[id]/validate-shipment`
- Visar resultat:
  - ✅ Grön box om valid=true
  - ❌ Röd box om valid=false med error_code och error_message

**2. Generera 5369**
- Knapp: "📄 Generera 5369_03"
- POST till `/api/imports/[id]/documents/5369`
- Visar resultat:
  - ✅ Grön box med version och storage_path
  - ❌ Röd box vid fel
- Refreshar sidan för att visa nytt dokument i listan

**3. Ändra Status**
- Knappar:
  - "📤 Submit" → SUBMITTED
  - "✅ Approve" → APPROVED
  - "❌ Reject" → REJECTED
- POST till `/api/imports/[id]/status`
- Refreshar sidan för att visa ny status

#### Supplier Import Widget (`SupplierImportWidget`)
- Input för supplier_import_id
- Knapp "Koppla" → POST till `/api/imports/[id]/attach-supplier-import`
- Lista över kopplade supplier imports
- Visar UUID och datum

## Komponenter

### `/app/imports/components/StatusTimeline.tsx`
**Props:**
- `events: StatusEvent[]` - Array av statusändringar
- `currentStatus: string` - Aktuell status

**Funktionalitet:**
- Visar aktuell status badge
- Timeline med färgkodade dots
- Från/till status labels
- Tidsstämplar

### `/app/imports/components/DocumentList.tsx`
**Props:**
- `documents: Document[]` - Array av dokument

**Funktionalitet:**
- Lista över dokument
- Typ label (SKV_5369_03 → "Skatteverket 5369_03")
- Version badge
- Hash och storage path
- Nedladdningslänk (placeholder)

### `/app/imports/components/ActionsPanel.tsx`
**Props:**
- `importId: string` - Import case ID
- `currentStatus: string` - Aktuell status
- `onRefresh: () => void` - Callback för att uppdatera data

**Funktionalitet:**
- Validate shipment med resultatvisning
- Generate 5369 med resultatvisning
- Status ändrings-knappar (disabled baserat på aktuell status)
- Loading states

### `/app/imports/components/SupplierImportWidget.tsx`
**Props:**
- `importId: string` - Import case ID
- `linkedImports: SupplierImport[]` - Array av kopplade imports
- `onRefresh: () => void` - Callback för att uppdatera data

**Funktionalitet:**
- Input + knapp för att koppla supplier import
- Lista över kopplade supplier imports
- Success/error meddelanden

## Användarflöde

### Happy Path: Skapa och godkänna import case

1. **Skapa import case**
   - Gå till `/imports/new`
   - Fyll i UUID:n
   - Klicka "Skapa Import Case"
   - Redirectas till `/imports/[id]`

2. **Validera (förväntat FAIL)**
   - På detaljsidan, klicka "🚚 Validate Shipment"
   - Se röd box med error: "IMPORT_NOT_APPROVED"

3. **Godkänn import case**
   - Klicka "📤 Submit"
   - Se status ändras till SUBMITTED i timeline
   - Klicka "✅ Approve"
   - Se status ändras till APPROVED i timeline

4. **Validera igen (förväntat PASS)**
   - Klicka "🚚 Validate Shipment" igen
   - Se grön box: "Validering OK - Leverans kan genomföras"

5. **Generera dokument**
   - Klicka "📄 Generera 5369_03"
   - Se grön box med version och path
   - Se dokument dyka upp i "Dokument" sektionen

6. **Koppla supplier import (valfri)**
   - Ange UUID för en supplier_import
   - Klicka "Koppla"
   - Se success-meddelande
   - Se kopplingen i listan

## Testdata

För att testa UI:n behöver du:

1. **Restaurant ID** - UUID för en restaurang i databasen
2. **Importer ID** - UUID för en importör (med type='SE' eller 'EU_PARTNER')
3. **Delivery Location ID** - UUID för en godkänd (APPROVED) direkt leveransplats

**Exempel testkommandon:**

```sql
-- Skapa testdata
INSERT INTO restaurants (tenant_id, name, org_number, contact_email, contact_phone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Restaurant AB',
  '123456-7890',
  'test@restaurant.se',
  '+46701234567'
)
RETURNING id;

INSERT INTO importers (tenant_id, legal_name, org_number, contact_name, contact_email, contact_phone, type)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Importer AB',
  '234567-8901',
  'Test Person',
  'test@importer.se',
  '+46709876543',
  'SE'
)
RETURNING id;

-- Skapa godkänd DDL (använd IDs från ovan)
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
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '<RESTAURANT_ID>',
  '<IMPORTER_ID>',
  'Test Restaurant AB',
  '123456-7890',
  'Test Street 123',
  '12345',
  'Stockholm',
  'SE',
  'Test Manager',
  'manager@restaurant.se',
  '+46701112233',
  true,
  NOW(),
  'APPROVED'
)
RETURNING id;
```

## Styling

**Tailwind CSS** används för all styling:
- Färgschema: primary, secondary, accent, muted
- Komponenter: card, border, rounded
- Layout: grid, flex, space-y/x
- Responsive: md:, lg: breakpoints

**Färgkodning:**
- NOT_REGISTERED: Grå
- SUBMITTED: Blå
- APPROVED: Grön
- REJECTED: Röd

## API Integration

Alla API-anrop använder:
- Header: `x-tenant-id: 00000000-0000-0000-0000-000000000001`
- Header: `x-user-id: 00000000-0000-0000-0000-000000000001` (för mutations)

**Endpoints som konsumeras:**
1. POST `/api/imports` - Skapa import case
2. GET `/api/imports/[id]` - Hämta detaljer
3. POST `/api/imports/[id]/validate-shipment` - Validera
4. POST `/api/imports/[id]/documents/5369` - Generera dokument
5. GET `/api/imports/[id]/documents` - Lista dokument
6. **GET `/api/imports/[id]/documents/[docId]/download`** - Hämta signed URL för nedladdning ✅
7. POST `/api/imports/[id]/status` - Ändra status
8. POST `/api/imports/[id]/attach-supplier-import` - Koppla supplier import
9. GET `/api/imports/[id]/supplier-imports` - Lista kopplade supplier imports

## Error Handling

**Formulär errors:**
- Visas i röd box över formuläret
- Tydligt felmeddelande från API

**Validation errors:**
- Röd box med error_code och error_message
- Svenska felmeddelanden

**Document generation errors:**
- Röd box med felmeddelande
- Ingen refresh om det misslyckas

**Status change errors:**
- Alert popup med felmeddelande
- 409 för ogiltiga transitions
- Ingen refresh om det misslyckas

## Begränsningar (MVP)

- Ingen pagination (listar alla dokument/supplier imports)
- ~~Ingen nedladdning av PDFs~~ **✅ Implementerat! Fungerar via signed URLs**
- Hårdkodade tenant_id och user_id
- Ingen autentisering/auktorisering i UI
- Inga toast notifications (används inline success/error boxar)
- Ingen real-time uppdatering (manuell refresh med knappar)

## Filstruktur

```
app/
  imports/
    new/
      page.tsx              # Skapa import case
    [id]/
      page.tsx              # Detaljer för import case
    components/
      StatusTimeline.tsx    # Status timeline
      DocumentList.tsx      # Dokument lista
      ActionsPanel.tsx      # Knappar för actions
      SupplierImportWidget.tsx  # Supplier import koppling
```

## Utveckling

**Starta dev server:**
```bash
npm run dev
```

**Testa UI:**
1. Gå till `http://localhost:3000/imports/new`
2. Skapa import case med test-UUIDs
3. Klicka runt och testa alla funktioner

**Hot reload:**
- Alla ändringar i `.tsx` filer triggrar automatisk reload
- API endpoints behöver inte startas om

## Nästa steg (utanför scope)

- [ ] Lägg till toast notifications (react-hot-toast)
- [ ] Implementera PDF nedladdning (signed URLs från Supabase Storage)
- [ ] Lägg till autentisering (Supabase Auth)
- [ ] Skapa lista/dashboard sida (`/imports`)
- [ ] Lägg till sökfunktion
- [ ] Pagination för stora listor
- [ ] Real-time uppdateringar (Supabase Realtime)
- [ ] Form validation (zod + react-hook-form)
