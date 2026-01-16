# Winefeed Offer Comparison UX Guide

**Date:** 2026-01-14
**Status:** ✅ Complete
**Location:** `/app/dashboard/offers/[requestId]/page.tsx`

---

## 📋 Overview

Ny UX för restaurangers offer-jämförelse och acceptans med alla senaste funktioner:

- **Pricing breakdown** (exkl/inkl moms, totalsummor)
- **Match scores** (0-100 poäng med visuell färgkodning)
- **Match reasons** (varför varje offert passar)
- **Service fee mode** (PILOT_FREE visas tydligt)
- **Error handling** (OFFER_EXPIRED, ALREADY_ACCEPTED)
- **Real-time status** (assignment status, utgångsdatum)

---

## 🎨 Features

### 1. Offer List View

**URL:** `/dashboard/offers/[requestId]`

**Visar:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🍷 Winefeed - Mottagna offerter                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 2 offerter                                                   │
│ [x] Visa utgångna                                           │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ [1] Château Margaux 2015        Matchning: 90% ⭐       ││
│ │ Château Margaux • France • Bordeaux                     ││
│ │ [region_match:25pts] [budget_match:22pts]               ││
│ │                                                          ││
│ │ 💰 Prissättning              🏢 Leverantör              ││
│ │ Per flaska (exkl): 390 kr    French Wine Importer       ││
│ │ Per flaska (inkl): 487.50 kr                            ││
│ │ Antal: 12 flaskor            📦 Leverans                ││
│ │                              15 februari 2026            ││
│ │ Totalt exkl: 4,680 kr        (7 dagars leveranstid)     ││
│ │ Moms (25%): 1,170 kr                                     ││
│ │ Totalt inkl: 5,850 kr                                    ││
│ │ Service (PILOT): 0 kr - Gratis under pilotfas           ││
│ │                                                          ││
│ │                               [✓ Acceptera offert] ────►││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ [2] Bordeaux 2016              Matchning: 75% 🟡        ││
│ │ ...                                                      ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

### 2. Match Score Visualization

**Färgkodning:**
- **90-100%:** Grön (excellent match)
- **60-89%:** Gul (good match)
- **<60%:** Orange (fair match)

**Match Reasons:**
Visar varför varje offert passar, t.ex.:
- `region_match:25pts` → "Region Match (25pts)"
- `budget_match:22pts` → "Budget Match (22pts)"
- `vintage_exact:10pts` → "Vintage Exact (10pts)"

---

### 3. Pricing Breakdown

**Visar tydligt:**
```
Pris per flaska (exkl. moms)    390 kr
Pris per flaska (inkl. moms)    487.50 kr
Antal                           12 flaskor
────────────────────────────────────────
Totalt (exkl. moms)             4,680 kr
Moms (25%)                      1,170 kr
────────────────────────────────────────
Totalt inkl. moms               5,850 kr

Serviceavgift (PILOT)           0 kr - Gratis under pilotfas
```

**Varför detta är viktigt:**
- Transparent prissättning
- Tydlig moms-uppdelning
- Visar PILOT_FREE mode (gratis serviceavgift)
- Inga dolda kostnader

---

### 4. Success State (Efter Accept)

När offert accepteras visas success-modal:

```
┌─────────────────────────────────────────────────────────────┐
│                        ✓                                     │
│              Offert accepterad!                              │
│         Din beställning har skapats                          │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Vin                                                      ││
│ │ Château Margaux 2015                                     ││
│ │ Château Margaux                                          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Prissummering                                            ││
│ │ 12 flaskor × 390 kr              4,680 kr               ││
│ │ Moms (25%)                       1,170 kr               ││
│ │ Serviceavgift (PILOT - gratis)   0 kr                   ││
│ │ ─────────────────────────────────────────               ││
│ │ Totalt att betala                5,850 kr               ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Beräknad leverans                                        ││
│ │ 15 februari 2026                                         ││
│ │ (7 dagars leveranstid)                                   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Order-ID                                                 ││
│ │ 123e4567-e89b-12d3-a456-426614174000                    ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│               [Till Dashboard]                               │
│            [Ny offertförfrågan]                             │
└─────────────────────────────────────────────────────────────┘
```

**Visar:**
- ✅ Bekräftelsemeddelande
- 📝 Komplett prissummering
- 📅 Leveransdatum
- 🆔 Order-ID för referens
- 🔗 Navigation till dashboard eller ny förfrågan

---

### 5. Error Handling

#### Error: Offer Already Accepted (409)

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Offert redan accepterad                                  │
│                                                              │
│ En annan offert har redan accepterats för denna             │
│ offertförfrågan.                                            │
│                                                        [✕]   │
└─────────────────────────────────────────────────────────────┘
```

**Händer när:**
- Restaurang försöker acceptera andra offert efter första
- API returnerar `errorCode: 'ALREADY_ACCEPTED'`

---

#### Error: Offer Expired (403)

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Offert har gått ut                                       │
│                                                              │
│ Tidsgränsen för att acceptera denna offert har passerat.    │
│ Utgick: 14 januari 2026, 12:00                             │
│                                                        [✕]   │
└─────────────────────────────────────────────────────────────┘
```

**Händer när:**
- Assignment har gått ut (expires_at < now)
- API returnerar `errorCode: 'OFFER_EXPIRED'`

**Visuell indikation:**
- Offert-kortet visas med opacity 60%
- Banner högst upp: "⏱️ Offert utgången"
- Knapp ersatt med "⏱️ Offert utgången" (disabled)

---

### 6. Expired Offers Toggle

**Feature:** Visa/dölj utgångna offerter

```
2 offerter
1 utgången

[x] Visa utgångna  ← Toggle checkbox
```

**Default:** Utgångna offerter är dolda
**Med checkbox:** Alla offerter visas (inklusive utgångna)

**Use case:** Låt restaurang se vad de missade (för framtida referens)

---

## 🎯 User Flows

### Flow 1: Compare and Accept Offer

```
1. Restaurant navigates to /dashboard/offers/[requestId]
   ↓
2. System fetches offers via GET /api/quote-requests/:id/offers
   ↓
3. Restaurant sees:
   - 2 offers sorted by match score (best first)
   - Full pricing breakdown
   - Match reasons
   - Delivery info
   ↓
4. Restaurant clicks "✓ Acceptera offert" on best offer
   ↓
5. System calls POST /api/offers/:id/accept
   ↓
6. Success modal shows:
   - Order confirmation
   - Pricing summary
   - Order ID
   ↓
7. Restaurant clicks "Till Dashboard" or "Ny offertförfrågan"
```

---

### Flow 2: Handle Double Accept (Concurrency)

```
1. Restaurant A opens offers page
2. Restaurant B opens same offers page (same quote request)
   ↓
3. Restaurant A clicks "Accept" on Offer 1
   → Success! CommercialIntent created
   ↓
4. Restaurant B clicks "Accept" on Offer 2
   → Error: 409 ALREADY_ACCEPTED
   → Error banner shows: "Offert redan accepterad"
   ↓
5. Restaurant B refreshes page
   → Sees updated state (no accept buttons)
```

---

### Flow 3: View Expired Offers

```
1. Restaurant navigates to offers page
   ↓
2. Summary shows: "2 offerter, 1 utgången"
   ↓
3. Default: Only 1 active offer visible
   ↓
4. Restaurant checks "Visa utgångna"
   ↓
5. System fetches with ?includeExpired=true
   ↓
6. Both offers visible:
   - Active offer: normal styling, accept button
   - Expired offer: muted styling, "Offert utgången" badge
```

---

## 🎨 Design Tokens

### Colors

**Match Score:**
- Excellent (90-100): `text-green-600`, `bg-green-100`, `border-green-200`
- Good (60-89): `text-yellow-600`, `bg-yellow-100`, `border-yellow-200`
- Fair (<60): `text-orange-600`, `bg-orange-100`, `border-orange-200`

**Status:**
- Success: `text-green-600`, `bg-green-50`
- Error: `text-destructive`, `bg-destructive/10`
- Expired: `text-muted-foreground`, `opacity-60`

**Pricing:**
- Service fee (pilot): `text-green-600` (gratis!)
- Total: `text-primary`, font size `text-xl`

---

### Typography

**Headings:**
- Page title: `text-2xl font-bold`
- Offer title: `text-2xl font-bold`
- Section headings: `font-semibold`

**Body:**
- Regular text: `text-sm`
- Labels: `text-xs text-muted-foreground`
- Totals: `text-base font-bold` or `text-xl font-bold`

---

### Spacing

**Cards:**
- Gap between cards: `space-y-6`
- Card padding: `p-6`
- Section padding: `px-6 py-4`

**Grids:**
- Pricing/Delivery grid: `grid md:grid-cols-2 gap-6`

---

## 📱 Responsive Design

**Desktop (>768px):**
- 2-column layout for pricing/delivery
- Full pricing breakdown visible
- All match reasons visible

**Mobile (<768px):**
- Single column layout
- Stacked pricing/delivery sections
- Scrollable match reasons

**Key breakpoints:**
- `md:grid-cols-2` → 2 columns on desktop
- `md:text-2xl` → Larger text on desktop
- `max-w-7xl mx-auto` → Centered container

---

## 🔧 Technical Implementation

### API Integration

**Fetch Offers:**
```typescript
const fetchOffers = async () => {
  const url = `/api/quote-requests/${requestId}/offers${
    includeExpired ? '?includeExpired=true' : ''
  }`;
  const response = await fetch(url);
  const data: OffersResponse = await response.json();
  setOffers(data.offers);
  setSummary(data.summary);
};
```

**Accept Offer:**
```typescript
const handleAcceptOffer = async (offerId: string) => {
  const response = await fetch(`/api/offers/${offerId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle errors: OFFER_EXPIRED, ALREADY_ACCEPTED
    setAcceptError(data as ErrorResponse);
    return;
  }

  // Success!
  setAcceptedOffer(data as AcceptResponse);
};
```

---

### State Management

**Component State:**
```typescript
const [offers, setOffers] = useState<Offer[]>([]);
const [summary, setSummary] = useState<OfferSummary | null>(null);
const [loading, setLoading] = useState(true);
const [includeExpired, setIncludeExpired] = useState(false);

// Accept state
const [accepting, setAccepting] = useState<string | null>(null);
const [acceptedOffer, setAcceptedOffer] = useState<AcceptResponse | null>(null);
const [acceptError, setAcceptError] = useState<ErrorResponse | null>(null);
```

**Loading States:**
- Initial load: Full screen spinner
- Accepting: Button shows "Accepterar..." with spinner
- Success: Modal overlay
- Error: Banner at top

---

## ✅ Testing Checklist

### Manual Testing

- [ ] Load offers page with active offers
- [ ] Load offers page with expired offers
- [ ] Toggle "Visa utgångna" checkbox
- [ ] Accept offer (success flow)
- [ ] Try to accept second offer (error: ALREADY_ACCEPTED)
- [ ] Try to accept expired offer (error: OFFER_EXPIRED)
- [ ] Verify pricing calculations (exkl/inkl moms)
- [ ] Verify match scores display correctly
- [ ] Verify service fee shows "0 kr - PILOT"
- [ ] Test responsive design (mobile/desktop)

### Automated Testing (Future)

```typescript
describe('Offer Comparison UX', () => {
  it('displays offers sorted by match score', () => {
    // Test sorting
  });

  it('shows pricing breakdown with VAT', () => {
    // Test pricing display
  });

  it('handles offer acceptance', () => {
    // Test accept flow
  });

  it('shows error for already accepted', () => {
    // Test ALREADY_ACCEPTED error
  });

  it('shows error for expired offer', () => {
    // Test OFFER_EXPIRED error
  });
});
```

---

## 🚀 Next Steps

### Enhancements (Future)

1. **Bulk Actions**
   - Select multiple offers
   - Compare side-by-side

2. **Filtering**
   - Filter by price range
   - Filter by match score
   - Filter by delivery date

3. **Notifications**
   - Email when new offers arrive
   - Push notifications

4. **Analytics**
   - Track which offers get accepted
   - A/B test UX changes

5. **Export**
   - Export offers to PDF
   - Export to CSV

---

## 📊 Success Metrics

**UX Goals:**
- ✅ <5 seconds to compare all offers
- ✅ <2 clicks to accept offer
- ✅ 0% confusion about pricing
- ✅ Clear visual feedback on all actions

**Business Goals:**
- 📈 95%+ offer acceptance rate (no errors)
- 📈 <1% double-accept attempts
- 📈 90%+ user satisfaction with pricing transparency

---

**Document Version:** 1.0
**Last Updated:** 2026-01-14
**Status:** ✅ Complete and Ready for Use
