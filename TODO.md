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
- [ ] Spara ev. alternativa leveransadresser (framtida)

---

## Admin-funktioner att bygga

### Ordervärde-rapporter (för fakturering)
- [ ] Admin-dashboard för att se alla ordervärden
- [ ] Filtrera på tidsperiod (månad, kvartal, år)
- [ ] Exportera till CSV/Excel
- [ ] Visa: total_goods_amount_ore, shipping_cost_ore, total_order_value_ore
- [ ] Beräkna Winefeed-avgift (när service_fee_mode ändras från PILOT_FREE)
- [ ] Gruppera per restaurang/leverantör

### Compliance & Skatterapportering
- [ ] Rapporter för alkoholskatt
- [ ] Momsrapportering (25% på vin)
- [ ] Spårbarhet för import (EU-leverantörer → svensk IOR)
- [ ] Transaktionshistorik per leverantör/restaurang
- [ ] Exportera underlag för bokföring/revision

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
