# Winefeed TODO

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
