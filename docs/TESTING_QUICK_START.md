# Winefeed Offer Flow - Quick Start Testing

**Snabbast väg att testa nya offer-UX:en** ⚡

---

## 🚀 Metod 1: Automatiskt Script (Rekommenderas)

### Steg 1: Starta server
```bash
npm run dev
```

### Steg 2: Kör test script
```bash
./scripts/test-offer-flow.sh
```

**Vad scriptet gör:**
- ✅ Skapar 2 suppliers med wine-kataloger
- ✅ Hjälper dig skapa restaurant (manual)
- ✅ Skapar quote request
- ✅ Dispatchar till suppliers
- ✅ Suppliers skapar 2 offers
- ✅ Ger dig URL till UI för att testa acceptans

**Output:**
```
🍷 Winefeed Offer Flow Test
════════════════════════════════════════════════

✓ Server is running
✓ Supplier A created: abc-123-def
✓ Imported 2 wines
✓ Supplier B created: xyz-456-abc
✓ Imported 2 wines
✓ Quote Request created: quote-request-123
✓ Dispatched to 2 suppliers
✓ Offer A created: offer-1 (390 SEK/bottle)
✓ Offer B created: offer-2 (420 SEK/bottle)

Now test the UI:
  http://localhost:3000/dashboard/offers/quote-request-123

✅ Test script complete!
```

### Steg 3: Öppna browser
```
http://localhost:3000/dashboard/offers/[QUOTE_REQUEST_ID]
```

### Steg 4: Testa UX
- Se 2 offers med match scores
- Jämför pricing (exkl/inkl moms)
- Se "0 kr - PILOT" serviceavgift
- Klicka "✓ Acceptera offert"
- Se success modal

---

## 📚 Metod 2: Manuel Step-by-Step

Se detaljerad guide: **`TEST_OFFER_FLOW_GUIDE.md`**

Den innehåller:
- Alla API calls (curl commands)
- Databas-queries
- UI screenshots
- Error testing
- Troubleshooting

---

## 🎯 Vad Du Testar

### UX Features
✅ **Match Score Visualization**
- Färgkodad 0-100% (grön/gul/orange)
- Match reasons visas (t.ex. "Region Match (25pts)")

✅ **Pricing Breakdown**
```
Per flaska (exkl. moms):    390 kr
Per flaska (inkl. moms):    487.50 kr
Antal:                      12 flaskor
────────────────────────────────────
Totalt (exkl. moms):        4,680 kr
Moms (25%):                 1,170 kr
────────────────────────────────────
Totalt inkl. moms:          5,850 kr

Serviceavgift (PILOT):      0 kr - Gratis under pilotfas
```

✅ **Accept Flow**
- Klick på "Acceptera offert"
- Success modal med order-ID
- Pricing summary
- Navigation till dashboard

✅ **Error Handling**
- `ALREADY_ACCEPTED` (409) - "Offert redan accepterad"
- `OFFER_EXPIRED` (403) - "Offert har gått ut"

---

## 🐛 Troubleshooting

### "Script fails at restaurant creation"
**Problem:** Måste skapa restaurant manuellt

**Lösning:**
1. Öppna Supabase Studio: `http://localhost:54323`
2. Gå till Authentication → Users → Add User
3. Email: `restaurant-test@test.se`, Password: `Test123!`
4. Kopiera User ID
5. Gå till Table Editor → restaurants → Insert
6. Fyll i: `id` (user ID), `name`, `contact_email`
7. Kör scriptet igen med Restaurant ID

### "API returns 404"
**Lösning:**
```bash
# Kontrollera att server körs
curl http://localhost:3000/api/suppliers/onboard

# Om fel, starta om:
npm run dev
```

### "No offers created"
**Lösning:**
- Kontrollera att suppliers har wines i katalog
- Kontrollera att dispatch lyckades (se output)
- Sänk `minScore` till 0 i dispatch

---

## ✅ Success Checklist

Efter test ska du ha sett:

### I Terminal
- [x] 2 suppliers skapade
- [x] 4 wines importerade
- [x] 1 quote request skapad
- [x] 2 assignments skapade
- [x] 2 offers skapade

### I Browser
- [x] Offers page visas korrekt
- [x] Match scores 0-100%
- [x] Pricing breakdown (exkl/inkl moms)
- [x] Service fee: "0 kr - PILOT"
- [x] Accept button fungerar
- [x] Success modal visas
- [x] Order-ID visas

### Error Testing
- [x] Kan inte acceptera samma offer två gånger (409)
- [x] Kan inte acceptera andra offer efter första (409)
- [x] Error messages tydliga

---

## 📊 Expected Results

**Backend (Database):**
```sql
-- commercial_intents table:
quote_request_id:              QUOTE_REQUEST_ID
accepted_offer_id:             OFFER_A_ID
total_goods_amount_ore:        468000  (4,680 kr)
vat_amount_ore:                117000  (1,170 kr)
service_fee_amount_ore:        0       (PILOT)
service_fee_mode:              'PILOT_FREE'
total_payable_estimate_ore:    585000  (5,850 kr)
status:                        'pending'
```

**Frontend (UI):**
- Offers sorted by match score (best first)
- Pricing transparent (no hidden costs)
- Service fee clearly marked as free (PILOT)
- One-click accept with instant feedback
- Success modal with order details

---

## 🎬 Video Walkthrough (Conceptual)

```
0:00 - Run ./scripts/test-offer-flow.sh
0:30 - Create restaurant (manual step)
1:00 - Script completes, shows URL
1:30 - Open browser, see offers page
2:00 - Compare 2 offers (match scores, pricing)
2:30 - Click "Acceptera offert" on best offer
3:00 - Success modal appears
3:30 - Verify order-ID and pricing
4:00 - Click "Till Dashboard"
4:30 - Test complete! ✅
```

**Total time:** ~5 minutes

---

## 📞 Help & Support

**Documentation:**
- Detailed guide: `TEST_OFFER_FLOW_GUIDE.md` (40+ pages)
- UX documentation: `OFFER_UX_GUIDE.md` (40+ pages)
- API patches: `OFFER_ACCEPT_PATCH.md`

**Logs:**
```bash
# Server logs
tail -f .next/trace

# Check Supabase
open http://localhost:54323
```

**Database inspection:**
```sql
-- Via Supabase Studio SQL Editor

-- Check commercial_intents
SELECT * FROM commercial_intents
WHERE quote_request_id = 'QUOTE_REQUEST_ID';

-- Check offers
SELECT * FROM offers
WHERE request_id = 'QUOTE_REQUEST_ID';

-- Check assignments
SELECT * FROM quote_request_assignments
WHERE quote_request_id = 'QUOTE_REQUEST_ID';
```

---

## 🚀 Next Steps

After successful testing:

1. **Review code:**
   - `app/dashboard/offers/[requestId]/page.tsx` (UX component)
   - `app/api/offers/[id]/accept/route.ts` (Accept endpoint)
   - `app/api/quote-requests/[id]/offers/route.ts` (List endpoint)

2. **Customize:**
   - Update colors/styling
   - Add additional features
   - Integrate with your auth system

3. **Deploy:**
   - Apply database migrations to production
   - Test with real suppliers
   - Monitor error rates

---

**Status:** ✅ Ready for Testing
**Time Required:** 5-15 minutes
**Difficulty:** Easy (automated script) | Medium (manual)
