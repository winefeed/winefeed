# Wine Check Module

## Overview

Reusable Wine-Searcher Wine Check integration module.

**Purpose:** Verify and normalize wine names using Wine-Searcher API - NO PRICE DATA.

## Features

✅ **Reusable** - Use in Import Cases, Quotes, CSV imports, Product cards
✅ **Two modes** - Standalone (manual input) & Controlled (pre-filled with callbacks)
✅ **Type-safe** - Full TypeScript support with allowlist types
✅ **Secure** - Multiple layers of validation to prevent price data leakage
✅ **Tested** - 12 automated tests guarantee NO PRICE DATA policy

## Quick Start

### Standalone Mode

```tsx
import { WineCheckPanel } from '@/app/components/wine-check';

<WineCheckPanel
  mode="standalone"
  title="Wine Check"
  description="Verifiera och normalisera ett vin-namn."
/>
```

### Controlled Mode

```tsx
import { WineCheckPanel } from '@/app/components/wine-check';

<WineCheckPanel
  mode="controlled"
  initialName={lineItem.name}
  initialVintage={lineItem.vintage}
  onSelectCandidate={(candidate) => {
    updateLineItem({
      canonical_name: candidate.name,
      producer: candidate.producer,
      region: candidate.region
    });
  }}
/>
```

## Module Structure

```
app/components/wine-check/
├── index.ts                    # Public exports
├── types.ts                    # TypeScript types (allowlist only)
├── useWineCheck.ts             # React hook for Wine Check logic
├── WineCheckPanel.tsx          # Container component
├── WineCheckForm.tsx           # Input form
├── WineCheckResult.tsx         # Result display
├── WineCheckCandidates.tsx     # Candidate list with selection
├── WineCheckBadge.tsx          # Status badges
└── README.md                   # This file
```

## Components

### WineCheckPanel

Main container component. Supports both standalone and controlled modes.

**Props:**
- `mode`: 'standalone' | 'controlled'
- `initialName`: Pre-fill wine name (controlled mode)
- `initialVintage`: Pre-fill vintage (controlled mode)
- `onSelectCandidate`: Callback when user selects a candidate (controlled mode)
- `title`: Panel title (default: "Wine Check")
- `description`: Description text
- `compact`: Smaller spacing
- `hideVintage`: Hide vintage input
- `tenantId`: Optional tenant ID

### useWineCheck

React hook for Wine Check functionality.

**Returns:**
- `name`, `vintage`: Current input values
- `loading`: Loading state
- `error`: Error message
- `result`: Wine Check result
- `mock`: Mock mode indicator
- `setName`, `setVintage`: Update inputs
- `runCheck()`: Execute Wine Check
- `reset()`: Clear state

### Sub-components

- **WineCheckForm** - Input form with submit button
- **WineCheckResult** - Display normalized wine data
- **WineCheckCandidates** - Show alternative matches with selection
- **WineCheckBadge** - Mock mode and match status badges

## Types

All types are exported from `types.ts`:

```typescript
import type {
  WineCheckCandidate,
  WineCheckResultType,
  WineCheckResponse,
  WineCheckInput,
  MatchStatus
} from '@/app/components/wine-check';
```

**Allowlist fields only:**
- canonical_name
- producer
- region
- appellation
- match_score
- match_status
- candidates

**NO price/offer/currency fields allowed.**

## Security

### Validation Layers

1. **Type system** - TypeScript types enforce allowlist fields
2. **Runtime checks** - `assertNoForbiddenFields()` validates responses
3. **API layer** - Server-side validation before sending to client
4. **Component layer** - Client-side validation in hook

### Guards

```typescript
import { assertNoForbiddenFields } from '@/app/components/wine-check';

// Validate no forbidden fields
assertNoForbiddenFields(data, 'context');

// Throws error if price/offer/currency detected
```

## Testing

Run automated tests:

```bash
bash scripts/test-winesearcher-no-price.sh
```

Expected output:
```
Passed: 12
Failed: 0

✅ ALL TESTS PASSED - NO PRICE DATA POLICY ENFORCED
```

## Examples

See comprehensive examples in:
- `docs/WINE_CHECK_USAGE_EXAMPLES.md`

Examples include:
- Quote/Offer line items
- CSV import validation
- Product card integration
- Custom implementations with hook

## API Endpoint

**GET** `/api/enrich/wine-searcher/check`

Query params:
- `name` (required) - Wine name
- `vintage` (optional) - Vintage year

Headers:
- `x-tenant-id` (required) - Tenant context

Response:
```json
{
  "data": {
    "canonical_name": "Château Margaux",
    "producer": "Château Margaux",
    "region": "Bordeaux",
    "appellation": "Margaux",
    "match_score": 98,
    "match_status": "EXACT",
    "candidates": []
  },
  "mock": false
}
```

## Migration from Old Component

Old import:
```tsx
import { WineCheckPanel } from '../components/WineCheckPanel';
```

New import:
```tsx
import { WineCheckPanel } from '@/app/components/wine-check';
```

No other changes needed for standalone mode.

## Support

For issues or questions:
1. Check this README
2. Review usage examples: `docs/WINE_CHECK_USAGE_EXAMPLES.md`
3. Run test suite to verify integration
4. Check main docs: `docs/WINESEARCHER_INTEGRATION.md`

## License

Internal use only - Winefeed project.
