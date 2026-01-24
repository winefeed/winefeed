# Winefeed TODO

## BUGGAR (fixa imorgon!)

### IOR-behörighet saknas på /ior/orders/[id]
- [ ] Felsök varför "Du saknar IOR-behörighet" visas
- [ ] Kontrollera actor-service och rollhantering
- [ ] Verifiera att användaren har rätt IOR-roll i databasen
- [ ] Kolla om det är JWT/session-problem

**URL:** `winefeed.se/ior/orders/68406ec1-4972-4b77-8335-06b21f31f757`

---

## UX-förbättringar

### Bekräftelse-steg innan förfrågan skickas
- [ ] Visa sammanställning av valda viner (namn, pris, leverantör)
- [ ] Visa och bekräfta kontaktuppgifter (e-post, telefon)
- [ ] Fritextfält för meddelande till leverantörer
- [ ] Visa leveransort
- [ ] "Bekräfta och skicka"-knapp
- [ ] Möjlighet att gå tillbaka och ändra

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

*Skapad: 2026-01-24*
