# Wine Check - Usage Examples

## Overview

Wine Check är nu en fullt återanvändbar modul som kan användas i olika delar av applikationen. Den stödjer två lägen:

1. **Standalone mode** - Användaren matar in vinnamn manuellt
2. **Controlled mode** - Prefillda inputs med callback för att välja kandidater

---

## Installation / Import

```typescript
// Import från modulen
import {
  WineCheckPanel,
  useWineCheck,
  WineCheckForm,
  WineCheckResult,
  WineCheckCandidates
} from '@/app/components/wine-check';

// Import types
import type {
  WineCheckCandidate,
  WineCheckResultType,
  MatchStatus
} from '@/app/components/wine-check';
```

---

## Example 1: Standalone Mode (Current Implementation)

**Use Case:** Import Case detail page - verktyg för manuell vinvalidering

```tsx
import { WineCheckPanel } from '@/app/components/wine-check';

function ImportCaseTools() {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        VERKTYG / DATAKVALITET
      </h3>
      <WineCheckPanel
        mode="standalone"
        title="Wine Check"
        description="Verifiera och normalisera ett vin-namn."
      />
    </div>
  );
}
```

**Features:**
- User manually inputs wine name and vintage
- Shows result with match status and candidates
- "Rensa och sök igen" button to reset

---

## Example 2: Controlled Mode - Quote/Offer Line Item

**Use Case:** Offertflöde - validera och normalisera viner i offertrad

```tsx
import { useState } from 'react';
import { WineCheckPanel, WineCheckCandidate } from '@/app/components/wine-check';

interface LineItem {
  id: string;
  name: string;
  vintage?: number;
  canonical_name?: string;
  producer?: string;
  region?: string;
}

function OfferLineItemEditor({ lineItem, onUpdate }: {
  lineItem: LineItem;
  onUpdate: (updates: Partial<LineItem>) => void;
}) {
  const [showWineCheck, setShowWineCheck] = useState(false);

  const handleSelectCandidate = (candidate: WineCheckCandidate) => {
    // Update line item with normalized wine data
    onUpdate({
      canonical_name: candidate.name,
      producer: candidate.producer,
      region: candidate.region || candidate.appellation
    });

    // Close wine check panel
    setShowWineCheck(false);
  };

  return (
    <div className="space-y-4">
      {/* Line Item Display */}
      <div className="p-4 border rounded-lg">
        <h4 className="font-semibold">{lineItem.canonical_name || lineItem.name}</h4>
        {lineItem.producer && <p className="text-sm text-muted-foreground">{lineItem.producer}</p>}
        {lineItem.region && <p className="text-xs text-muted-foreground">{lineItem.region}</p>}

        <button
          onClick={() => setShowWineCheck(!showWineCheck)}
          className="text-sm text-primary hover:underline mt-2"
        >
          Verifiera med Wine-Searcher
        </button>
      </div>

      {/* Wine Check (Controlled Mode) */}
      {showWineCheck && (
        <WineCheckPanel
          mode="controlled"
          initialName={lineItem.name}
          initialVintage={lineItem.vintage?.toString()}
          onSelectCandidate={handleSelectCandidate}
          title="Verifiera vinnamn"
          description="Välj korrekt vin från kandidaterna nedan."
        />
      )}
    </div>
  );
}
```

**Features:**
- Pre-filled with line item data
- User can check and select correct candidate
- Callback updates parent component
- Can be shown/hidden as modal or inline

---

## Example 3: Controlled Mode - CSV Import Row

**Use Case:** CSV-import - validera och normalisera viner innan import

```tsx
import { WineCheckPanel, WineCheckCandidate } from '@/app/components/wine-check';

interface CSVRow {
  id: string;
  raw_name: string;
  vintage?: string;
  validated: boolean;
  canonical_name?: string;
  producer?: string;
  match_score?: number;
}

function CSVRowValidator({ row, onValidate }: {
  row: CSVRow;
  onValidate: (rowId: string, data: Partial<CSVRow>) => void;
}) {
  const handleSelectCandidate = (candidate: WineCheckCandidate) => {
    onValidate(row.id, {
      validated: true,
      canonical_name: candidate.name,
      producer: candidate.producer,
      match_score: candidate.score
    });
  };

  return (
    <div className="border-l-4 border-yellow-400 p-3 bg-yellow-50">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm">{row.raw_name}</p>
        {row.validated ? (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
            ✓ Validerad
          </span>
        ) : (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
            Ej validerad
          </span>
        )}
      </div>

      {!row.validated && (
        <WineCheckPanel
          mode="controlled"
          initialName={row.raw_name}
          initialVintage={row.vintage}
          onSelectCandidate={handleSelectCandidate}
          title="Validera CSV-rad"
          compact={true}
          hideVintage={!row.vintage}
        />
      )}

      {row.validated && (
        <div className="text-sm text-muted-foreground mt-2">
          <p>Normaliserat: {row.canonical_name}</p>
          <p>Producent: {row.producer}</p>
          <p>Match: {row.match_score}/100</p>
        </div>
      )}
    </div>
  );
}
```

**Features:**
- Compact mode for list views
- Hide vintage if not available
- Visual feedback on validation status
- Batch processing support

---

## Example 4: Using the Hook Directly

**Use Case:** Custom UI implementation with full control

```tsx
import { useWineCheck } from '@/app/components/wine-check';

function CustomWineValidator() {
  const {
    name,
    vintage,
    loading,
    error,
    result,
    mock,
    setName,
    setVintage,
    runCheck,
    reset
  } = useWineCheck({
    onSuccess: (result, isMock) => {
      console.log('Wine check success:', result);
      if (isMock) {
        console.warn('Using mock data');
      }
    },
    onError: (errorMessage) => {
      console.error('Wine check failed:', errorMessage);
    }
  });

  return (
    <div>
      {/* Custom UI using hook state */}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Wine name"
      />

      <button onClick={() => runCheck()} disabled={loading}>
        {loading ? 'Checking...' : 'Check Wine'}
      </button>

      {error && <div className="error">{error}</div>}

      {result && (
        <div>
          <h4>{result.canonical_name}</h4>
          <p>Producer: {result.producer}</p>
          <p>Status: {result.match_status}</p>
          <p>Score: {result.match_score}/100</p>
        </div>
      )}

      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

---

## Example 5: Product Card Integration

**Use Case:** Produktkort med inline Wine Check

```tsx
import { useState } from 'react';
import { WineCheckPanel, WineCheckCandidate } from '@/app/components/wine-check';

interface Product {
  id: string;
  name: string;
  vintage?: number;
  verified: boolean;
  canonical_name?: string;
  producer?: string;
}

function ProductCard({ product, onUpdate }: {
  product: Product;
  onUpdate: (updates: Partial<Product>) => void;
}) {
  const [showVerify, setShowVerify] = useState(false);

  const handleVerify = (candidate: WineCheckCandidate) => {
    onUpdate({
      verified: true,
      canonical_name: candidate.name,
      producer: candidate.producer
    });
    setShowVerify(false);
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold">{product.canonical_name || product.name}</h3>
          {product.producer && <p className="text-sm text-gray-600">{product.producer}</p>}
        </div>
        {product.verified ? (
          <span className="text-green-600 text-xs">✓ Verified</span>
        ) : (
          <button
            onClick={() => setShowVerify(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Verify
          </button>
        )}
      </div>

      {showVerify && (
        <div className="mt-4">
          <WineCheckPanel
            mode="controlled"
            initialName={product.name}
            initialVintage={product.vintage?.toString()}
            onSelectCandidate={handleVerify}
            compact={true}
          />
          <button
            onClick={() => setShowVerify(false)}
            className="text-xs text-gray-600 mt-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Component API Reference

### WineCheckPanel Props

```typescript
interface WineCheckPanelProps {
  // Mode
  mode?: 'standalone' | 'controlled';

  // Controlled mode props
  initialName?: string;
  initialVintage?: string;
  onSelectCandidate?: (candidate: WineCheckCandidate) => void;

  // UI customization
  title?: string;
  description?: string;
  compact?: boolean;       // Smaller spacing
  hideVintage?: boolean;   // Hide vintage input

  // Tenant context
  tenantId?: string;       // Optional, defaults to hardcoded
}
```

### useWineCheck Hook

```typescript
function useWineCheck(options?: {
  tenantId?: string;
  onSuccess?: (result: WineCheckResult, mock: boolean) => void;
  onError?: (error: string) => void;
}): {
  // State
  name: string;
  vintage: string;
  loading: boolean;
  error: string | null;
  result: WineCheckResult | null;
  mock: boolean;

  // Actions
  setName: (name: string) => void;
  setVintage: (vintage: string) => void;
  runCheck: (input?: WineCheckInput) => Promise<void>;
  reset: () => void;
}
```

---

## Security Guarantees

✅ **NO PRICE DATA** - All components enforce allowlist-only fields
✅ **Type-safe** - TypeScript types prevent price fields at compile time
✅ **Runtime validation** - `assertNoForbiddenFields()` checks responses
✅ **Client-side guards** - Multiple layers of security checks

---

## Testing

Run Wine Check tests:
```bash
bash scripts/test-winesearcher-no-price.sh
```

All tests should pass:
```
Passed: 12
Failed: 0

✅ ALL TESTS PASSED - NO PRICE DATA POLICY ENFORCED
```

---

## Future Enhancements

- [ ] Bulk wine check (multiple wines at once)
- [ ] Wine image URLs (if available from API)
- [ ] Manual override (user can edit canonical name)
- [ ] Confidence threshold settings
- [ ] Integration with wine database

---

## Support

For questions or issues with Wine Check module:
- Check this documentation
- Review component source: `app/components/wine-check/`
- Run test suite: `bash scripts/test-winesearcher-no-price.sh`
- See main Wine-Searcher docs: `docs/WINESEARCHER_INTEGRATION.md`
