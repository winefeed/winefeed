# Winefeed Offer Flow - Komplett Testguide

**Date:** 2026-01-14
**Status:** 🧪 Ready for Testing
**Duration:** ~15 minuter

---

## 📋 Översikt

Denna guide visar hur man testar hela offer-flödet från början till slut:

```
1. Skapa Supplier → 2. Importera Katalog → 3. Skapa Quote Request
                                               ↓
                     6. Acceptera Offer ← 5. Visa Offers ← 4. Dispatch
```

---

## 🚀 Setup (Förutsättningar)

### Starta Servern
```bash
cd "/Users/markusnilsson/Downloads/Winefeed claude"
npm run dev
```

Server körs på: `http://localhost:3000`

### Kontrollera att databas är igång
```bash
# Kolla Supabase status
# Om du använder lokal Supabase:
supabase status

# Du ska se:
# - API URL: http://localhost:54321
# - Studio URL: http://localhost:54323
```

---

## 🎬 Test Flow (Steg-för-Steg)

### STEG 1: Skapa Restaurant (Setup)

**API Call:**
```bash
# Skapa restaurant via Supabase (manual setup)
curl -X POST 'http://localhost:54321/auth/v1/signup' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_ANON_KEY' \
  -d '{
    "email": "restaurant@test.se",
    "password": "Test123456!",
    "data": {
      "name": "Test Restaurant",
      "user_type": "restaurant"
    }
  }'
```

**Output:** Spara `user.id` (detta är restaurant_id)

**Eller via Supabase Studio:**
1. Öppna `http://localhost:54323`
2. Gå till Authentication → Users
3. Klicka "Add User"
4. Email: `restaurant@test.se`
5. Password: `Test123456!`
6. Kopiera user ID

**Skapa restaurant-post:**
```bash
# Ersätt USER_ID med ID från förra steget
curl -X POST 'http://localhost:54321/rest/v1/restaurants' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "id": "USER_ID",
    "name": "Test Restaurant",
    "contact_email": "restaurant@test.se"
  }'
```

**Spara för senare:** `RESTAURANT_ID=USER_ID`

---

### STEG 2: Skapa Supplier + Katalog

**2.1 Skapa Supplier A (French Wine Importer)**

```bash
curl -X POST 'http://localhost:3000/api/suppliers/onboard' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "supplier-a@test.se",
    "password": "SupplierA123!",
    "supplierName": "French Wine Importer",
    "contactEmail": "contact@frenchimporter.se",
    "normalDeliveryDays": 7
  }'
```

**Output:**
```json
{
  "supplier": {
    "id": "abc-123-def",
    "namn": "French Wine Importer"
  },
  "user": {
    "id": "user-abc-123",
    "email": "supplier-a@test.se"
  },
  "message": "Supplier onboarded successfully"
}
```

**Spara:** `SUPPLIER_A_ID=abc-123-def`

---

**2.2 Importera Katalog för Supplier A**

```bash
# Ersätt SUPPLIER_A_ID med ID från förra steget
curl -X POST 'http://localhost:3000/api/suppliers/SUPPLIER_A_ID/catalog/import' \
  -H 'Content-Type: application/json' \
  -d '{
    "csvData": "name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas\n\"Château Margaux 2015\",\"Château Margaux\",\"France\",\"Bordeaux\",2015,\"Cabernet Sauvignon\",390.00,25.00,50,6,7,\"Stockholm;Göteborg;Malmö\"\n\"Bordeaux Superior 2016\",\"Domaine Testard\",\"France\",\"Bordeaux\",2016,\"Merlot\",290.00,25.00,100,6,5,\"Stockholm;Göteborg\"",
    "replaceExisting": false
  }'
```

**Output:**
```json
{
  "imported": 2,
  "updated": 0,
  "failed": 0,
  "errors": [],
  "wines": [
    {
      "id": "wine-1",
      "name": "Château Margaux 2015",
      "price_ex_vat_sek": 39000
    },
    {
      "id": "wine-2",
      "name": "Bordeaux Superior 2016",
      "price_ex_vat_sek": 29000
    }
  ]
}
```

**Spara:** `WINE_A_ID=wine-1`

---

**2.3 Skapa Supplier B (Italian Importer)**

```bash
curl -X POST 'http://localhost:3000/api/suppliers/onboard' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "supplier-b@test.se",
    "password": "SupplierB123!",
    "supplierName": "Italian Wine Importer",
    "contactEmail": "contact@italianwine.se",
    "normalDeliveryDays": 5
  }'
```

**Spara:** `SUPPLIER_B_ID=xyz-456-abc`

---

**2.4 Importera Katalog för Supplier B**

```bash
# Ersätt SUPPLIER_B_ID
curl -X POST 'http://localhost:3000/api/suppliers/SUPPLIER_B_ID/catalog/import' \
  -H 'Content-Type: application/json' \
  -d '{
    "csvData": "name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas\n\"Château Margaux 2015\",\"Château Margaux\",\"France\",\"Bordeaux\",2015,\"Cabernet Sauvignon\",420.00,25.00,30,12,5,\"Stockholm\"\n\"Chianti Classico 2017\",\"Antinori\",\"Italy\",\"Tuscany\",2017,\"Sangiovese\",250.00,25.00,60,6,5,\"Stockholm;Göteborg\"",
    "replaceExisting": false
  }'
```

**Spara:** `WINE_B_ID=wine-3`

---

### STEG 3: Skapa Quote Request (Restaurant)

**3.1 Via API (enklast för test)**

```bash
# Ersätt RESTAURANT_ID
curl -X POST 'http://localhost:54321/rest/v1/requests' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Prefer: return=representation' \
  -d '{
    "restaurant_id": "RESTAURANT_ID",
    "fritext": "Söker Château Margaux 2015, cirka 12 flaskor, budget 450 SEK/flaska. Leverans senast om 2 veckor.",
    "budget_per_flaska": 450,
    "antal_flaskor": 12,
    "leverans_senast": "2026-02-14"
  }'
```

**Output:**
```json
{
  "id": "quote-request-123",
  "restaurant_id": "RESTAURANT_ID",
  "fritext": "Söker Château Margaux 2015...",
  "budget_per_flaska": 450,
  "antal_flaskor": 12,
  "created_at": "2026-01-14T12:00:00Z"
}
```

**Spara:** `QUOTE_REQUEST_ID=quote-request-123`

---

**3.2 Alternativ: Via UI**

1. Navigera till `http://localhost:3000/dashboard/new-request`
2. Fyll i formuläret:
   - Fritext: "Söker Château Margaux 2015, 12 flaskor"
   - Budget: 450 SEK
   - Antal: 12
   - Leverans: 2026-02-14
3. Klicka "Skicka förfrågan"
4. Kopiera request ID från URL eller response

---

### STEG 4: Dispatch Quote Request (Routing)

**4.1 Dispatcha till Suppliers**

```bash
# Ersätt QUOTE_REQUEST_ID
curl -X POST 'http://localhost:3000/api/quote-requests/QUOTE_REQUEST_ID/dispatch' \
  -H 'Content-Type: application/json' \
  -d '{
    "maxMatches": 10,
    "minScore": 20,
    "expiresInHours": 48
  }'
```

**Output:**
```json
{
  "assignmentsCreated": 2,
  "matches": [
    {
      "supplierId": "SUPPLIER_A_ID",
      "matchScore": 85.5,
      "matchReasons": [
        "wine_exact_match:30pts",
        "region_match:25pts",
        "budget_match:22pts",
        "lead_time_match:8.5pts"
      ],
      "assignment": {
        "id": "assignment-1",
        "status": "SENT",
        "expiresAt": "2026-01-16T12:00:00Z"
      }
    },
    {
      "supplierId": "SUPPLIER_B_ID",
      "matchScore": 78.2,
      "matchReasons": [
        "wine_exact_match:30pts",
        "region_match:25pts",
        "budget_lower:15pts",
        "lead_time_match:8.2pts"
      ],
      "assignment": {
        "id": "assignment-2",
        "status": "SENT",
        "expiresAt": "2026-01-16T12:00:00Z"
      }
    }
  ],
  "message": "Quote request dispatched to 2 suppliers"
}
```

**Vad hände:**
- System matchade quote request mot båda suppliers
- Skapade assignments (SENT status)
- Beräknade match scores (85.5% och 78.2%)
- Satte expiry (48 timmar)

---

### STEG 5: Suppliers Skapar Offers

**5.1 Supplier A Ser Quote Request**

```bash
# Ersätt SUPPLIER_A_ID
curl 'http://localhost:3000/api/suppliers/SUPPLIER_A_ID/quote-requests'
```

**Output:**
```json
{
  "requests": [
    {
      "id": "QUOTE_REQUEST_ID",
      "fritext": "Söker Château Margaux 2015...",
      "budget_per_flaska": 450,
      "antal_flaskor": 12,
      "leverans_senast": "2026-02-14",
      "assignment": {
        "status": "VIEWED",  // ← Auto-updated från SENT
        "matchScore": 85.5,
        "matchReasons": ["wine_exact_match:30pts", ...],
        "expiresAt": "2026-01-16T12:00:00Z"
      }
    }
  ]
}
```

**Notera:** Status auto-uppdaterades från `SENT` → `VIEWED`

---

**5.2 Supplier A Skapar Offer**

```bash
# Ersätt QUOTE_REQUEST_ID, SUPPLIER_A_ID, WINE_A_ID
curl -X POST 'http://localhost:3000/api/quote-requests/QUOTE_REQUEST_ID/offers' \
  -H 'Content-Type: application/json' \
  -d '{
    "supplierId": "SUPPLIER_A_ID",
    "supplierWineId": "WINE_A_ID",
    "offeredPriceExVatSek": 390.00,
    "quantity": 12,
    "deliveryDate": "2026-02-01",
    "leadTimeDays": 7,
    "notes": "Premium Bordeaux from our French estate. Temperature controlled transport included."
  }'
```

**Output:**
```json
{
  "offer": {
    "id": "offer-1",
    "requestId": "QUOTE_REQUEST_ID",
    "supplierId": "SUPPLIER_A_ID",
    "supplierWineId": "WINE_A_ID",
    "wineName": "Château Margaux 2015",
    "offeredPriceExVatSek": 390.00,
    "vatRate": 25.00,
    "quantity": 12,
    "deliveryDate": "2026-02-01",
    "leadTimeDays": 7,
    "notes": "Premium Bordeaux...",
    "status": "pending",
    "createdAt": "2026-01-14T12:30:00Z"
  },
  "message": "Offer created successfully"
}
```

**Spara:** `OFFER_A_ID=offer-1`

**Notera:** Assignment status auto-uppdaterades från `VIEWED` → `RESPONDED`

---

**5.3 Supplier B Skapar Offer**

```bash
# Ersätt QUOTE_REQUEST_ID, SUPPLIER_B_ID, WINE_B_ID
curl -X POST 'http://localhost:3000/api/quote-requests/QUOTE_REQUEST_ID/offers' \
  -H 'Content-Type: application/json' \
  -d '{
    "supplierId": "SUPPLIER_B_ID",
    "supplierWineId": "WINE_B_ID",
    "offeredPriceExVatSek": 420.00,
    "quantity": 12,
    "deliveryDate": "2026-02-05",
    "leadTimeDays": 5,
    "notes": "Same wine, faster delivery. Free shipping to Stockholm."
  }'
```

**Spara:** `OFFER_B_ID=offer-2`

---

### STEG 6: Restaurant Ser Offers (NY UX!)

**6.1 Lista Offers via API**

```bash
# Ersätt QUOTE_REQUEST_ID
curl 'http://localhost:3000/api/quote-requests/QUOTE_REQUEST_ID/offers'
```

**Output:**
```json
{
  "offers": [
    {
      "id": "offer-1",
      "requestId": "QUOTE_REQUEST_ID",
      "supplierId": "SUPPLIER_A_ID",
      "supplierName": "French Wine Importer",
      "supplierEmail": "contact@frenchimporter.se",
      "wine": {
        "id": "WINE_A_ID",
        "name": "Château Margaux 2015",
        "producer": "Château Margaux",
        "country": "France",
        "region": "Bordeaux",
        "vintage": 2015
      },
      "offeredPriceExVatSek": 390.00,
      "vatRate": 25.00,
      "priceIncVatSek": 487.50,
      "quantity": 12,
      "totalExVatSek": 4680.00,
      "totalIncVatSek": 5850.00,
      "deliveryDate": "2026-02-01",
      "estimatedDeliveryDate": "2026-02-01",
      "leadTimeDays": 7,
      "matchScore": 85.5,
      "matchReasons": [
        "wine_exact_match:30pts",
        "region_match:25pts",
        "budget_match:22pts",
        "lead_time_match:8.5pts"
      ],
      "assignmentStatus": "RESPONDED",
      "isExpired": false,
      "notes": "Premium Bordeaux from our French estate...",
      "status": "pending",
      "expiresAt": "2026-01-16T12:00:00Z",
      "createdAt": "2026-01-14T12:30:00Z"
    },
    {
      "id": "offer-2",
      "requestId": "QUOTE_REQUEST_ID",
      "supplierId": "SUPPLIER_B_ID",
      "supplierName": "Italian Wine Importer",
      "wine": {
        "name": "Château Margaux 2015",
        "producer": "Château Margaux",
        "country": "France",
        "region": "Bordeaux",
        "vintage": 2015
      },
      "offeredPriceExVatSek": 420.00,
      "priceIncVatSek": 525.00,
      "totalIncVatSek": 6300.00,
      "matchScore": 78.2,
      "matchReasons": [
        "wine_exact_match:30pts",
        "region_match:25pts",
        "budget_lower:15pts"
      ],
      "isExpired": false
    }
  ],
  "summary": {
    "total": 2,
    "active": 2,
    "expired": 0
  }
}
```

**Analys:**
- ✅ Offer 1: 390 SEK, match 85.5% (bäst!)
- ✅ Offer 2: 420 SEK, match 78.2%
- ✅ Alla pricing calculations klara (inkl. moms)
- ✅ Match reasons visar varför offers passar
- ✅ Inga utgångna offers

---

**6.2 Via UI (Recommended!)**

**Navigera till:**
```
http://localhost:3000/dashboard/offers/QUOTE_REQUEST_ID
```

**Du ser:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🍷 Winefeed - Mottagna offerter                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 2 offerter                                                   │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ [1] Château Margaux 2015         Matchning: 86% 🟢      ││
│ │ Château Margaux • France • Bordeaux • 2015              ││
│ │                                                          ││
│ │ [wine_exact_match:30pts] [region_match:25pts]           ││
│ │ [budget_match:22pts] [lead_time_match:8.5pts]           ││
│ │                                                          ││
│ │ 💰 Prissättning                                         ││
│ │ Per flaska (exkl. moms): 390 kr                         ││
│ │ Per flaska (inkl. moms): 487.50 kr                      ││
│ │ Antal: 12 flaskor                                        ││
│ │ ─────────────────────────────────────────               ││
│ │ Totalt (exkl. moms): 4,680 kr                           ││
│ │ Moms (25%): 1,170 kr                                     ││
│ │ ─────────────────────────────────────────               ││
│ │ Totalt inkl. moms: 5,850 kr                             ││
│ │ Serviceavgift (PILOT): 0 kr - Gratis under pilotfas ✨ ││
│ │                                                          ││
│ │ 🏢 Leverantör                                           ││
│ │ French Wine Importer                                     ││
│ │ contact@frenchimporter.se                               ││
│ │                                                          ││
│ │ 📦 Leverans                                             ││
│ │ Beräknad leverans: 1 februari 2026                      ││
│ │ Leveranstid: 7 dagar                                     ││
│ │                                                          ││
│ │ 💬 Meddelande från leverantör                           ││
│ │ Premium Bordeaux from our French estate...              ││
│ │                                                          ││
│ │                              [✓ Acceptera offert] ─────►││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ [2] Château Margaux 2015         Matchning: 78% 🟡      ││
│ │ Italian Wine Importer                                    ││
│ │ 420 kr/flaska • Totalt: 6,300 kr                        ││
│ │                              [✓ Acceptera offert]        ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Interaktivt:**
- Scroll för att se båda offerterna
- Jämför pricing, match scores, leveranstid
- Läs leverantörens meddelanden
- Klicka "Acceptera offert" på bästa offert

---

### STEG 7: Acceptera Offer

**7.1 Via UI (Klick på "✓ Acceptera offert")**

**Vad händer:**
1. Button visar "Accepterar..." med spinner
2. API call: `POST /api/offers/OFFER_A_ID/accept`
3. Success modal visas

**Success Modal:**
```
┌─────────────────────────────────────────────────────────────┐
│                          ✓                                   │
│                 Offert accepterad!                           │
│           Din beställning har skapats                        │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Vin                                                      ││
│ │ Château Margaux 2015                                     ││
│ │ Château Margaux                                          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Prissummering                                            ││
│ │ 12 flaskor × 390 kr                      4,680 kr       ││
│ │ Moms (25%)                               1,170 kr       ││
│ │ Serviceavgift (PILOT - gratis)           0 kr           ││
│ │ ───────────────────────────────────────────────         ││
│ │ Totalt att betala                        5,850 kr       ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Beräknad leverans                                        ││
│ │ 1 februari 2026                                          ││
│ │ (7 dagars leveranstid)                                   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Order-ID                                                 ││
│ │ 123e4567-e89b-12d3-a456-426614174000                    ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│                    [Till Dashboard]                          │
│                 [Ny offertförfrågan]                        │
└─────────────────────────────────────────────────────────────┘
```

**Klicka "Till Dashboard"** för att gå tillbaka.

---

**7.2 Via API (för test)**

```bash
# Ersätt OFFER_A_ID
curl -X POST 'http://localhost:3000/api/offers/OFFER_A_ID/accept' \
  -H 'Content-Type: application/json'
```

**Output:**
```json
{
  "commercialIntent": {
    "id": "ci-123-abc",
    "quoteRequestId": "QUOTE_REQUEST_ID",
    "acceptedOfferId": "OFFER_A_ID",
    "status": "pending",
    "acceptedAt": "2026-01-14T13:00:00Z"
  },
  "order": {
    "wine": {
      "name": "Château Margaux 2015",
      "producer": "Château Margaux"
    },
    "supplier": {
      "id": "SUPPLIER_A_ID"
    },
    "pricing": {
      "priceExVatSek": 390.00,
      "quantity": 12,
      "totalGoodsSek": 4680.00,
      "vatRate": 25.00,
      "vatAmountSek": 1170.00,
      "shippingSek": 0,
      "serviceFeeSek": 0,
      "totalPayableSek": 5850.00
    },
    "delivery": {
      "estimatedDate": "2026-02-01",
      "leadTimeDays": 7
    }
  },
  "message": "Offer accepted successfully"
}
```

**Vad skapades:**
- ✅ CommercialIntent (order record)
- ✅ Snapshot av pricing (total: 5,850 kr)
- ✅ Service fee mode: PILOT_FREE (0 kr)
- ✅ Order ID för spårning

---

### STEG 8: Verifiera i Databas

**8.1 Kontrollera CommercialIntent**

```bash
# Via Supabase Studio: http://localhost:54323
# Gå till Table Editor → commercial_intents
# Sök på quote_request_id = QUOTE_REQUEST_ID
```

**Eller via API:**
```bash
curl 'http://localhost:54321/rest/v1/commercial_intents?quote_request_id=eq.QUOTE_REQUEST_ID' \
  -H 'apikey: YOUR_ANON_KEY'
```

**Förväntat resultat:**
```json
{
  "id": "ci-123-abc",
  "quote_request_id": "QUOTE_REQUEST_ID",
  "accepted_offer_id": "OFFER_A_ID",
  "restaurant_id": "RESTAURANT_ID",
  "supplier_id": "SUPPLIER_A_ID",
  "total_goods_amount_ore": 468000,
  "vat_amount_ore": 117000,
  "service_fee_amount_ore": 0,
  "service_fee_mode": "PILOT_FREE",
  "total_payable_estimate_ore": 585000,
  "wine_name": "Château Margaux 2015",
  "quantity": 12,
  "status": "pending",
  "accepted_at": "2026-01-14T13:00:00Z"
}
```

**Verifiera:**
- ✅ `total_goods_amount_ore` = 468,000 (4,680 kr)
- ✅ `vat_amount_ore` = 117,000 (1,170 kr)
- ✅ `service_fee_amount_ore` = 0 (PILOT)
- ✅ `service_fee_mode` = 'PILOT_FREE'
- ✅ `total_payable_estimate_ore` = 585,000 (5,850 kr)

---

### STEG 9: Testa Error Cases

**9.1 Försök Acceptera Igen (ALREADY_ACCEPTED)**

```bash
# Samma offer-ID som redan accepterats
curl -X POST 'http://localhost:3000/api/offers/OFFER_A_ID/accept' \
  -H 'Content-Type: application/json'
```

**Output:**
```json
{
  "errorCode": "ALREADY_ACCEPTED",
  "error": "Quote request already accepted",
  "details": "Another offer has already been accepted for this quote request."
}
```

**HTTP Status:** 409 Conflict

**I UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Offert redan accepterad                                  │
│                                                              │
│ En annan offert har redan accepterats för denna             │
│ offertförfrågan.                                            │
│                                                        [✕]   │
└─────────────────────────────────────────────────────────────┘
```

---

**9.2 Försök Acceptera Andra Offert (Samma Error)**

```bash
# Offer B (inte accepterad än, men quote request redan har intent)
curl -X POST 'http://localhost:3000/api/offers/OFFER_B_ID/accept' \
  -H 'Content-Type: application/json'
```

**Output:** Samma error (ALREADY_ACCEPTED)

**Varför:** Unique constraint på `commercial_intents.quote_request_id`

---

**9.3 Testa Utgången Offer**

**Setup: Skapa offer med utgången assignment**

(Detta kräver att manuellt sätta `expires_at` i database till förfluten tid)

```sql
-- Via Supabase Studio SQL Editor
UPDATE quote_request_assignments
SET expires_at = NOW() - INTERVAL '1 day',
    status = 'EXPIRED'
WHERE id = 'assignment-3';
```

**Försök acceptera:**
```bash
curl -X POST 'http://localhost:3000/api/offers/EXPIRED_OFFER_ID/accept'
```

**Output:**
```json
{
  "errorCode": "OFFER_EXPIRED",
  "error": "Assignment has expired",
  "expiresAt": "2026-01-13T12:00:00Z",
  "details": "The deadline to accept this offer has passed."
}
```

**HTTP Status:** 403 Forbidden

**I UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Offert har gått ut                                       │
│                                                              │
│ Tidsgränsen för att acceptera denna offert har passerat.    │
│ Utgick: 13 januari 2026, 12:00                             │
│                                                        [✕]   │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Test Checklist

Kör igenom dessa steg för att verifiera att allt fungerar:

### Setup (Engångs)
- [ ] Server körs på `http://localhost:3000`
- [ ] Databas är igång och migrerad
- [ ] Har Supabase credentials (anon key, service key)

### Flow Test
- [ ] **Steg 1:** Skapat restaurant
- [ ] **Steg 2:** Skapat 2 suppliers med kataloger
- [ ] **Steg 3:** Skapat quote request
- [ ] **Steg 4:** Dispatchat till suppliers (2 assignments skapade)
- [ ] **Steg 5:** Suppliers skapade offers (2 offers)
- [ ] **Steg 6:** Listat offers via API och UI
  - [ ] Pricing calculations korrekt
  - [ ] Match scores visas
  - [ ] Match reasons visas
  - [ ] Service fee = 0 kr (PILOT)
- [ ] **Steg 7:** Accepterat offer via UI
  - [ ] Success modal visas
  - [ ] Order-ID visas
  - [ ] Pricing summary korrekt
- [ ] **Steg 8:** Verifierat CommercialIntent i databas
  - [ ] `service_fee_mode` = 'PILOT_FREE'
  - [ ] `service_fee_amount_ore` = 0
  - [ ] Alla amounts korrekt

### Error Testing
- [ ] **Steg 9.1:** Försökt acceptera samma offer igen
  - [ ] Får error: ALREADY_ACCEPTED (409)
  - [ ] Error banner visas i UI
- [ ] **Steg 9.2:** Försökt acceptera andra offer
  - [ ] Får error: ALREADY_ACCEPTED (409)
- [ ] **Steg 9.3:** Försökt acceptera utgången offer
  - [ ] Får error: OFFER_EXPIRED (403)
  - [ ] Expired badge visas i UI

---

## 🎬 Quick Test Script

**För snabbare testning, använd detta bash script:**

```bash
#!/bin/bash

# Save as: test-offer-flow.sh
# Run: chmod +x test-offer-flow.sh && ./test-offer-flow.sh

echo "🍷 Starting Winefeed Offer Flow Test..."

# 1. Onboard Supplier A
echo "📦 Creating Supplier A..."
SUPPLIER_A=$(curl -s -X POST 'http://localhost:3000/api/suppliers/onboard' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "supplier-test-a@test.se",
    "password": "Test123!",
    "supplierName": "Test Supplier A",
    "contactEmail": "a@test.se"
  }' | jq -r '.supplier.id')

echo "✓ Supplier A ID: $SUPPLIER_A"

# 2. Import Catalog A
echo "📚 Importing catalog..."
curl -s -X POST "http://localhost:3000/api/suppliers/$SUPPLIER_A/catalog/import" \
  -H 'Content-Type: application/json' \
  -d '{
    "csvData": "name,producer,country,region,vintage,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays\n\"Test Wine\",\"Test Producer\",\"France\",\"Bordeaux\",2015,390,25,50,6,7"
  }' > /dev/null

echo "✓ Catalog imported"

# 3. Create Quote Request (requires manual restaurant setup)
echo "📝 Create quote request manually in Supabase"
echo "   Then run dispatch and offers steps..."

echo "✅ Test preparation complete!"
```

---

## 🐛 Troubleshooting

### Problem: "Cannot connect to API"
**Lösning:**
```bash
# Kontrollera att servern körs
curl http://localhost:3000/api/suppliers/onboard

# Om fel: Starta om server
npm run dev
```

### Problem: "Supplier not found"
**Lösning:**
```bash
# Verifiera supplier finns i databas
curl 'http://localhost:54321/rest/v1/suppliers' \
  -H 'apikey: YOUR_ANON_KEY'
```

### Problem: "No assignments created"
**Lösning:**
- Kontrollera att suppliers har wines i katalog
- Kontrollera att wines matchar quote request (region, budget)
- Sänk `minScore` till 0 i dispatch call

### Problem: "Cannot accept offer"
**Lösning:**
- Kontrollera att assignment inte är expired
- Kontrollera att ingen annan offer redan accepterats
- Kolla console för detaljerade felmeddelanden

---

## 📊 Expected Results

**Efter fullständigt test ska du ha:**

✅ **2 suppliers** i databasen
✅ **4 wines** totalt (2 per supplier)
✅ **1 quote request**
✅ **2 assignments** (RESPONDED status)
✅ **2 offers** (1 accepterad, 1 rejected)
✅ **1 commercial_intent** (pending status)
✅ **0 kr service fee** (PILOT_FREE mode)

---

## 🎯 Success Criteria

**UI:**
- Offers visas med match scores ✓
- Pricing breakdown korrekt (exkl/inkl moms) ✓
- Service fee visar "0 kr - PILOT" ✓
- Accept knapp funkar ✓
- Success modal visas ✓
- Error messages tydliga ✓

**Backend:**
- CommercialIntent skapad ✓
- service_fee_mode = 'PILOT_FREE' ✓
- Unique constraint enforced ✓
- Error codes korrekt ✓

---

**Test Duration:** ~15 minuter (första gången), ~5 minuter (upprepade tester)
**Status:** ✅ Ready for Testing
**Last Updated:** 2026-01-14
