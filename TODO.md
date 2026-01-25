# Winefeed TODO

## BUGGAR

### ~~IOR-behörighet saknas på /ior/orders/[id]~~ ✅ FIXAT
**Problem:** Sidorna använde hårdkodad `USER_ID` istället för riktig session.
**Lösning:** Tog bort hårdkodade headers, låter middleware sätta `x-user-id` från Supabase auth.

---

## UX-förbättringar

### ~~Bekräftelse-steg innan förfrågan skickas~~ ✅ FIXAT
- [x] Visa sammanställning av valda viner (typ, budget, antal)
- [x] Fritextfält för meddelande till leverantörer
- [x] Visa leveransort
- [x] "Bekräfta och skicka"-knapp
- [x] Möjlighet att gå tillbaka och ändra

### ~~Klickbara vinkort i leverantörens dashboard~~ ✅ FIXAT
- [x] Gör vinkorten i "Senast tillagda viner" klickbara
- [x] Visa all vininfo i modal/detaljvy (druva, region, årgång, lager, etc.)
- [x] Möjlighet att redigera vininfo direkt

### ~~Förifylla leveransort från restaurangprofil~~ ✅ FIXAT
- [x] Publik registrering med orgnummer-lookup (Roaring.io)
- [x] Hämta restaurangens stad från `restaurants`-tabellen
- [x] Förifylla "Leveransort" i förfrågningsformuläret
- [x] Spara alternativa leveransadresser

---

## Admin-funktioner att bygga

### ~~Ordervärde-rapporter (för fakturering)~~ ✅ FIXAT
- [x] Admin-dashboard för att se alla ordervärden
- [x] Filtrera på tidsperiod (månad, kvartal, år)
- [x] Exportera till CSV/Excel
- [x] Visa: total_goods_amount_ore, shipping_cost_ore, total_order_value_ore
- [x] Beräkna Winefeed-avgift (när service_fee_mode ändras från PILOT_FREE)
- [x] Gruppera per restaurang/leverantör

### ~~Compliance & Skatterapportering~~ ✅ FIXAT
- [x] Rapporter för alkoholskatt
- [x] Momsrapportering (25% på vin)
- [x] Spårbarhet för import (EU-leverantörer → svensk IOR)
- [x] Transaktionshistorik per leverantör/restaurang
- [x] Exportera underlag för bokföring/revision

---

## SÄKERHET (från audit 2026-01-24)

Se fullständig rapport: `SECURITY_AUDIT.md`

### ~~Kritiska problem~~ ✅ FIXAT
- [x] `/api/admin/review-queue` - Auth-kontroll tillagd
- [x] `/api/quote-requests/[id]/offers` GET - Access control fixat
- [x] Ta bort `/admin`, `/dashboard`, `/orders` från middleware publicPaths

### ~~Höga prioritet~~ ✅ FIXAT
- [x] Ta bort `/api/debug/env`
- [x] Verifiera supplier_id mot session vid offer-skapande

### Medelprioritet
- [x] Dokumentera tenant-isolation strategi → `docs/TENANT_ISOLATION.md`
- [~] Förbered för multi-tenant → **EJ AKUT** (endast svensk marknad just nu, grunden finns)

---

*Skapad: 2026-01-24*
*Uppdaterad: 2026-01-25*

---

## Changelog

### 2026-01-25: Ordervärde-rapporter
- Nytt API: `GET /api/admin/orders/reports` - Hämta rapport med filtrering och aggregering
- Nytt API: `GET /api/admin/orders/reports/export` - Exportera till CSV
- Ny sida: `/admin/reports` - Admin-dashboard för ordervärden
- Funktioner: Datumfilter, snabbval (denna månad, förra månaden, kvartal, år), gruppering per restaurang/leverantör/månad

### 2026-01-25: Alternativa leveransadresser
- Ny tabell: `restaurant_delivery_addresses` - Sparade leveransadresser per restaurang
- Nytt API: `GET/POST /api/me/addresses` - Lista och skapa adresser
- Nytt API: `GET/PATCH/DELETE /api/me/addresses/[id]` - Hantera specifik adress
- Uppdaterat: `components/request-form.tsx` - Välj från sparade adresser
- Ny sida: `/dashboard/settings` - Hantera leveransadresser
- Funktioner: Standardadress, kontaktperson, leveransinstruktioner

### 2026-01-25: Compliance & Skatterapportering
- Nytt API: `GET /api/admin/compliance` - Compliance-rapporter med olika typer:
  - `summary` - Sammanfattning av skatter och ordrar
  - `alcohol-tax` - Alkoholskatt (beräknad på 56,32 kr/liter ren alkohol)
  - `vat` - Momsrapport (25%)
  - `imports` - Spårbarhet för EU-importer
  - `transactions` - Transaktionshistorik
- Nytt API: `GET /api/admin/compliance/export` - CSV-export för bokföring
- Ny sida: `/admin/compliance` - Compliance-dashboard med flikar
- Funktioner: Alkoholskatt-beräkning, momsunderlag, import-spårbarhet, transaktionsloggar

### 2026-01-25: Säkerhetsfix - Auth-kontroller
Lagt till korrekt auth-kontroll på följande endpoints:

**Admin endpoints (kräver ADMIN-roll):**
- `/api/admin/wines` - GET: Lista alla viner
- `/api/admin/wines/template` - GET: Ladda ner importmall
- `/api/admin/wines/import` - POST: Importera viner
- `/api/admin/stats` - GET: Statistik för admin dashboard

**Supplier endpoints (kräver SELLER-roll + äger leverantören):**
- `/api/suppliers/[id]/wines` - GET/POST: Hantera vinkatalog
- `/api/suppliers/[id]/offers` - GET/POST: Hantera offerter
- `/api/suppliers/[id]/orders` - GET: Lista ordrar
- `/api/suppliers/[id]/quote-requests` - GET: Lista förfrågningar
- `/api/suppliers/[id]/imports` - POST: Importera prislista
- `/api/suppliers/[id]/wines/import` - POST: Importera vinkatalog
- `/api/suppliers/[id]/catalog/import` - POST: Importera katalog

**DDL endpoints (kräver ADMIN eller IOR-roll):**
- `/api/direct-delivery-locations/[id]/approve` - POST: Godkänn DDL
- `/api/direct-delivery-locations/[id]/reject` - POST: Avslå DDL
  - Fixade felaktig kontroll mot `x-user-role` header (kunde spoofas)
  - Nu valideras rollen via `actorService.resolveActor()`

### 2026-01-25: Säkerhetsfix - Ytterligare auth-kontroller (audit #2)
Lagt till korrekt auth-kontroll och ownership-verifiering på:

**Request endpoints (kräver RESTAURANT-roll + ownership):**
- `/api/requests/[id]/adjust-quantity` - PATCH: Justera kvantitet
- `/api/quote-requests/[id]/dispatch` - GET/POST: Dispatcha förfrågan

**Import endpoints (kräver IOR/SELLER/ADMIN-roll):**
- `/api/imports/[id]` - GET: Hämta import case
- `/api/imports/[id]/attach-supplier-import` - POST: Koppla supplier import
- `/api/imports/[id]/documents/[docId]/download` - GET: Ladda ner dokument

**DDL endpoints:**
- `/api/restaurants/[id]/direct-delivery-locations` - POST: Skapa DDL (kräver ownership)
- `/api/direct-delivery-locations/[id]` - GET: Hämta DDL detaljer (kräver ownership)
