## Product Matching Strategy

## Quick Start: Verify MVP

**Want to quickly verify matching is working?** Run:

```bash
npm run test:matching:mvp
```

This automated runner tests all matching branches, checks health metrics, and gives you a clear PASS/WARN/FAIL verdict.

For detailed monitoring, visit: `/match/status`

---

## Overview

Winefeed uses a hierarchical product matching engine to map incoming products (from supplier CSVs, offers, import cases) to internal wine entities.

**Core Principle:** Identifiers win over text. The matching engine prioritizes strong identifiers (GTIN, LWIN, SKUs) before falling back to text-based matching via Wine-Searcher canonicalization.

**Security Policy:** NO PRICE DATA is ever included in match results. All responses are validated against a forbidden field pattern.

## Entity Model

### wine_masters (Wine Identity)
Represents the "Platonic ideal" of a wine - its core identity, independent of vintage or bottle size.

**Example:**
- "Château Margaux" from Bordeaux

**Linked Identifier:** LWIN (Liv-ex Wine Identification Number)

### wine_skus (Sellable Variant)
Represents a specific, orderable product with vintage, bottle size, and packaging.

**Example:**
- "Château Margaux 2015, 750ml bottle"

**Linked Identifier:** GTIN (Global Trade Item Number / barcode)

**Relationship:** wine_sku belongs to ONE wine_master

## Identifier Types

### 1. GTIN (Strongest)
- **Type:** Global Trade Item Number (barcode)
- **Maps to:** wine_sku
- **Confidence:** 1.0 (100%)
- **Status:** AUTO_MATCH
- **Use case:** Barcode scanning, supplier catalog imports

### 2. LWIN (Strong)
- **Type:** Liv-ex Wine Identification Number
- **Maps to:** wine_master (or wine_sku if vintage/bottle known)
- **Confidence:** 1.0 (100%)
- **Status:** AUTO_MATCH
- **Use case:** Wine industry standard identifier

### 3. PRODUCER_SKU (Medium)
- **Type:** Producer's internal SKU code
- **Maps to:** wine_sku or wine_master
- **Requires:** producer_id for scoping
- **Confidence:** 0.95 (95%)
- **Status:** AUTO_MATCH_WITH_GUARDS
- **Use case:** Direct producer imports

### 4. IMPORTER_SKU (Medium)
- **Type:** Importer's internal SKU code
- **Maps to:** wine_sku or wine_master
- **Requires:** importer_id for scoping
- **Confidence:** 0.9 (90%)
- **Status:** AUTO_MATCH_WITH_GUARDS
- **Use case:** Importer catalog matching

### 5. WS_ID (Weak, Reference Only)
- **Type:** Wine-Searcher internal ID
- **Maps to:** wine_master
- **Confidence:** Variable (0.5-0.9)
- **Status:** Reference only, not used for auto-matching
- **Use case:** Enrichment metadata

## Matching Hierarchy

The matching engine executes in strict order, returning at the first successful match:

```
1. GTIN exact → AUTO_MATCH (wine_sku)
   └─ If not found + auto-create enabled → CREATE wine_master + wine_sku + identifier
   ↓
2. LWIN exact → AUTO_MATCH (wine_master → wine_sku if vintage/bottle known)
   └─ If not found + auto-create enabled → CREATE wine_master + identifier (+ optional wine_sku)
   ↓
3. Producer SKU exact (requires producer_id) → AUTO_MATCH_WITH_GUARDS
   ↓
4. Importer SKU exact (requires importer_id) → AUTO_MATCH_WITH_GUARDS
   ↓
5. Wine-Searcher canonical (text fallback) → SUGGESTED (needs review)
   └─ NEVER auto-creates (policy enforced)
   ↓
6. NO_MATCH → PENDING_REVIEW
```

### Auto-Create Policy

**When Enabled:** Set `MATCHING_ENABLE_AUTO_CREATE=true` in environment (default: true)

**Rules:**
- ✅ **ALLOWED:** Auto-create ONLY for deterministic identifiers (GTIN, LWIN)
- ❌ **FORBIDDEN:** Auto-create NEVER happens for canonical/text-fallback matches
- 🔒 **Idempotent:** Always checks if identifier exists before creating
- 📝 **Minimal Data:** Creates only essential fields from textFallback
- 📋 **Logged:** All creations logged in match_results.explanation + product_identifiers.source

**Rationale:**
Build catalog "by evidence" - create entities only when we have a hard key (GTIN/LWIN). Avoid duplicates and low-quality entries from fuzzy text matching.

## Match Status

### AUTO_MATCH
- **Confidence:** 1.0 (100%)
- **Methods:** GTIN_EXACT, LWIN_EXACT
- **Action:** Automatically accepted, no review required
- **Color:** Green

### AUTO_MATCH_WITH_GUARDS
- **Confidence:** 0.90-0.95
- **Methods:** SKU_EXACT, CANONICAL_SUGGEST (if very strong)
- **Action:** Automatically accepted with validation
- **Guardrails:**
  - Scoped by issuer (producer_id or importer_id)
  - Logged for audit
- **Color:** Blue

### SUGGESTED
- **Confidence:** 0.50-0.89
- **Methods:** CANONICAL_SUGGEST
- **Action:** Needs manual review
- **Use case:** Text-based Wine-Searcher matches
- **Color:** Yellow

### CONFIRMED
- **Confidence:** Variable
- **Action:** User manually confirmed a suggested match
- **Color:** Green

### REJECTED
- **Confidence:** N/A
- **Action:** User manually rejected a match
- **Color:** Red

### PENDING_REVIEW
- **Confidence:** 0.0-0.49
- **Methods:** NO_MATCH
- **Action:** No automatic suggestion, needs manual intervention
- **Color:** Gray

## Text-Based Fallback (Wine-Searcher)

When no identifier match is found, the engine uses Wine-Searcher canonicalization:

1. **Call Wine-Searcher API** with name + vintage
2. **Get canonical data** (canonical_name, producer, region, appellation)
3. **Build signature** from canonical data + vintage + bottle_ml
4. **Search internal DB** for wine_master with similar signature
5. **Calculate confidence** based on:
   - Exact name match: +0.3
   - Partial name match: +0.15
   - Exact producer match: +0.2
   - Partial producer match: +0.1
   - Region match: +0.1
6. **Return result:**
   - Confidence ≥ 0.9 → AUTO_MATCH_WITH_GUARDS
   - Confidence 0.5-0.89 → SUGGESTED (with candidates)
   - Confidence < 0.5 → PENDING_REVIEW

## Audit Trail

All match attempts are logged to `match_results` table:

```sql
CREATE TABLE match_results (
  id uuid,
  tenant_id uuid,
  source_type text,        -- 'supplier_import_row' | 'offer_line' | 'importcase_line'
  source_id uuid,
  matched_entity_type text, -- 'wine_sku' | 'wine_master'
  matched_entity_id uuid,
  match_method text,       -- 'GTIN_EXACT' | 'LWIN_EXACT' | 'SKU_EXACT' | 'CANONICAL_SUGGEST'
  confidence numeric,      -- 0-1
  status text,            -- 'AUTO_MATCH' | 'SUGGESTED' | 'CONFIRMED' | 'REJECTED'
  explanation text,
  candidates jsonb,       -- Top 5 alternatives
  created_at timestamptz
);
```

**Benefits:**
- Debug: Trace why a match was made
- Quality control: Review low-confidence matches
- Analytics: Understand matching patterns
- Compliance: Full traceability

## API Usage

### POST /api/match/product

**Request:**

```json
{
  "source": {
    "source_type": "supplier_import_row",
    "source_id": "uuid"
  },
  "identifiers": {
    "gtin": "7350000000000",
    "lwin": "1014265",
    "producer_sku": "SKU-123",
    "producer_id": "uuid",
    "importer_sku": "IMP-456",
    "importer_id": "uuid",
    "ws_id": "12345"
  },
  "textFallback": {
    "name": "Château Margaux",
    "vintage": 2015,
    "bottle_ml": 750,
    "producer": "Château Margaux",
    "region": "Bordeaux",
    "appellation": "Margaux"
  }
}
```

**Response:**

```json
{
  "status": "AUTO_MATCH",
  "confidence": 1.0,
  "match_method": "GTIN_EXACT",
  "matched_entity_type": "wine_sku",
  "matched_entity_id": "uuid",
  "explanation": "Exact GTIN match: 7350000000000",
  "candidates": []
}
```

**Headers:**
- `x-tenant-id`: Required (tenant context)

**Security:**
- NO PRICE DATA in response
- Validated against forbidden pattern: `/price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP/i`

**Auto-Create Behavior:**
- If `MATCHING_ENABLE_AUTO_CREATE=true` and identifier not found:
  - GTIN: Creates wine_master + wine_sku + identifier
  - LWIN: Creates wine_master + identifier (+ optional wine_sku if vintage/bottle_ml provided)
- Returns status `AUTO_MATCH_WITH_GUARDS` with explanation noting auto-creation
- All text fallback data is used to populate new entities

## UI Components

### MatchStatusBadge

Visual indicator of match status and confidence.

```typescript
import { MatchStatusBadge } from '@/app/components/match/MatchStatusBadge';

<MatchStatusBadge status="AUTO_MATCH" confidence={1.0} />
```

**Displays:**
- Icon (✓ / ? / ✕)
- Status label (Swedish)
- Confidence percentage

### MatchPanel

Detailed view with explanation and candidates.

```typescript
import { MatchPanel } from '@/app/components/match/MatchPanel';

<MatchPanel
  result={matchResult}
  onConfirm={(candidateId) => { ... }}
  onReject={() => { ... }}
  showActions={true}
/>
```

**Shows:**
- Status badge
- Explanation text
- Match method and entity details
- Alternative candidates (max 5)
- Confirm/Reject actions (optional)

## Demo Page

Test the matching engine: `/match-demo`

**Features:**
- Test all identifier types
- Text fallback testing
- Real-time match results
- Candidate display

## Health Dashboard

Monitor matching service health: `/match/status`

**Purpose:**
Single source of truth for "Is matching working in MVP?" with clear PASS/WARN/FAIL indicators.

**Features:**
- **Overall State:** PASS/WARN/FAIL/INSUFFICIENT_DATA with visual indicators
- **KPI Metrics:** Total matches, auto-match rate, suggested rate, avg confidence
- **Identifier Coverage:** GTIN/LWIN/SKU/TEXT breakdown with percentages
- **DB Health:** Read/write checks (write test only in dev, read-only in prod)
- **Configuration:** Auto-create status, Wine-Searcher mode, cache settings
- **Warnings:** Automatically generated based on thresholds
- **Recommendations:** Concrete next steps to improve matching
- **Recent Matches:** Debug view of last 20 match results (toggle)

**API Endpoint:**
```bash
GET /api/match/status
Headers:
  x-tenant-id: <tenant-uuid>

Response:
{
  "timestamp": "2026-01-17T10:00:00Z",
  "tenant_id": "uuid",
  "config": {...},
  "dbHealth": { "canRead": true, "canWrite": "SKIPPED_PROD_READONLY" },
  "summary": {
    "window": "7d",
    "totalMatches": 150,
    "autoMatchRate": 0.45,
    "suggestedRate": 0.35,
    "avgConfidence": 0.82,
    "avgConfidenceAuto": 0.95,
    "identifierCoverage": {...},
    "overall_state": "PASS"
  },
  "warnings": [...],
  "recommendations": [...],
  "recent": [...]
}
```

**Thresholds:**
- **minDataThreshold:** 10 matches (minimum for evaluation)
- **targetAutoMatchRate:** 30% (goal for deterministic matches)
- **maxSuggestedRate:** 60% (warning if too many manual reviews)
- **minAvgConfidenceAuto:** 75% (minimum confidence for auto-matches)
- **maxAutoCreateRate:** 50% (warning if creating too many entities)
- **maxTextCoverageRate:** 70% (warning if too reliant on text fallback)

**Health States:**
- **PASS:** All metrics within acceptable ranges
- **WARN:** One or more metrics outside ideal range but system functional
- **FAIL:** Critical issues (low auto-match rate + high suggested rate)
- **INSUFFICIENT_DATA:** Less than 10 matches, need more data

**Security:**
- Read-only in production (no writes to match_results)
- Safe write test via match_health_pings table (dev only)
- Tenant isolation enforced
- No forbidden fields (price/offer/currency) in output

## Integration Examples

### Supplier Import CSV

```typescript
import { matchService } from '@/lib/match-service';

async function processSupplierRow(row: CSVRow, tenantId: string, supplierId: string) {
  const result = await matchService.matchProduct({
    tenantId,
    source: {
      source_type: 'supplier_import_row',
      source_id: row.id
    },
    identifiers: {
      gtin: row.barcode,
      producer_sku: row.sku,
      producer_id: supplierId
    },
    textFallback: {
      name: row.wine_name,
      vintage: row.vintage,
      bottle_ml: 750
    }
  });

  if (result.status === 'AUTO_MATCH') {
    // Link to wine_sku
    await linkToWineSku(row.id, result.matched_entity_id);
  } else if (result.status === 'SUGGESTED') {
    // Flag for review
    await flagForReview(row.id, result);
  }
}
```

### Offer Line Item

```typescript
import { matchService } from '@/lib/match-service';

async function enrichOfferLine(line: OfferLine, tenantId: string) {
  const result = await matchService.matchProduct({
    tenantId,
    source: {
      source_type: 'offer_line',
      source_id: line.id
    },
    identifiers: {
      lwin: line.lwin
    },
    textFallback: {
      name: line.name,
      vintage: line.vintage
    }
  });

  return result;
}
```

## Best Practices

1. **Always provide identifiers first**
   - GTIN and LWIN are strongest
   - Producer/Importer SKUs require issuer IDs

2. **Include text fallback**
   - Even when identifiers exist
   - Enables validation and debugging
   - Powers auto-create with minimal data when enabled

3. **Review suggested matches**
   - Status SUGGESTED requires manual review
   - Check candidates before confirming

4. **Monitor match_results**
   - Track confidence distribution
   - Identify data quality issues
   - Optimize matching rules

5. **Never bypass security**
   - NO PRICE DATA policy is enforced
   - All responses are validated

6. **Understand auto-create behavior**
   - Enabled by default (`MATCHING_ENABLE_AUTO_CREATE=true`)
   - Only creates for GTIN and LWIN (never for text/canonical)
   - Idempotent - checks for existing identifier first
   - Creates minimal masterdata from textFallback
   - All creations logged in match_results and product_identifiers

## Maintenance

### Configuration

**Auto-Create Feature:**

Environment variable: `MATCHING_ENABLE_AUTO_CREATE`
- **Default:** `true` (enabled)
- **To disable:** Set to `false` in `.env.local`

```bash
# Enable auto-creation of wine_masters/wine_skus for hard identifiers (GTIN, LWIN)
# NEVER auto-creates for text/canonical matches (policy)
MATCHING_ENABLE_AUTO_CREATE=true
```

**When to disable:**
- Production environments where catalog should be manually curated
- Testing scenarios where you want to verify identifier coverage
- Environments where all products should be pre-imported

### Adding New Identifiers

1. Add identifier type to `product_identifiers.id_type` enum
2. Update `matchService` with new matching method
3. Add tests for new identifier type
4. Document in this guide

### Tuning Confidence Thresholds

Current thresholds:
- AUTO_MATCH: 1.0 (GTIN, LWIN)
- AUTO_MATCH_WITH_GUARDS: 0.90-0.95 (SKUs, strong canonical)
- SUGGESTED: 0.50-0.89 (canonical)
- PENDING_REVIEW: < 0.50 (no match)

To adjust:
1. Analyze `match_results` confidence distribution
2. Identify false positives/negatives
3. Update thresholds in `lib/match-service.ts`
4. Test thoroughly

## Troubleshooting

### No Match Found

**Symptoms:** All identifiers return NO_MATCH

**Check:**
1. Verify identifiers exist in `product_identifiers` table
2. Check tenant_id isolation
3. Verify issuer_id for scoped SKUs
4. Test text fallback independently

### Low Confidence Canonical Matches

**Symptoms:** Wine-Searcher returns matches but confidence < 0.5

**Solutions:**
1. Improve input data quality (complete names, correct spelling)
2. Add producer/region data for better matching
3. Register identifiers for frequently matched wines

### Duplicate Matches

**Symptoms:** Multiple wine_masters match same canonical name

**Solutions:**
1. Review wine_masters for duplicates
2. Consolidate duplicate entries
3. Add unique constraints on canonical_name + producer

### Auto-Create Not Working

**Symptoms:** GTIN/LWIN returns NO_MATCH instead of creating entity

**Check:**
1. Verify `MATCHING_ENABLE_AUTO_CREATE=true` in environment
2. Check textFallback data is provided (used for minimal entity creation)
3. Review logs for creation errors
4. Verify database permissions for inserts on wine_masters/wine_skus/product_identifiers

### Unwanted Auto-Creates

**Symptoms:** Too many entities being auto-created

**Solutions:**
1. Set `MATCHING_ENABLE_AUTO_CREATE=false` to disable feature
2. Review match_results where explanation contains "auto-create"
3. Pre-import known products to avoid auto-creation
4. Add validation rules in textFallback processing

## Support

For questions or issues:
- Check this documentation
- Review `lib/match-service.ts` implementation
- Test with `/match-demo` page
- Check `match_results` table for audit trail

## Verifying MVP Health

### Quick Health Check

Visit `/match/status` dashboard to see overall matching health.

**What to Look For:**
- **PASS state:** Green banner, all metrics within targets
- **WARN state:** Yellow banner with specific warnings and recommendations
- **FAIL state:** Red banner, critical issues requiring immediate attention
- **INSUFFICIENT_DATA:** Gray banner, need more matching operations

### Automated MVP Verification

**Recommended:** Run the automated MVP verification runner to test the entire matching pipeline.

```bash
# Run automated tests + health check (requires dev server running)
npm run test:matching:mvp

# Or directly:
bash scripts/matching-mvp-verify.sh

# Custom configuration:
BASE_URL=http://localhost:3000 TENANT_ID=your-tenant-id \
  bash scripts/matching-mvp-verify.sh
```

**What it does:**
1. Runs 5 golden path tests covering all matching branches:
   - TEXT fallback (Wine-Searcher canonical)
   - GTIN hard key (auto-create test)
   - LWIN hard key (auto-create test)
   - SKU guard test (verifies issuer_id requirement)
   - Empty identifiers (text fallback)
2. Fetches health status from `/api/match/status`
3. Verifies security (no forbidden fields in output)
4. Prints comprehensive report with:
   - Overall state (PASS/WARN/FAIL/INSUFFICIENT_DATA)
   - Key metrics and thresholds
   - Identifier coverage
   - Top 5 recent matches
   - Warnings and recommendations
5. Exit codes:
   - `0` for PASS, WARN, INSUFFICIENT_DATA
   - `1` for FAIL or security violations

**Example output:**
```
════════════════════════════════════════════════════════════════
  MATCHING MVP VERIFICATION RUNNER
════════════════════════════════════════════════════════════════

PART 1: GOLDEN PATH TESTS
✓ Test 1: TEXT Fallback - PASS
✓ Test 2: GTIN Hard Key - PASS
✓ Test 3: LWIN Hard Key - PASS
✓ Test 4: SKU Guard Test - PASS
✓ Test 5: Empty Identifiers - PASS

PART 2: HEALTH CHECK
✓ Security Check: No forbidden fields detected

HEALTH REPORT
Overall State: ✓ PASS
Total Matches: 25
Auto Match Rate: 60% (target: ≥30%)
Suggested Rate: 20% (max: 60%)

FINAL VERDICT
MVP MATCHING: ✅ PASS
```

### CLI Health Check

```bash
# Quick status check
curl -H "x-tenant-id: YOUR_TENANT_ID" \
  http://localhost:3000/api/match/status | jq '.summary.overall_state'

# Full report
curl -H "x-tenant-id: YOUR_TENANT_ID" \
  http://localhost:3000/api/match/status | jq
```

### Key Metrics to Monitor

1. **Auto Match Rate** (target: ≥30%)
   - Percentage of matches using GTIN/LWIN/SKU
   - Low rate = need more identifiers in source data

2. **Suggested Rate** (max: 60%)
   - Percentage requiring manual review
   - High rate = too much text fallback matching

3. **Text Coverage** (max: 70%)
   - Percentage using canonical/text fallback
   - High coverage = missing identifiers in input

4. **Avg Confidence (Auto)** (min: 75%)
   - Average confidence for auto-matches
   - Low confidence = data quality issues

5. **Auto-Create Rate** (max: 50%)
   - Percentage creating new entities
   - High rate = catalog gaps or missing pre-import

### Recommendations by State

**If PASS:**
- Continue current practices
- Monitor trends over time
- Document successful patterns

**If WARN:**
- Review specific warnings in dashboard
- Implement recommendations in priority order
- Re-check after improvements

**If FAIL:**
- Critical: Add GTIN/LWIN identifiers to source data
- Work with suppliers to get barcodes or SKUs
- Consider disabling auto-create until data quality improves
- Pre-import wine catalog from trusted sources

**If INSUFFICIENT_DATA:**
- Run matching operations (supplier imports, offers)
- Test with `/match-demo` page
- Generate test data for development
- Run `npm run test:matching:mvp` to generate golden path test data

### Regular Monitoring

**Daily (Development):**
- Check overall state on `/match/status`
- Review any new warnings

**Weekly (Production):**
- Export metrics from API
- Track identifier coverage trends
- Review auto-create rate
- Audit recent matches for quality

**Monthly:**
- Analyze match_results patterns
- Adjust thresholds if needed
- Document learnings
- Update matching strategy based on real-world usage

---

**License:** Internal use only - Winefeed project
