# Design Quick Actions - Start Här! 🎨

**Snabbreferens för design-förbättringar i Winefeed**

---

## TL;DR - Top 3 Problem

1. **Status-färger är inkonsistenta** → Samma status = olika färger på olika sidor
2. **Buttons är blandade** → Vissa sidor använder Button-komponenten, andra inte
3. **Typography saknar hierarki** → Heading-storlekar används inkonsekvent

---

## Quick Wins (Gör idag! 🚀)

### 1. Fixa Button Padding (30 min)
**Problem:** Inline buttons använder olika padding-värden

**Lösning:**
```bash
# Hitta alla inline buttons
grep -r "className=\".*px-.*py-.*button" app/

# Ersätt med Button-komponenten
```

**Filer att fixa:**
- `app/dashboard/requests/[id]/page.tsx:109` - Back button
- `app/orders/page.tsx:245` - Filter button

---

### 2. Standardisera Card Padding (1 timme)
**Problem:** Cards använder p-4, p-6, p-8 slumpmässigt

**Lösning:** Ändra alla till `p-6` (standard)

**Exceptions:**
- Små list-items → `p-4`
- Hero-sections → `p-8`

---

### 3. Error Message Styling (30 min)
**Problem:** Olika error-styles

**Standard template:**
```tsx
<div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-sm text-destructive">
  <p className="font-medium">Fel:</p>
  <p>{error}</p>
</div>
```

---

### 4. Loading States (1 timme)
**Problem:** Inte alla formulär har loading-states

**Check:**
- [ ] `offers/new/page.tsx` - Submit button
- [ ] `imports/new/page.tsx` - Submit button
- [ ] `dashboard/new-request/page.tsx` - Submit button

**Pattern:**
```tsx
<Button disabled={loading}>
  {loading ? "Sparar..." : "Spara"}
</Button>
```

---

## Implementationsplan (4 veckor)

### Vecka 1: Foundation 🏗️
**Mål:** Skapa designsystem-grund

**TODO:**
```bash
mkdir -p lib/design-system
touch lib/design-system/status-colors.ts
touch lib/design-system/brand-colors.ts
touch lib/design-system/typography.ts
touch lib/design-system/spacing.ts
```

**Innehåll:** Se DESIGN-AUDIT.md sektion 1-2

**Output:** Design tokens klara (ingen visuell ändring än)

---

### Vecka 2: Components 🧩
**Mål:** Standardisera buttons och cards

**TODO:**
1. Konvertera alla `<button>` till `<Button>` (~15 filer)
2. Skapa `components/ui/card.tsx`
3. Skapa `components/ui/message.tsx`
4. Lägg till ESLint rule mot inline buttons

**Output:** Konsistenta buttons och cards överallt

---

### Vecka 3: Status Colors 🎨
**Mål:** Unifierad färgkodning

**TODO:**
1. Uppdatera `StatusBadge` med unified colors
2. Fixa offer status colors (offers/[id]/page.tsx:370)
3. Fixa order status colors (orders/page.tsx:156)
4. Testa färgblindhet med Stark plugin

**Output:** Samma status = samma färg

---

### Vecka 4: Polish ✨
**Mål:** Typography och navigation

**TODO:**
1. Skapa `Heading` component med h1-h4 levels
2. Lägg till Breadcrumbs på key pages
3. Accessibility audit (fokus-states)
4. User testing

**Output:** Polerad, professionell look

---

## Färg-kodning (Förslag)

### Status-färger (Unified)
```typescript
// lib/design-system/status-colors.ts
export const status = {
  draft:      'bg-gray-100 text-gray-800',      // Utkast, initial
  pending:    'bg-blue-100 text-blue-800',      // Inskickad, väntar
  progress:   'bg-yellow-100 text-yellow-800',  // Pågående, under behandling
  completed:  'bg-green-100 text-green-800',    // Klar, godkänd, levererad
  rejected:   'bg-red-100 text-red-800',        // Avvisad, nekad
  cancelled:  'bg-orange-100 text-orange-800',  // Avbruten, utgången
  locked:     'bg-purple-100 text-purple-800'   // Låst, skickad (specialfall)
}
```

### Brand-färger (Förslag)
```typescript
// lib/design-system/brand-colors.ts
export const brand = {
  primary: '#0284c7',    // Sky blue - professionell, pålitlig
  wine: '#722f37',       // Wine red - bransch-koppling
  gold: '#d4af37',       // Gold - premium-känsla
  accent: '#8b5cf6'      // Violet - accent för highlights
}
```

---

## Komponenter att skapa

### Prioritet 1 (Vecka 2)
```
components/ui/card.tsx          - Standardiserad card
components/ui/message.tsx       - Error/success/info/warning boxes
```

### Prioritet 2 (Vecka 3)
```
components/ui/badge.tsx         - Generic badge (extends StatusBadge)
components/ui/select.tsx        - Dropdown select
```

### Prioritet 3 (Vecka 4)
```
components/ui/heading.tsx       - Typography component
components/ui/breadcrumbs.tsx   - Navigation helper
components/ui/dialog.tsx        - Modal dialogs
```

---

## ESLint Rules (Lägg till)

```json
// .eslintrc.json
{
  "rules": {
    // Prevent inline button styling
    "react/forbid-elements": [
      "error",
      {
        "forbid": [
          {
            "element": "button",
            "message": "Use <Button> component from @/components/ui/button instead"
          }
        ]
      }
    ],

    // Enforce className ordering (with prettier-plugin-tailwindcss)
    "tailwindcss/classnames-order": "warn"
  }
}
```

---

## Testing Checklist

### Visual Regression
- [ ] Screenshot alla pages (before/after)
- [ ] Jämför i Percy eller Chromatic
- [ ] User testing med 3+ testpersoner

### Accessibility
- [ ] Keyboard navigation (Tab genom alla sidor)
- [ ] Screen reader test (VoiceOver/NVDA)
- [ ] Color contrast checker (WCAG AA minimum)
- [ ] Focus states synliga

### Cross-browser
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari
- [ ] Mobile Chrome

---

## Filer att läsa

### Design System
- `DESIGN-AUDIT.md` - Komplett audit (detta dokument)
- `DESIGN-SYSTEM.md` - Design tokens och guidelines (skapa vecka 1)

### Key Component Files
- `components/ui/button.tsx` - Button component (redan finns)
- `app/imports/components/StatusBadge.tsx` - Status badge (uppdatera vecka 3)
- `app/offers/components/OfferLineItemRow.tsx` - Complex form example

### Key Page Files
- `app/offers/[id]/page.tsx` - Offer editor (många UI patterns)
- `app/imports/[id]/page.tsx` - Import case (status flow example)
- `app/orders/[id]/page.tsx` - Order details (card layout example)

---

## Terminal Commands

### Setup
```bash
# Skapa design system struktur
mkdir -p lib/design-system components/ui

# Skapa token files
touch lib/design-system/{status-colors,brand-colors,typography,spacing}.ts

# Skapa component files
touch components/ui/{card,message,badge,select,heading,breadcrumbs}.tsx
```

### Find Inconsistencies
```bash
# Hitta alla inline buttons
grep -r "className=\".*button" app/ | grep -v "components/ui/button"

# Hitta alla status colors
grep -r "bg-.*-100.*text-.*-800" app/

# Hitta alla card paddings
grep -r "className=\".*p-[0-9]" app/ | grep "card\|border"
```

### Testing
```bash
# Run build (check for errors)
npm run build

# Run lint
npm run lint

# Type check
npx tsc --noEmit

# Check bundle size
npm run build && npx next-bundle-analyzer
```

---

## Stakeholder Questions

Before starting, ask:

1. **Färger:** Finns det existerande brand guidelines? Logo-färger?
2. **Prioritet:** Vilken sida är viktigast? (fokusera där först)
3. **Timeline:** Hur snabbt behöver vi detta? (påverkar scope)
4. **Users:** Vem är primär målgrupp? (restauranger, leverantörer, admin)
5. **Devices:** Desktop-först eller mobile-först?

---

## Success Metrics

### Code Quality
- [ ] 0 inline `<button className=...>` tags
- [ ] 100% buttons use Button component
- [ ] 100% status badges use unified colors
- [ ] All headings use defined levels (h1-h4)
- [ ] All cards use Card component

### User Experience
- [ ] Users kan identifiera status på färg ensam
- [ ] Navigation känns intuitiv (< 3 klick till mål)
- [ ] Forms har tydliga error states
- [ ] Loading states synliga

### Accessibility
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation fungerar
- [ ] Screen reader compatible
- [ ] Color contrast ≥ 4.5:1

---

## Support

**Frågor?** Se DESIGN-AUDIT.md för detaljer.

**Stuck?** Referera till specifika filpaths i DESIGN-AUDIT.md Appendix A.

**Need help?** Fråga Claude - jag kan:
- Generera design token files
- Skapa component templates
- Refaktorera specifika sidor
- Sätta upp ESLint rules

---

**Last updated:** 2026-01-16
