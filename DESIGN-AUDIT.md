# Winefeed Design Audit
**Date:** 2026-01-16
**Scope:** Complete UI/UX analysis of all user-facing pages

---

## Executive Summary

### Overall Assessment
Winefeed har en **fungerande men inkonsistent** designimplementation. Appen använder ett semantiskt färgsystem (CSS variables) och moderna komponenter, men saknar en enhetlig design-standard.

### Critical Issues (Prioritet 1)
1. **Status-färger är inkonsistenta** - Samma semantiska betydelse använder olika färger på olika sidor
2. **Button-styling är blandad** - Vissa sidor använder Button-komponenten, andra inline-classes
3. **Typography-hierarki är oklar** - Flera heading-storlekar utan tydliga nivåer
4. **Card-padding varierar** - p-4, p-6, p-8 används slumpmässigt

### Strengths (Behåll!)
✅ Semantiskt färgsystem (primary, secondary, destructive)
✅ Responsive design (mobile-first med md: breakpoints)
✅ Accessibility (focus rings, disabled states, labels)
✅ Loading states (spinners, disabled buttons)
✅ Clear error messages

---

## 1. Color System Analysis

### Current Color Architecture

Använder **CSS custom properties** via Tailwind:
```css
/* Semantic colors (from globals.css) */
--primary: <hsl value>
--secondary: <hsl value>
--destructive: <hsl value>
--accent: <hsl value>
--muted-foreground: <hsl value>
```

### Color Usage by Context

#### Status Colors (INCONSISTENT ⚠️)

**Import Statuses** (`/app/imports/components/StatusBadge.tsx`):
```
NOT_REGISTERED → bg-gray-100 text-gray-800
SUBMITTED      → bg-blue-100 text-blue-800
APPROVED       → bg-green-100 text-green-800
REJECTED       → bg-red-100 text-red-800
EXPIRED        → bg-orange-100 text-orange-800
```

**Offer Statuses** (`/app/offers/[id]/page.tsx:370`):
```
DRAFT    → bg-yellow-100 text-yellow-800 (⚠️ yellow för draft)
SENT     → bg-blue-100 text-blue-800
ACCEPTED → bg-green-100 text-green-800
REJECTED → bg-red-100 text-red-800
```

**Order Statuses** (`/app/orders/page.tsx:156`):
```
CONFIRMED      → bg-blue-500 (⚠️ full saturation)
IN_FULFILLMENT → bg-yellow-500
SHIPPED        → bg-purple-500 (⚠️ purple helt nytt)
DELIVERED      → bg-green-500
CANCELLED      → bg-gray-500
```

#### Problem: Semantic Mismatch
- "SUBMITTED" = blue-100 (import) men "CONFIRMED" = blue-500 (order)
- "APPROVED" = green-100 men "DELIVERED" = green-500
- "SHIPPED" använder purple (finns inte på andra statuses)

### Recommended Color Palette

#### Status Colors (Unified)
```typescript
// lib/design-system/status-colors.ts
export const statusColors = {
  // Neutral/Initial states
  draft: 'bg-gray-100 text-gray-800 border-gray-300',
  pending: 'bg-blue-100 text-blue-800 border-blue-300',

  // Positive progression
  inProgress: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  completed: 'bg-green-100 text-green-800 border-green-300',

  // Negative outcomes
  rejected: 'bg-red-100 text-red-800 border-red-300',
  cancelled: 'bg-orange-100 text-orange-800 border-orange-300',

  // Special states
  locked: 'bg-purple-100 text-purple-800 border-purple-300',
  expired: 'bg-orange-100 text-orange-800 border-orange-300'
}

// Mapping to business statuses
export const importStatusColors = {
  NOT_REGISTERED: statusColors.draft,
  SUBMITTED: statusColors.pending,
  APPROVED: statusColors.completed,
  REJECTED: statusColors.rejected,
  EXPIRED: statusColors.expired
}

export const offerStatusColors = {
  DRAFT: statusColors.draft,
  SENT: statusColors.pending,
  ACCEPTED: statusColors.completed,
  REJECTED: statusColors.rejected
}

export const orderStatusColors = {
  CONFIRMED: statusColors.pending,
  IN_FULFILLMENT: statusColors.inProgress,
  SHIPPED: statusColors.locked,
  DELIVERED: statusColors.completed,
  CANCELLED: statusColors.cancelled
}
```

#### Brand Colors (Recommendation)
```typescript
// lib/design-system/brand-colors.ts
export const brandColors = {
  // Primary: Sky Blue (professional, trust)
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    500: '#0284c7', // Main brand color
    600: '#0369a1',
    900: '#0c4a6e'
  },

  // Accent: Wine Red (industry connection)
  wine: {
    light: '#fef2f2',
    DEFAULT: '#722f37', // Deep wine red
    dark: '#5c1d24'
  },

  // Accent: Gold (premium feel)
  gold: {
    light: '#fef3c7',
    DEFAULT: '#d4af37',
    dark: '#a78628'
  }
}
```

### Color Frequency Analysis

| Color | Usage Count | Primary Context |
|-------|-------------|-----------------|
| **blue-*** | 🔵🔵🔵🔵🔵 (High) | Info, pending, links |
| **green-*** | 🟢🟢🟢🟢 (High) | Success, approved |
| **yellow/orange** | 🟡🟡🟡 (Medium) | Warning, pending |
| **red-*** | 🔴🔴🔴 (Medium) | Errors, rejected |
| **gray-*** | ⚪️⚪️ (Low) | Neutral, disabled |
| **purple-*** | 🟣 (Rare) | Locked, shipped |

---

## 2. Button Variants & Consistency

### Button Component Base
**Location:** `/components/ui/button.tsx`
**Implementation:** CVA (Class Variance Authority) with 6 variants, 4 sizes

#### Variants
```typescript
{
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline"
}
```

#### Sizes
```typescript
{
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3",
  lg: "h-11 px-8",
  icon: "h-10 w-10"
}
```

### Button Usage Examples

#### ✅ Good: Using Button Component
```tsx
// app/offers/new/page.tsx:182
<Button type="submit" disabled={loading} className="w-full" size="lg">
  {loading ? "Skapar offert..." : "✓ Skapa offert"}
</Button>

// app/offers/[id]/page.tsx:654
<Button onClick={handleAcceptOffer} variant="default" size="lg">
  ✓ Acceptera offert
</Button>
```

#### ⚠️ Inconsistent: Inline Styled Buttons
```tsx
// app/dashboard/requests/[id]/page.tsx:109-114
<button
  onClick={() => router.back()}
  className="px-4 py-2 bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90"
>
  ← Tillbaka
</button>

// app/orders/page.tsx:245-250
<button
  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
>
  Filter
</button>
```

### Issue: Mixed Padding Standards
- Button component: `px-4 py-2` (default)
- Inline buttons: `px-4 py-2`, `px-6 py-3`, `px-3 py-1.5` (inconsistent)

### Recommendation
**Create Button Standard:**
```tsx
// lib/design-system/button-patterns.ts
export const buttonPatterns = {
  // Primary actions (submit, save, create)
  primary: { variant: "default", size: "default" },

  // Large CTAs (accept offer, confirm order)
  cta: { variant: "default", size: "lg" },

  // Secondary actions (cancel, back, skip)
  secondary: { variant: "outline", size: "default" },

  // Danger actions (delete, reject, deny)
  danger: { variant: "destructive", size: "default" },

  // Minimal actions (details, toggle)
  ghost: { variant: "ghost", size: "sm" },

  // Icon-only buttons
  icon: { variant: "ghost", size: "icon" }
}
```

**Migration Plan:**
1. Audit all inline `<button>` tags → convert to `<Button>`
2. Standardize CTA buttons to `size="lg"`
3. Enforce through ESLint rule (ban `<button className=...>`)

---

## 3. Form Patterns

### Input Fields
**Component:** `/components/ui/input.tsx`

#### Standard Input Classes
```tsx
"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
ring-offset-background placeholder:text-muted-foreground
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
disabled:cursor-not-allowed disabled:opacity-50"
```

### Input Types Used

| Type | Example | File |
|------|---------|------|
| Text | Wine name | `offers/components/OfferLineItemRow.tsx:82` |
| Number | Vintage, Quantity | `offers/components/OfferLineItemRow.tsx:96` |
| Textarea | Notes, reasons | `imports/[id]/page.tsx:740` |
| Select | Currency | `offers/new/page.tsx:144` |
| Checkbox | Include in offer | `dashboard/results/[id]/page.tsx` |

### Validation Patterns

#### Required Fields
```tsx
<Label htmlFor="title">
  Offerttitel <span className="text-destructive">*</span>
</Label>
```
**Location:** `offers/new/page.tsx:108`

#### Error Display
```tsx
{error && (
  <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-sm text-destructive">
    <p className="font-medium">Fel:</p>
    <p>{error}</p>
  </div>
)}
```
**Location:** `offers/new/page.tsx:168-172`

#### Success Messages
```tsx
<div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
  <p className="font-medium">Framgång!</p>
  <p>Offerten har skapats.</p>
</div>
```

### Info Boxes (Contextual Help)

#### Blue Info Box
```tsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
  <p className="font-medium mb-2">ℹ️ Information</p>
  <p>Detta är en informationstext.</p>
</div>
```
**Location:** `offers/[id]/page.tsx:489-502`

#### Yellow Warning
```tsx
<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
  <p className="font-medium mb-2">⚠️ Varning</p>
  <p>Detta är en varningstext.</p>
</div>
```
**Location:** `offers/[id]/page.tsx:427-442`

### Recommendation: Message Component
```tsx
// components/ui/message.tsx
export type MessageVariant = 'info' | 'success' | 'warning' | 'error';

interface MessageProps {
  variant: MessageVariant;
  title?: string;
  children: React.ReactNode;
}

export function Message({ variant, title, children }: MessageProps) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    error: 'bg-red-50 border-red-200 text-red-900'
  };

  return (
    <div className={`border rounded-lg p-4 text-sm ${styles[variant]}`}>
      {title && <p className="font-medium mb-2">{title}</p>}
      {children}
    </div>
  );
}
```

---

## 4. Layout Patterns

### Card Components

#### Standard Card Pattern
```tsx
className="bg-card border border-border rounded-lg shadow-sm p-6"
```

**Issue:** Padding varies
- Most cards: `p-6` (24px)
- Some cards: `p-4` (16px)
- Large cards: `p-8` (32px)

**Recommendation:**
```typescript
// lib/design-system/card-patterns.ts
export const cardPadding = {
  sm: 'p-4',    // Small cards, list items
  default: 'p-6', // Standard cards
  lg: 'p-8'     // Feature sections, hero cards
}

export const cardStyles = {
  default: 'bg-card border border-border rounded-lg shadow-sm',
  elevated: 'bg-card border border-border rounded-lg shadow-md',
  interactive: 'bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer'
}
```

### Grid Layouts

| Pattern | Usage | Example File |
|---------|-------|--------------|
| `grid-cols-2` | Two columns | Multiple |
| `grid-cols-3` | Three columns | Dashboard widgets |
| `grid-cols-4` | Four columns | Summary stats |
| `grid-cols-12` | Fine-grained | Offer line editing |

**Responsive Pattern:**
```tsx
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
```

### Spacing Scale

**Current spacing (Inconsistent):**
```
gap-2  (8px)
gap-3  (12px)
gap-4  (16px)
gap-6  (24px)

space-y-1 (4px)
space-y-2 (8px)
space-y-3 (12px)
space-y-4 (16px)
space-y-6 (24px)
```

**Recommended scale (4px base):**
```typescript
// lib/design-system/spacing.ts
export const spacing = {
  xs: 'gap-1',      // 4px - Minimal
  sm: 'gap-2',      // 8px - Tight
  default: 'gap-4', // 16px - Standard
  lg: 'gap-6',      // 24px - Loose
  xl: 'gap-8',      // 32px - Sections

  // Vertical spacing
  stack: {
    tight: 'space-y-2',    // 8px - Form fields
    default: 'space-y-4',  // 16px - Sections
    loose: 'space-y-6'     // 24px - Major sections
  }
}
```

---

## 5. Typography Patterns

### Heading Hierarchy

**Current (INCONSISTENT):**
```tsx
// Page titles
text-2xl font-bold tracking-tight    // dashboard/new-request:22
text-2xl font-bold                   // dashboard/offers/[id]:360
text-xl font-bold                    // offers/[id]:508

// Section titles
text-lg font-semibold                // orders/[id]:281
font-semibold text-foreground        // offers/[id]:505

// Labels
text-sm font-medium                  // StatusBadge:79
```

**Recommended (Strict hierarchy):**
```typescript
// lib/design-system/typography.ts
export const typography = {
  // Page headings
  h1: 'text-3xl font-bold tracking-tight text-foreground',    // 30px
  h2: 'text-2xl font-bold text-foreground',                   // 24px
  h3: 'text-xl font-semibold text-foreground',                // 20px
  h4: 'text-lg font-semibold text-foreground',                // 18px

  // Body text
  body: {
    large: 'text-lg text-foreground',      // 18px - Summaries
    default: 'text-base text-foreground',  // 16px - Primary content
    small: 'text-sm text-muted-foreground' // 14px - Helper text
  },

  // Meta/labels
  label: 'text-sm font-medium text-foreground',
  caption: 'text-xs text-muted-foreground',    // 12px - Timestamps

  // Monospace (IDs, codes)
  mono: 'font-mono text-sm'
}
```

### Font Weight Scale
```
font-normal   (400) - Body text
font-medium   (500) - Labels, emphasis
font-semibold (600) - Headings h3-h4
font-bold     (700) - Main headings h1-h2
```

### Text Colors
```tsx
text-foreground         // Primary text
text-muted-foreground   // Secondary text (60% opacity equivalent)
text-primary            // Links, actions
text-destructive        // Errors
text-white              // On dark backgrounds
```

---

## 6. Navigation Patterns

### Header Structure (Consistent ✅)

All pages follow similar pattern:
```tsx
<header className="bg-primary text-primary-foreground shadow-lg">
  <div className="max-w-7xl mx-auto px-4 py-6">
    <div className="flex items-center justify-between">
      {/* Left: Icon + Title */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Back button or action buttons */}
      </div>
    </div>
  </div>
</header>
```

### Back Navigation Pattern
```tsx
<button
  onClick={() => router.back()}
  className="px-4 py-2 bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90"
>
  ← Tillbaka
</button>
```

### User Flows

#### Restaurant Flow
```
1. Create request    → /dashboard/new-request
2. View suggestions  → /dashboard/results/[id]
3. Review offers     → /dashboard/offers/[id]
4. Track orders      → /orders → /orders/[id]
```

#### Supplier Flow
```
1. View requests     → /dashboard/requests
2. Request details   → /dashboard/requests/[id]
3. Create offer      → /offers/new
4. Edit offer        → /offers/[id]
```

#### Importer Flow
```
1. Create import     → /imports/new
2. Manage import     → /imports/[id]
3. View orders       → /ior/orders → /ior/orders/[id]
```

### Missing Navigation Elements
- ❌ No breadcrumbs (could help orientation)
- ❌ No main navigation menu (relies on direct links)
- ❌ No "Home" button in header

---

## 7. Status Indicators

### StatusBadge Component
**Location:** `/app/imports/components/StatusBadge.tsx`

```tsx
<span className={`
  inline-flex items-center
  px-2 py-1
  rounded-md
  text-xs font-medium
  border
  ${statusColors[status]}
`}>
  {label}
</span>
```

### Match Status Badges
**Location:** `/app/components/match/MatchStatusBadge.tsx`

Includes:
- Icon (✅, 🔵, 💡, ✓, ✗, ⏳)
- Status label
- Confidence percentage
- Color-coded background

### Timeline Visualization
**Location:** `/app/imports/components/StatusTimeline.tsx`

Shows status progression:
```
NOT_REGISTERED
    ↓ (vertical line)
SUBMITTED (2025-01-10 14:30)
    ↓
APPROVED (2025-01-11 09:15) ← current
```

### Match Score Progress Bar
**Location:** `/app/dashboard/offers/[id]/page.tsx:179`

```tsx
<div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
  <div
    className={`h-full transition-all ${
      score >= 80 ? 'bg-green-500' :
      score >= 60 ? 'bg-yellow-500' :
      'bg-orange-500'
    }`}
    style={{ width: `${score}%` }}
  />
</div>
```

---

## 8. Component Library Summary

### Existing UI Components (`/components/ui/`)
- ✅ `button.tsx` - CVA-based button (6 variants, 4 sizes)
- ✅ `input.tsx` - Text input field
- ✅ `label.tsx` - Form labels
- ✅ `textarea.tsx` - Multi-line input

### Custom Components (`/app/imports/components/`)
- ✅ `StatusBadge.tsx` - Status display
- ✅ `StatusTimeline.tsx` - Status history
- ✅ `Accordion.tsx` - Collapsible sections
- ✅ `Tooltip.tsx` - Help text
- ✅ `DocumentList.tsx` - File listing
- ✅ `ActionsPanel.tsx` - Action buttons
- ✅ `SupplierImportWidget.tsx` - CSV import
- ✅ `WineSearcherCheck.tsx` - Wine validation

### Domain Components (`/app/components/`)
- ✅ `wine-check/` - Wine validation UI
- ✅ `match/` - Matching system UI

### Missing Components (Should Create)
- ❌ `Card` - Standardized card wrapper
- ❌ `Message` - Info/success/warning/error boxes
- ❌ `Badge` - Generic badge component
- ❌ `Select` - Dropdown select
- ❌ `Dialog` - Modal dialogs
- ❌ `Table` - Data tables
- ❌ `Breadcrumbs` - Navigation helper

---

## 9. Key Findings & Recommendations

### Critical Issues (Fix First)

#### 1. Status Color Inconsistency
**Problem:** Same semantic meaning uses different colors across pages.

**Impact:** Users can't learn the system - "blue" means different things.

**Fix:**
```typescript
// Create lib/design-system/status-colors.ts
// Define unified color mapping
// Update all StatusBadge usages
```

**Files to update:**
- `/app/imports/components/StatusBadge.tsx`
- `/app/offers/[id]/page.tsx` (lines 370-375)
- `/app/orders/page.tsx` (lines 156-165)
- `/app/dashboard/requests/[id]/page.tsx` (lines 122-126)

**Estimated effort:** 2-3 hours

---

#### 2. Button Styling Mixed
**Problem:** Some use Button component, others use inline classes.

**Impact:** Visual inconsistency, harder to maintain.

**Fix:**
1. Grep all `<button className=` → convert to `<Button>`
2. Add ESLint rule: `"react/forbid-elements": ["error", { "forbid": ["button"] }]`

**Files to update:** ~15 files

**Estimated effort:** 4-5 hours

---

#### 3. Typography Hierarchy Unclear
**Problem:** Multiple heading sizes without clear h1/h2/h3 distinction.

**Impact:** Visual hierarchy confusing, accessibility issues.

**Fix:**
```typescript
// Create lib/design-system/typography.ts
// Document strict heading levels
// Create Heading component with level prop
```

**Estimated effort:** 3-4 hours

---

#### 4. Card Padding Variations
**Problem:** p-4, p-6, p-8 used inconsistently.

**Impact:** Visual rhythm broken, inconsistent spacing.

**Fix:**
```typescript
// Create components/ui/card.tsx
// Define size variants: sm, default, lg
// Wrap all cards with component
```

**Estimated effort:** 2-3 hours

---

### Medium Priority Issues

#### 5. No Breadcrumbs
**Impact:** Users don't know where they are in deep flows.

**Fix:** Add Breadcrumbs component to navigation.

**Estimated effort:** 3-4 hours

---

#### 6. Mixed Spacing Scale
**Impact:** Visual inconsistency.

**Fix:** Document spacing scale, enforce through Tailwind config.

**Estimated effort:** 2 hours

---

#### 7. No Central Message Component
**Impact:** Duplicated error/success styling.

**Fix:** Create `<Message variant="info|success|warning|error">` component.

**Estimated effort:** 1-2 hours

---

### Low Priority (Polish)

- Add loading skeletons (replace empty states)
- Micro-interactions (button hover animations)
- Empty state illustrations
- Dark mode support
- Print stylesheets (for orders, imports)

---

## 10. Implementation Roadmap

### Phase 1: Foundation (1 week)
**Goal:** Establish design system basics

**Tasks:**
1. Create `lib/design-system/` folder structure
2. Define color constants (`status-colors.ts`, `brand-colors.ts`)
3. Define typography scale (`typography.ts`)
4. Define spacing scale (`spacing.ts`)
5. Document in DESIGN-SYSTEM.md

**Deliverables:**
- Design token files
- Documentation
- No visual changes yet

---

### Phase 2: Component Standardization (1 week)
**Goal:** Fix button and card inconsistencies

**Tasks:**
1. Convert all `<button>` to `<Button>` (15 files)
2. Create `Card` component with variants
3. Create `Message` component
4. Create `Badge` component (generic)
5. Add ESLint rules to prevent regression

**Deliverables:**
- Consistent buttons across app
- Standardized cards
- Reusable message component

---

### Phase 3: Status & Navigation (1 week)
**Goal:** Unify status colors and improve navigation

**Tasks:**
1. Refactor StatusBadge with unified colors
2. Update all status displays (4+ files)
3. Add Breadcrumbs component
4. Add breadcrumbs to key pages
5. Test color consistency

**Deliverables:**
- Unified status colors
- Better navigation context
- User testing feedback

---

### Phase 4: Typography & Polish (3-4 days)
**Goal:** Refine visual hierarchy

**Tasks:**
1. Create `Heading` component with levels
2. Audit all headings → convert to component
3. Fix text color inconsistencies
4. Add focus states to all interactive elements
5. Accessibility audit

**Deliverables:**
- Clear visual hierarchy
- WCAG 2.1 AA compliance
- Polished look & feel

---

## 11. Quick Wins (Do First!)

These can be done **immediately** with minimal risk:

### 1. Fix Button Padding (30 min)
Replace all `px-4 py-2` inline buttons with `<Button>`.

**Files:**
- `app/dashboard/requests/[id]/page.tsx:109`
- `app/orders/page.tsx:245`

---

### 2. Standardize Card Padding (1 hour)
Change all cards to `p-6` (except explicitly small cards).

**Impact:** Immediate visual consistency.

---

### 3. Add Loading States (1 hour)
Ensure all submit buttons show "Loading..." with disabled state.

**Files:** Check all forms in:
- `/app/offers/new/page.tsx`
- `/app/imports/new/page.tsx`
- `/app/dashboard/new-request/page.tsx`

---

### 4. Fix Error Message Styling (30 min)
Ensure all errors use:
```tsx
<div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-sm text-destructive">
```

---

### 5. Add Focus Rings (1 hour)
Verify all interactive elements have visible focus states for keyboard navigation.

**Test:** Tab through every page.

---

## 12. Design System Files to Create

```
lib/design-system/
  ├── status-colors.ts       # Unified status color mapping
  ├── brand-colors.ts        # Primary/accent brand colors
  ├── typography.ts          # Heading/body text scales
  ├── spacing.ts             # Gap/padding/margin scale
  ├── button-patterns.ts     # Button usage guidelines
  └── card-patterns.ts       # Card variant definitions

components/ui/
  ├── button.tsx             # (exists) - keep
  ├── input.tsx              # (exists) - keep
  ├── label.tsx              # (exists) - keep
  ├── textarea.tsx           # (exists) - keep
  ├── card.tsx               # NEW - Standardized card wrapper
  ├── message.tsx            # NEW - Info/success/warning/error
  ├── badge.tsx              # NEW - Generic badge component
  ├── heading.tsx            # NEW - Typography component
  ├── select.tsx             # NEW - Dropdown select
  └── breadcrumbs.tsx        # NEW - Navigation helper

DESIGN-SYSTEM.md              # NEW - Complete design documentation
```

---

## 13. Color Examples (Visual Reference)

### Current Status Colors

```
Import Statuses:
[gray    ] NOT_REGISTERED - Ej registrerad
[blue    ] SUBMITTED - Inskickad
[green   ] APPROVED - Godkänd
[red     ] REJECTED - Avslagen
[orange  ] EXPIRED - Utgången

Offer Statuses:
[yellow  ] DRAFT - Utkast
[blue    ] SENT - Skickad
[green   ] ACCEPTED - Accepterad
[red     ] REJECTED - Avslagen

Order Statuses:
[blue-500   ] CONFIRMED - Bekräftad
[yellow-500 ] IN_FULFILLMENT - I leverans
[purple-500 ] SHIPPED - Skickad
[green-500  ] DELIVERED - Levererad
[gray-500   ] CANCELLED - Avbruten
```

### Proposed Unified System

```
States:
[gray-100  ] draft / initial - Utkast / Ej registrerad
[blue-100  ] pending / sent - Inskickad / Skickad
[yellow-100] in progress - I pågående / Under behandling
[green-100 ] completed - Godkänd / Accepterad / Levererad
[red-100   ] rejected - Avslagen
[orange-100] cancelled / expired - Avbruten / Utgången
[purple-100] locked / shipped - Låst / Skickad (specialfall)
```

---

## 14. Metrics & Measurements

### Current State
- **Total pages:** 19 user-facing pages
- **Color variants used:** 30+ different Tailwind color classes
- **Button variants:** 6 (component) + 10+ (inline custom)
- **Typography sizes:** 8+ different text-* classes
- **Spacing values:** 10+ different gap/space-y values
- **Card padding variants:** 3 (p-4, p-6, p-8)

### Target State (After Design System)
- **Color variants:** 12 semantic colors (documented)
- **Button variants:** 6 (all through component)
- **Typography sizes:** 6 defined levels (h1-h4, body, caption)
- **Spacing values:** 5 standard increments (xs, sm, default, lg, xl)
- **Card padding variants:** 3 explicit (sm, default, lg)

### Success Metrics
- [ ] 100% of buttons use Button component
- [ ] 100% of status badges use unified colors
- [ ] Zero inline `<button className=...>` tags
- [ ] All headings use defined typography scale
- [ ] All cards use Card component with explicit size

---

## 15. Next Steps

### Immediate Action (Today)
1. Review this audit with team
2. Prioritize which phase to start with
3. Create design system folder structure
4. Pick 1 quick win to implement

### This Week
1. Phase 1: Create design token files
2. Document color/typography decisions
3. Get stakeholder approval on brand colors

### Next 2 Weeks
1. Phase 2: Standardize buttons and cards
2. Create reusable components
3. Test on 2-3 pilot pages

---

## Appendix A: File Reference

### Pages with Status Colors
- `/app/imports/components/StatusBadge.tsx` - Import statuses
- `/app/offers/[id]/page.tsx:370` - Offer statuses
- `/app/orders/page.tsx:156` - Order statuses
- `/app/dashboard/requests/[id]/page.tsx:122` - Request statuses
- `/app/components/match/MatchStatusBadge.tsx` - Match statuses

### Pages with Custom Buttons
- `/app/dashboard/requests/[id]/page.tsx:109` - Back button
- `/app/orders/page.tsx:245` - Filter button
- `/app/imports/[id]/page.tsx:719` - Reject button

### Pages with Form Inputs
- `/app/offers/new/page.tsx` - Offer creation form
- `/app/offers/components/OfferLineItemRow.tsx` - Line item editing
- `/app/dashboard/new-request/page.tsx` - Wine request form
- `/app/imports/new/page.tsx` - Import case form

### Pages with Cards
- `/app/dashboard/requests/[id]/page.tsx:129` - Request details card
- `/app/offers/[id]/page.tsx:446` - Offer header card
- `/app/imports/[id]/page.tsx:182` - Import summary card
- `/app/orders/[id]/page.tsx` - Order details cards

---

**End of Design Audit**

For questions or clarifications, refer to specific file paths and line numbers throughout this document.
