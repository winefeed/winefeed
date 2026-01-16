# Wine-Searcher Integration - Wine Check MVP

## Overview

This integration implements Wine-Searcher's **Wine Check** endpoint (`/x`) for wine normalization and verification.

### CRITICAL POLICY

**NO PRICE DATA** - This implementation is strictly limited to:
- ✅ Wine name normalization
- ✅ Producer verification
- ✅ Region/appellation identification
- ✅ Match confidence scoring
- ❌ **NO** price data
- ❌ **NO** market price endpoint (`/a`)
- ❌ **NO** offer/currency data

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT (UI)                                                 │
│ - WineSearcherCheck.tsx                                     │
│ - ONLY receives allowlist fields                           │
│ - NEVER sees API key                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ GET /api/enrich/wine-searcher/check
                       │ ?name=...&vintage=...
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ API ROUTE                                                   │
│ - app/api/enrich/wine-searcher/check/route.ts              │
│ - Validates tenant context                                 │
│ - Security checks (no price data)                          │
│ - Returns ONLY allowlist fields                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ SERVICE LAYER                                               │
│ - lib/winesearcher-service.ts                              │
│ - Checks cache first (wine_enrichment table)              │
│ - Calls Wine-Searcher API if cache miss                   │
│ - Strips all non-allowlist fields                         │
│ - Caches result with TTL                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ WINE-SEARCHER API                                           │
│ - api.wine-searcher.com/x                                  │
│ - API key in header (never exposed to client)             │
│ - Returns full response (including prices - STRIPPED!)    │
└─────────────────────────────────────────────────────────────┘
```

## Files Created

### 1. Database Schema
- **File:** `supabase/migrations/20260115_create_wine_enrichment_table.sql`
- **Purpose:** Cache Wine-Searcher results with 7-day TTL
- **Key Features:**
  - Tenant isolation via RLS
  - Unique cache key: `(tenant_id, query_name, query_vintage)`
  - `match_status` enum: EXACT | FUZZY | MULTIPLE | NOT_FOUND | ERROR
  - `candidates` JSONB array (max 3 candidates)
  - `raw_response` JSONB (DEV ONLY - never sent to client)

### 2. Service Layer
- **File:** `lib/winesearcher-service.ts`
- **Exports:** `wineSearcherService.checkWine()`
- **Key Features:**
  - Cache-first strategy (checks `wine_enrichment` table)
  - Allowlist filter (strips non-allowlist fields)
  - Security check (throws error if price data detected)
  - Mock data mode when API key not configured

### 3. API Route
- **File:** `app/api/enrich/wine-searcher/check/route.ts`
- **Method:** GET
- **Query Params:**
  - `name` (required) - Wine name
  - `vintage` (optional) - Vintage year
- **Headers:**
  - `x-tenant-id` (required) - Tenant context
- **Response:** ONLY allowlist fields (see below)

### 4. UI Component
- **File:** `app/imports/components/WineSearcherCheck.tsx`
- **Usage:**
  ```tsx
  <WineSearcherCheck
    wineName="Château Margaux"
    vintage="2015"
    onSelect={(result) => console.log(result)}
  />
  ```
- **Features:**
  - Loading state with spinner
  - Status badge (EXACT, FUZZY, MULTIPLE, NOT_FOUND, ERROR)
  - Match score display (0-100)
  - Candidates list (max 3)
  - Security check (client-side validation)

### 5. Test Suite
- **File:** `scripts/test-winesearcher-no-price.sh`
- **Purpose:** Guarantee NO PRICE DATA policy
- **Tests:**
  1. Basic wine check
  2. Allowlist keys only
  3. No price/offer/currency data
  4. Candidates structure (max 3, correct keys)
  5. Match status enum validation
  6. Cache hit on second request
  7. Error handling (missing parameters)
  8. Tenant isolation

## Allowlist Fields

**ONLY these fields are allowed in API responses:**

### Top-Level Fields
```typescript
{
  canonical_name: string | null,    // Normalized wine name
  producer: string | null,           // Producer/winery name
  region: string | null,             // Wine region
  appellation: string | null,        // Appellation (if available)
  match_score: number | null,        // 0-100 confidence score
  match_status: MatchStatus,         // EXACT | FUZZY | MULTIPLE | NOT_FOUND | ERROR
  candidates: WineCandidate[]        // Max 3 alternative matches
}
```

### Candidate Fields (max 3 candidates)
```typescript
{
  name: string,              // Wine name
  producer: string,          // Producer name
  region?: string,           // Region (optional)
  appellation?: string,      // Appellation (optional)
  score: number             // Match score (0-100)
}
```

## Environment Variables

Add to `.env.local`:

```bash
# Wine-Searcher API (Wine Check only - NO PRICE DATA)
# Get your API key from: https://www.wine-searcher.com/api
WINESEARCHER_API_KEY=your_winesearcher_api_key_here
WINESEARCHER_CACHE_TTL_DAYS=7
```

## Setup Instructions

### 1. Run Migration

Option A: Using Supabase SQL Editor (recommended):
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260115_create_wine_enrichment_table.sql`
3. Run the SQL

Option B: Using Supabase CLI:
```bash
npx supabase migration up
```

### 2. Configure API Key

1. Get API key from Wine-Searcher: https://www.wine-searcher.com/api
2. Add to `.env.local`:
   ```bash
   WINESEARCHER_API_KEY=your_actual_api_key_here
   ```
3. Restart dev server

### 3. Run Tests

```bash
# Start dev server
npm run dev

# Run test suite
bash scripts/test-winesearcher-no-price.sh
```

Expected output:
```
════════════════════════════════════════════════════════════
Wine-Searcher Integration Test - NO PRICE DATA Policy
════════════════════════════════════════════════════════════

Test 1: Basic Wine Check
─────────────────────────────────────────────────────────────
✓ PASS - Valid JSON response

Test 2: Response Contains ONLY Allowlist Keys
─────────────────────────────────────────────────────────────
✓ PASS - Only allowlist keys present

Test 3: NO Price/Offer/Currency Data in Response
─────────────────────────────────────────────────────────────
✓ PASS - No forbidden price data detected

...

════════════════════════════════════════════════════════════
Test Summary
════════════════════════════════════════════════════════════
Passed: 10
Failed: 0

✅ ALL TESTS PASSED - NO PRICE DATA POLICY ENFORCED
```

## Usage Examples

### API Route Usage

```typescript
// GET /api/enrich/wine-searcher/check
const response = await fetch(
  '/api/enrich/wine-searcher/check?name=Château Margaux&vintage=2015',
  {
    headers: {
      'x-tenant-id': tenantId
    }
  }
);

const result = await response.json();

console.log(result);
// {
//   canonical_name: "Château Margaux",
//   producer: "Château Margaux",
//   region: "Bordeaux",
//   appellation: "Margaux",
//   match_score: 98,
//   match_status: "EXACT",
//   candidates: []
// }
```

### React Component Usage

```tsx
import { WineSearcherCheck } from '@/app/imports/components/WineSearcherCheck';

function MyComponent() {
  return (
    <WineSearcherCheck
      wineName="Château Margaux"
      vintage="2015"
      onSelect={(result) => {
        console.log('Selected wine:', result.canonical_name);
        console.log('Producer:', result.producer);
        console.log('Match score:', result.match_score);
      }}
    />
  );
}
```

### Service Layer Usage

```typescript
import { wineSearcherService } from '@/lib/winesearcher-service';

const result = await wineSearcherService.checkWine({
  tenantId: '00000000-0000-0000-0000-000000000001',
  name: 'Château Margaux',
  vintage: '2015'
});

console.log(result.canonical_name);  // "Château Margaux"
console.log(result.producer);        // "Château Margaux"
console.log(result.match_status);    // "EXACT"
```

## Security Features

### 1. API Key Protection
- API key stored in `.env.local` (server-side only)
- NEVER exposed to client
- NEVER included in API responses

### 2. Allowlist Filter
- `serializeWineCheckResult()` strips all non-allowlist fields
- Throws `SECURITY_VIOLATION` error if price data detected
- Applied at service layer + API route layer

### 3. Response Validation
- Client-side: Validates no forbidden patterns (`/price|offer|currency/i`)
- Server-side: Validates only allowlist keys present
- Test suite: Automated checks on every request

### 4. Tenant Isolation
- RLS policies enforce tenant boundaries
- Cache key includes `tenant_id`
- API route requires `x-tenant-id` header

### 5. Cache Security
- `raw_response` stored in DB but NEVER sent to client
- Only allowlist fields returned from cache
- Expired entries cleaned up automatically

## Cache Strategy

### TTL (Time-To-Live)
- Default: 7 days
- Configurable via `WINESEARCHER_CACHE_TTL_DAYS`

### Cache Key
```
(tenant_id, query_name, query_vintage)
```

### Cache Hit Behavior
1. Check `wine_enrichment` table for matching entry
2. If found AND not expired → return cached result
3. If not found OR expired → fetch from API + cache result

### Cache Cleanup
Run manually or via cron:
```sql
SELECT cleanup_expired_wine_enrichment();
```

## Mock Mode (Development)

When `WINESEARCHER_API_KEY` is not configured or set to placeholder:
- Service returns mock data
- No actual API calls made
- Allows development without API key

Mock response:
```json
{
  "canonical_name": "Mock Wine Name",
  "producer": "Mock Producer",
  "region": "Mock Region",
  "appellation": null,
  "match_score": 85,
  "match_status": "FUZZY",
  "candidates": [
    {
      "name": "Mock Wine Name",
      "producer": "Mock Producer A",
      "region": "Mock Region A",
      "score": 90
    },
    {
      "name": "Mock Wine Name",
      "producer": "Mock Producer B",
      "region": "Mock Region B",
      "score": 80
    }
  ]
}
```

## Troubleshooting

### Issue: "Missing tenant context" (401)
**Solution:** Add `x-tenant-id` header to request

### Issue: "Missing required parameter: name" (400)
**Solution:** Add `name` query parameter

### Issue: "SECURITY_VIOLATION: Price data detected"
**Solution:** Contact developer - allowlist filter failed (critical bug)

### Issue: Mock data returned (in production)
**Solution:** Check `WINESEARCHER_API_KEY` is set correctly in `.env.local`

### Issue: Cache not working
**Solution:** Check `wine_enrichment` table exists (run migration)

### Issue: Test failures
**Solution:** Ensure dev server is running and `wine_enrichment` table exists

## Future Enhancements (Out of Scope for MVP)

- ❌ Market Price endpoint (`/a`) - **NOT IMPLEMENTED** per policy
- ✅ Bulk wine check (process multiple wines at once)
- ✅ Wine image URLs (if available from API)
- ✅ User feedback on match quality
- ✅ Manual override (user can correct matches)

## API Documentation

### Wine-Searcher API
- Official Docs: https://www.wine-searcher.com/api/docs
- Endpoint: `https://api.wine-searcher.com/x`
- Authentication: API key in query param `Xwapikey`

### Response Format (Estimated)
```json
{
  "results": [
    {
      "wine_name": "Château Margaux",
      "producer": "Château Margaux",
      "region": "Bordeaux",
      "appellation": "Margaux",
      "score": 98,
      "price": "REDACTED - NEVER EXPOSED",
      "currency": "REDACTED - NEVER EXPOSED"
    }
  ]
}
```

**Note:** Actual API response format may differ. Adjust `parseWineSearcherResponse()` in `lib/winesearcher-service.ts` accordingly.

## Support

For questions or issues:
1. Check this documentation
2. Run test suite: `bash scripts/test-winesearcher-no-price.sh`
3. Check logs: `console.log` statements prefixed with `[WineSearcher]`
4. Verify migration ran successfully
5. Confirm API key is valid

## Changelog

### 2026-01-15 - Initial Implementation
- ✅ Wine Check endpoint (`/x`) integration
- ✅ Allowlist filter (no price data)
- ✅ Cache with 7-day TTL
- ✅ React UI component
- ✅ Test suite with security checks
- ✅ Documentation
