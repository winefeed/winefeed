# Winefeed TODO

## BUGGAR (fixa imorgon!)

### ~~IOR-behörighet saknas på /ior/orders/[id]~~ ✅ FIXAT
**Problem:** Sidorna använde hårdkodad `USER_ID` istället för riktig session.
**Lösning:** Tog bort hårdkodade headers, låter middleware sätta `x-user-id` från Supabase auth.

**Filer ändrade:**
- `app/ior/orders/page.tsx`
- `app/ior/orders/[id]/page.tsx`

**OBS:** Om användaren fortfarande får "Du saknar IOR-behörighet" så har de inte IOR-roll i databasen:
1. Användaren måste vara SELLER (finnas i `supplier_users`)
2. Leverantören måste ha `org_number`
3. Det måste finnas en `importer` med samma `org_number`

---

## UX-förbättringar

### Bekräftelse-steg innan förfrågan skickas
- [ ] Visa sammanställning av valda viner (namn, pris, leverantör)
- [ ] Visa och bekräfta kontaktuppgifter (e-post, telefon)
- [ ] Fritextfält för meddelande till leverantörer
- [ ] Visa leveransort
- [ ] "Bekräfta och skicka"-knapp
- [ ] Möjlighet att gå tillbaka och ändra

### Klickbara vinkort i leverantörens dashboard
- [ ] Gör vinkorten i "Senast tillagda viner" klickbara
- [ ] Visa all vininfo i modal/detaljvy (druva, region, årgång, lager, etc.)
- [ ] Möjlighet att redigera vininfo direkt

### Förifylla leveransort från restaurangprofil
- [ ] Hämta restaurangens adress/stad från `restaurants`-tabellen vid registrering
- [ ] Förifylla "Leveransort" i förfrågningsformuläret
- [ ] Låt användaren ändra om leverans ska till annan plats
- [ ] Spara ev. alternativa leveransadresser på restaurangen

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

**Relaterade tabeller:** `orders`, `order_lines`, `order_events` (har nu ordervärde-fält från migration 20260124)

---

## SÄKERHET (från audit 2026-01-24)

Se fullständig rapport: `SECURITY_AUDIT.md`

### Kritiska problem (fixa innan produktion)
- [ ] `/api/admin/review-queue` - Saknar auth-kontroll helt
- [ ] `/api/quote-requests/[id]/offers` GET - Access control kommenterad bort
- [ ] Ta bort `/admin`, `/dashboard`, `/orders` från middleware publicPaths

### Höga prioritet
- [ ] Ta bort eller skydda `/api/debug/env`
- [ ] Verifiera supplier_id mot session vid offer-skapande

### Medelprioritet
- [ ] Dokumentera tenant-isolation strategi
- [ ] Förbered för multi-tenant (hårdkodad tenant_id i middleware)

---

*Skapad: 2026-01-24*
*Uppdaterad: 2026-01-24 (säkerhetsaudit)*
