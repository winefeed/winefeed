# Offer Line Items - Wine Check Integration

## Overview

Multi-line-item offer editor with integrated Wine Check verification for each wine row.

**MVP Status:** Client-side storage (localStorage). Backend persistence ready to add.

## Features

✅ **Multi-line offers** - Add/remove unlimited wine rows
✅ **Wine Check per row** - Verify and normalize wine data (controlled mode)
✅ **Match status badges** - Visual indication of verification quality
✅ **Allowlist policy** - NO PRICE DATA from Wine-Searcher
✅ **Auto-save** - Drafts saved automatically to localStorage
✅ **Total calculation** - Automatic price summation

## Quick Start

### Create New Offer

Navigate to: `/offers/new`

This will:
1. Create empty offer draft with 3 blank line items
2. Generate UUID and save to localStorage
3. Redirect to `/offers/[id]` editor

### Edit Offer

URL: `/offers/[id]`

Features:
- Add/remove wine rows
- Click "🔍 Wine Check" on any row to verify wine name
- Wine Check runs in **controlled mode** with callback-only (no autosave)
- Match status and score displayed as badges
- Verified data (canonical name, producer, region) shown below row

## Architecture

### Files

```
app/offers/
├── new/page.tsx                    # Create new offer (redirect to [id])
├── [id]/page.tsx                   # Offer editor
└── components/
    └── OfferLineItemRow.tsx        # Single row with Wine Check

lib/
├── offer-types.ts                  # Types + policy guards
└── offer-storage.ts                # localStorage utils (MVP)
```

### Data Types

```typescript
interface OfferLineItem {
  id: string;
  name: string;              // Raw input
  vintage: number | null;
  quantity: number;
  unit_price: number | null;
  enrichment: WineCheckEnrichment | null; // Allowlist only
  created_at: string;
  updated_at: string;
}

interface WineCheckEnrichment {
  canonical_name: string | null;
  producer: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  ws_id: string | null;
  match_score: number | null;     // 0-100
  match_status: MatchStatus | null;
  checked_at: string;             // ISO timestamp
}

interface OfferDraft {
  id: string;
  title: string;
  description: string | null;
  line_items: OfferLineItem[];
  created_at: string;
  updated_at: string;
}
```

## Wine Check Integration

### How It Works

1. **User fills wine name** in line item
2. **Click "🔍 Wine Check"** to open verification panel
3. **Wine Check Panel** (controlled mode):
   - Pre-filled with line item data
   - Shows candidates from Wine-Searcher
   - User selects correct match
4. **Callback triggers** enrichment update:
   ```typescript
   handleWineCheckSelect = (candidate) => {
     const enrichment = {
       canonical_name: candidate.name,
       producer: candidate.producer,
       region: candidate.region,
       appellation: candidate.appellation,
       match_score: candidate.score,
       match_status: 'EXACT',
       checked_at: new Date().toISOString()
     };

     // SECURITY CHECK
     assertNoForbiddenFieldsInEnrichment(enrichment);

     // Update line item
     onUpdate({ ...lineItem, enrichment });
   }
   ```

### Security Policy

**NO PRICE DATA from Wine-Searcher**

Three layers of protection:

1. **Type system** - `WineCheckEnrichment` only has allowlist fields
2. **Component guard** - `OfferLineItemRow` validates on selection
3. **Storage guard** - `saveOfferDraft()` validates before save

Forbidden pattern: `/price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP/i`

Any violation throws:
```
SECURITY_VIOLATION: Forbidden price data detected in wine enrichment
```

## UI Components

### OfferLineItemRow

**Props:**
- `lineItem: OfferLineItem`
- `onUpdate: (lineItem: OfferLineItem) => void`
- `onRemove: () => void`

**Features:**
- Input fields: name, vintage, quantity, unit_price
- Wine Check toggle button (disabled if name empty)
- Match status badge (when enriched)
- Verified data display (when enriched)
- Remove button

**Wine Check Mode:** `controlled`
- Pre-filled with `initialName` and `initialVintage`
- `onSelectCandidate` callback updates enrichment
- NO `persistSelection` (MVP - no backend yet)

## Storage (MVP)

### localStorage Structure

Key: `winefeed_offer_drafts`

Value: `OfferDraft[]` (JSON array)

### Functions

```typescript
// Get all drafts
const drafts = getAllOfferDrafts();

// Get single draft
const draft = getOfferDraft(id);

// Save draft
saveOfferDraft(draft);

// Delete draft
deleteOfferDraft(id);
```

### Auto-save

Offers are auto-saved 1 second after changes using `useEffect` debounce in `/offers/[id]/page.tsx`:

```typescript
useEffect(() => {
  if (!draft) return;

  const timeoutId = setTimeout(() => {
    saveOfferDraft(draft);
  }, 1000);

  return () => clearTimeout(timeoutId);
}, [draft]);
```

## Backend Migration (TODO)

When `offer_lines` table is ready:

### 1. Create API Routes

```typescript
// POST /api/offers/drafts
export async function POST(req: NextRequest) {
  const draft = await req.json();

  // Save to database
  const { data, error } = await supabase
    .from('offer_drafts')
    .insert(draft)
    .select()
    .single();

  return NextResponse.json(data);
}

// GET /api/offers/drafts/[id]
// PUT /api/offers/drafts/[id]
// DELETE /api/offers/drafts/[id]
```

### 2. Update Storage Utils

Replace `lib/offer-storage.ts` with API calls:

```typescript
export async function saveOfferDraft(draft: OfferDraft): Promise<void> {
  const response = await fetch('/api/offers/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft)
  });

  if (!response.ok) {
    throw new Error('Failed to save offer draft');
  }
}
```

### 3. Add persistSelection Hook

When saving line items to database:

```typescript
<WineCheckPanel
  mode="controlled"
  initialName={lineItem.name}
  initialVintage={lineItem.vintage?.toString()}
  onSelectCandidate={handleWineCheckSelect}
  persistSelection={async (candidate) => {
    // Save enrichment to database
    await fetch(`/api/offers/line-items/${lineItem.id}/enrichment`, {
      method: 'PUT',
      body: JSON.stringify({
        canonical_name: candidate.name,
        producer: candidate.producer,
        region: candidate.region,
        appellation: candidate.appellation,
        match_score: candidate.score,
        checked_at: new Date().toISOString()
      })
    });
  }}
/>
```

## Example Usage

### Creating an Offer

```typescript
// User navigates to /offers/new
// System creates draft:
const draft = {
  id: crypto.randomUUID(),
  title: 'Ny offert',
  description: null,
  line_items: [
    { id: '...', name: '', vintage: null, quantity: 1, unit_price: null, enrichment: null },
    { id: '...', name: '', vintage: null, quantity: 1, unit_price: null, enrichment: null },
    { id: '...', name: '', vintage: null, quantity: 1, unit_price: null, enrichment: null }
  ],
  created_at: '2026-01-16T10:00:00Z',
  updated_at: '2026-01-16T10:00:00Z'
};

// Saved to localStorage
saveOfferDraft(draft);

// Redirect to /offers/[draft.id]
```

### Editing Line Item

```typescript
// User fills in:
lineItem.name = "Château Margaux";
lineItem.vintage = 2015;
lineItem.quantity = 12;
lineItem.unit_price = 450.00;

// User clicks "🔍 Wine Check"
// Wine Check Panel opens (controlled mode)
// User selects candidate: "Château Margaux 2015, Bordeaux"

// Enrichment created:
lineItem.enrichment = {
  canonical_name: "Château Margaux",
  producer: "Château Margaux",
  region: "Bordeaux",
  appellation: "Margaux",
  ws_id: null,
  match_score: 98,
  match_status: "EXACT",
  checked_at: "2026-01-16T10:05:00Z"
};

// Auto-saved to localStorage after 1s
```

### Match Status Badges

```typescript
EXACT      → Green badge:  "Exakt matchning (98%)"
FUZZY      → Yellow badge: "Delvis matchning (85%)"
MULTIPLE   → Yellow badge: "Flera kandidater"
NOT_FOUND  → Red badge:    "Ej hittad"
ERROR      → Red badge:    "Fel"
null       → Gray badge:   "Ej kontrollerad"
```

## Testing

### Manual Test Flow

1. Navigate to `/offers/new`
2. Verify redirect to `/offers/[id]`
3. Fill in first line item:
   - Name: "Château Margaux"
   - Vintage: 2015
   - Quantity: 6
   - Price: 450
4. Click "🔍 Wine Check"
5. Verify Wine Check panel opens with pre-filled data
6. Run check and verify candidates appear
7. Select a candidate
8. Verify:
   - Match badge appears (green, with score)
   - Enrichment data displayed below row
   - Wine Check panel closes
9. Add another line item (+ button)
10. Remove a line item (✕ button)
11. Verify total calculation updates
12. Refresh page - verify draft persists (localStorage)

### Security Test

1. Open browser console
2. Inspect localStorage: `winefeed_offer_drafts`
3. Verify NO price/offer/currency fields in enrichments
4. Manually inject forbidden field:
   ```javascript
   const drafts = JSON.parse(localStorage.getItem('winefeed_offer_drafts'));
   drafts[0].line_items[0].enrichment.price = 100;
   localStorage.setItem('winefeed_offer_drafts', JSON.stringify(drafts));
   ```
5. Try to edit and save - should throw security violation

## Known Limitations (MVP)

- ❌ No backend persistence (localStorage only)
- ❌ No multi-user collaboration
- ❌ No offer versioning
- ❌ No export to PDF/CSV
- ❌ No email/share functionality
- ❌ `ws_id` not exposed by Wine Check yet
- ❌ `country` not returned by Wine Check API

## Future Enhancements

- [ ] Backend persistence (offer_drafts, offer_lines tables)
- [ ] `persistSelection` prop for auto-save to DB
- [ ] Bulk Wine Check (verify all rows at once)
- [ ] Import from CSV
- [ ] Export to PDF/Excel
- [ ] Share via email
- [ ] Offer templates
- [ ] Price history tracking
- [ ] Wine images from Wine-Searcher

## Support

For questions or issues:
- Check this documentation
- Review Wine Check docs: `docs/WINE_CHECK_USAGE_EXAMPLES.md`
- Review types: `lib/offer-types.ts`
- Check component: `app/offers/components/OfferLineItemRow.tsx`

---

**License:** Internal use only - Winefeed project
