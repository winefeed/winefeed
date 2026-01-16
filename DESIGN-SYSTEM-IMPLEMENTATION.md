# Design System Foundation - Implementation Summary

**Date:** 2026-01-16
**Branch:** staging
**Commit:** d4f77db

---

## ✅ Completed

### 1. Design System Tokens Created

**Location:** `lib/design-system/`

#### `status-colors.ts`
- Type-safe semantic status color mapping
- Unified color system for all business statuses
- Helper function: `getStatusColor(status, label?)`
- Semantic categories: draft, pending, progress, completed, rejected, cancelled, locked
- Fallback to neutral gray for unknown statuses

**Status Mapping:**
```typescript
draft     → gray-100   (NOT_REGISTERED, DRAFT)
pending   → blue-100   (SUBMITTED, SENT, CONFIRMED)
progress  → yellow-100 (IN_FULFILLMENT)
completed → green-100  (APPROVED, ACCEPTED, DELIVERED)
rejected  → red-100    (REJECTED)
cancelled → orange-100 (CANCELLED, EXPIRED)
locked    → purple-100 (SHIPPED)
```

#### `spacing.ts`
- Card padding variants: sm (p-4), md (p-6), lg (p-8)
- Gap spacing: xs, sm, default, lg, xl
- Stack spacing: tight, default, loose

#### `typography.ts`
- Heading hierarchy: h1, h2, h3, h4
- Body text: large, default, small
- Labels and captions
- Text color variants

---

### 2. Components Created

#### `components/ui/card.tsx`
- Standardized Card wrapper component
- Size variants: sm, md, lg (default: md)
- Optional onClick handler for interactive cards
- Subcomponents: CardHeader, CardContent, CardFooter
- Consistent styling: bg-card, border, rounded-lg, shadow-sm

**Usage:**
```tsx
<Card size="md">
  <CardHeader>
    <h3>Card Title</h3>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
</Card>
```

#### `app/orders/components/StatusBadge.tsx`
- Order status badge using unified colors
- Status labels in Swedish
- Size variants: sm, md, lg

**Usage:**
```tsx
<OrderStatusBadge status="CONFIRMED" size="md" />
```

#### `app/offers/components/OfferStatusBadge.tsx`
- Offer status badge with emoji icons
- Uses unified design system colors
- Icons: 📝 (DRAFT), 📤 (SENT), ✅ (ACCEPTED), ❌ (REJECTED)

**Usage:**
```tsx
<OfferStatusBadge status="SENT" size="lg" />
```

---

### 3. Refactored Components

#### `app/imports/components/StatusBadge.tsx`
**Before:**
- Hardcoded color strings in config objects
- Duplicated colors for case and delivery place statuses

**After:**
- Uses `getStatusColor()` from design system
- Removed hardcoded color definitions
- Keeps labels and tooltips (business logic unchanged)

**Changes:**
```diff
- import { Tooltip } from './Tooltip';
+ import { Tooltip } from './Tooltip';
+ import { getStatusColor } from '@/lib/design-system/status-colors';

- const CASE_STATUS_CONFIG = {
-   NOT_REGISTERED: {
-     label: 'Ej registrerad',
-     color: 'bg-gray-100 text-gray-800 border-gray-300',
-     tooltip: '...',
-   },
+ const CASE_STATUS_CONFIG = {
+   NOT_REGISTERED: {
+     label: 'Ej registrerad',
+     tooltip: '...',
+   },

- const { badgeClass } = getStatusColor(status);
+ <span className={`... ${badgeClass} ...`}>
```

#### `app/orders/page.tsx`
**Before:**
- Inline `getStatusColor()` and `getStatusLabel()` functions
- Inline badge rendering with `className` string

**After:**
- Imports `OrderStatusBadge` component
- Uses component instead of inline styling
- Removed `getStatusColor()` function (kept `getStatusLabel()` for filter buttons)

**Changes:**
```diff
+ import { OrderStatusBadge } from './components/StatusBadge';

- <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(order.status)}`}>
-   {getStatusLabel(order.status)}
- </span>
+ <OrderStatusBadge status={order.status} size="md" />
```

#### `app/offers/[id]/page.tsx`
**Before:**
- Hardcoded `statusStyles` object with inline colors
- Complex inline badge with icons and status text

**After:**
- Imports `OfferStatusBadge` component
- Uses component with size="lg"
- Removed `statusStyles` object

**Changes:**
```diff
+ import { OfferStatusBadge } from '../components/OfferStatusBadge';

- const statusStyles = {
-   DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-300',
-   SENT: 'bg-blue-100 text-blue-800 border-blue-300',
-   ACCEPTED: 'bg-green-100 text-green-800 border-green-300',
-   REJECTED: 'bg-red-100 text-red-800 border-red-300'
- };

- <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium ${statusStyles[offer.status]}`}>
-   <span className="text-lg">
-     {offer.status === 'DRAFT' && '📝'}
-     {offer.status === 'SENT' && '📤'}
-     ...
-   </span>
-   <span>Status: {offer.status}</span>
- </div>
+ <OfferStatusBadge status={offer.status} size="lg" />
```

---

## 📊 Files Changed

### Created (10 files)
1. `lib/design-system/status-colors.ts` (151 lines)
2. `lib/design-system/spacing.ts` (35 lines)
3. `lib/design-system/typography.ts` (50 lines)
4. `components/ui/card.tsx` (80 lines)
5. `app/orders/components/StatusBadge.tsx` (38 lines)
6. `app/offers/components/OfferStatusBadge.tsx` (47 lines)

### Modified (3 files)
7. `app/imports/components/StatusBadge.tsx` (removed color strings, added import)
8. `app/orders/page.tsx` (removed inline badge, added component)
9. `app/offers/[id]/page.tsx` (removed inline badge, added component)

**Total:** 9 files changed, 433 insertions(+), 48 deletions(-)

---

## ✅ Verification

### Build Status
```bash
npm run build
# ✅ SUCCESS - Build completed without errors
```

### Visual Changes
- **Import statuses:** Consistent colors (gray, blue, green, red, orange)
- **Order statuses:** Consistent colors (blue, yellow, purple, green, gray)
- **Offer statuses:** Consistent colors with icons (gray, blue, green, red)
- **No behavior changes:** All business logic unchanged

### Type Safety
- All status color mappings are type-safe
- TypeScript compilation succeeds without errors
- No runtime dependencies added

---

## 🔍 Remaining Inline Badge Styles

Use these grep commands to find remaining inline badge styles that should be refactored in future iterations:

### Find all inline status badges
```bash
grep -rn "bg-\(blue\|green\|yellow\|red\|orange\|purple\|gray\)-\(100\|500\).*text-\(blue\|green\|yellow\|red\|orange\|purple\|gray\)" app/ \
  --include="*.tsx" --include="*.ts" \
  | grep -v "node_modules\|StatusBadge\|design-system"
```

### Files with remaining inline badges (Priority Order)

#### High Priority (Status Badges)
1. **`app/orders/page.tsx:331-337`** - Import status badge (inline conditional)
   ```tsx
   <span className={`px-2 py-1 rounded-full text-xs font-medium ${
     order.import_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
     order.import_status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
     'bg-gray-100 text-gray-800'
   }`}>
   ```
   **Recommendation:** Create `ImportStatusBadge` component

2. **`app/imports/components/WineSearcherCheck.tsx:43-63`** - Wine check status colors
   **Recommendation:** Use `getStatusColor()` or create `WineCheckStatusBadge`

3. **`app/dashboard/requests/[id]/page.tsx`** - Offer status badges (need to check)
   **Recommendation:** Use `OfferStatusBadge` component

#### Medium Priority (Match/Check Status)
4. **`app/offers/components/OfferLineItemRow.tsx:171-174`** - Match score colors
   **Recommendation:** Use semantic colors for match confidence

5. **`app/match/status/page.tsx:106-114`** - Match health status
   **Recommendation:** Create `MatchHealthBadge` component or use semantic colors

6. **`app/components/match/MatchStatusBadge.tsx`** - May already use design system (verify)

#### Low Priority (Admin/Alerts)
7. **`app/admin/pilot/page.tsx:290-471`** - Alert count badges
   **Recommendation:** Extract to AlertBadge component with semantic colors

8. **`app/offers/[id]/page.tsx:407`** - Locked badge (purple)
   **Recommendation:** Use semantic `locked` color from design system

---

## 🎯 Next Steps (Recommended)

### Phase 1: Complete Status Badge Migration (1-2 hours)
1. Create `ImportStatusBadge` component for order import status
2. Update `app/orders/page.tsx:331-337` to use component
3. Verify all import status displays are consistent

### Phase 2: Match/Wine Check Badges (2-3 hours)
1. Update `app/imports/components/WineSearcherCheck.tsx` to use design system
2. Refactor `app/offers/components/OfferLineItemRow.tsx` match score colors
3. Create `MatchHealthBadge` for `app/match/status/page.tsx`

### Phase 3: Admin/Alert Badges (1-2 hours)
1. Create `AlertBadge` component for admin pilot page
2. Use semantic colors for alert levels
3. Update locked badge in offers to use semantic `locked` color

### Phase 4: Typography & Card Migration (1 week)
1. Audit all heading sizes and create `Heading` component
2. Migrate existing cards to use `Card` component
3. Standardize spacing across all pages

---

## 📝 Usage Guidelines

### When to Use Design System Components

#### Status Badges
Use unified status badges for:
- Import case statuses (NOT_REGISTERED, SUBMITTED, APPROVED, REJECTED, EXPIRED)
- Order statuses (CONFIRMED, IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)
- Offer statuses (DRAFT, SENT, ACCEPTED, REJECTED)

**Example:**
```tsx
import { getStatusColor } from '@/lib/design-system/status-colors';

const { badgeClass } = getStatusColor('SUBMITTED', 'Inskickad');
// => badgeClass: 'bg-blue-100 text-blue-800 border-blue-300'
```

#### Cards
Use Card component for:
- Data panels
- Form containers
- List items (with onClick)
- Feature sections

**Example:**
```tsx
import { Card, CardHeader, CardContent } from '@/components/ui/card';

<Card size="md">
  <CardHeader>
    <h3>Order Details</h3>
  </CardHeader>
  <CardContent>
    <p>Order information...</p>
  </CardContent>
</Card>
```

#### Typography
Use typography constants for:
- Consistent heading hierarchy
- Body text sizing
- Labels and captions

**Example:**
```tsx
import { typography } from '@/lib/design-system/typography';

<h1 className={typography.h1}>Page Title</h1>
<p className={typography.body.default}>Body text</p>
<span className={typography.caption}>Meta information</span>
```

---

## 🚫 What NOT to Do

### ❌ Don't create new inline status colors
```tsx
// BAD
<span className="bg-green-100 text-green-800">Status</span>

// GOOD
import { getStatusColor } from '@/lib/design-system/status-colors';
const { badgeClass } = getStatusColor('APPROVED');
<span className={badgeClass}>Status</span>
```

### ❌ Don't hardcode card padding
```tsx
// BAD
<div className="bg-card border rounded-lg p-4">...</div>

// GOOD
import { Card } from '@/components/ui/card';
<Card size="sm">...</Card>
```

### ❌ Don't use inconsistent heading sizes
```tsx
// BAD
<h2 className="text-xl font-bold">Title</h2>
<h2 className="text-2xl font-semibold">Another Title</h2>

// GOOD
import { typography } from '@/lib/design-system/typography';
<h2 className={typography.h2}>Title</h2>
<h2 className={typography.h2}>Another Title</h2>
```

---

## 📚 Design System Documentation

### Color Palette Reference

#### Status Colors (Light Backgrounds)
```
gray-100   + gray-800   + gray-300   = Draft/Neutral
blue-100   + blue-800   + blue-300   = Pending/Info
yellow-100 + yellow-800 + yellow-300 = Progress/Warning
green-100  + green-800  + green-300  = Completed/Success
red-100    + red-800    + red-300    = Rejected/Error
orange-100 + orange-800 + orange-300 = Cancelled/Expired
purple-100 + purple-800 + purple-300 = Locked/Special
```

#### Spacing Scale (Base 4px)
```
xs:      gap-1  = 4px
sm:      gap-2  = 8px
default: gap-4  = 16px
lg:      gap-6  = 24px
xl:      gap-8  = 32px
```

#### Card Padding
```
sm: p-4 = 16px (compact list items)
md: p-6 = 24px (standard cards)
lg: p-8 = 32px (hero sections)
```

#### Typography Scale
```
h1: text-3xl font-bold        = 30px (page titles)
h2: text-2xl font-bold        = 24px (section titles)
h3: text-xl font-semibold     = 20px (subsection titles)
h4: text-lg font-semibold     = 18px (card titles)
body.large: text-lg           = 18px (leads)
body.default: text-base       = 16px (body)
body.small: text-sm           = 14px (helper text)
label: text-sm font-medium    = 14px (labels)
caption: text-xs              = 12px (meta)
```

---

## 🔗 Related Files

- `DESIGN-AUDIT.md` - Complete design system audit
- `DESIGN-QUICK-ACTIONS.md` - Quick reference guide
- `RELEASE.md` - Release workflow documentation

---

**Implementation by:** Claude Opus 4.5
**Review Status:** ✅ Ready for testing
**Next Review:** After Phase 1 completion
