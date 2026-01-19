# MATCHING_RULES.md — Winefeed Phase 1 (GTIN optional)

## Purpose
Define safe, buildable matching rules for Phase 1 so Winefeed can import supplier price lists and map lines to Winefeed Master Products with minimal manual work and minimal risk of "wrong bottle" errors.

Key principle: **Auto-match only when identity is highly certain.** Otherwise route to **Review Queue**.
GTIN is **preferred but optional**.

---

## Entities
- `MasterProduct` (vintage-specific): `wf_product_id`
- `ProductFamily` (vintage-agnostic): `wf_product_family_id`
- `Supplier line` includes: `supplier_sku`, `gtin_each?`, `gtin_case?`, `producer_name`, `product_name`, `vintage?`, `volume_ml`, `abv_percent?`, `pack_type`, `units_per_case?`, `country?`, `region?`

---

## Hard Guardrails (NO MATCH)
If any guardrail fails, matching MUST return `NO_MATCH` (send to Review Queue with reason).

1) **Volume mismatch**
   - Candidate `volume_ml` != input `volume_ml` → `NO_MATCH`

2) **Pack mismatch**
   - Candidate `pack_type` != input `pack_type` → `NO_MATCH`

3) **Units per case mismatch** (only if `pack_type=case`)
   - Candidate `units_per_case` != input `units_per_case` → `NO_MATCH`

4) **ABV mismatch beyond tolerance**
   - If both have ABV and `abs(candidate_abv - input_abv) > 0.5` → `NO_MATCH`

5) **Vintage rules**
   - If input has `vintage` and candidate has `vintage`:
     - If exact match → allowed
     - If not exact → NOT eligible for auto-match; see "Decision Thresholds" (review/sampling only)
   - If input missing `vintage`:
     - DO NOT match to a vintage-specific MasterProduct automatically.
     - Only match to `ProductFamily` or send to Review Queue (depending on confidence).

**Rationale:** Avoid wrong bottle/year/format, the most expensive class of errors.

---

## Scoring Model (0–100)
Compute `confidence_score` from signals. The score is used only after guardrails pass.

### A) Identifier Signals
- GTIN exact match (`gtin_each` or `gtin_case`) → +70
- Existing supplier SKU mapping (supplier_sku → wf_product_id) → +60

### B) Identity Signals (names)
- Producer normalized exact match → +15
- Producer fuzzy strong match (similarity ≥ 0.92) → +10
- Product/cuvée normalized exact match → +15
- Product/cuvée fuzzy strong match (similarity ≥ 0.90) → +10

### C) Attribute Signals
- Vintage exact match → +10
- Volume exact match → +10 (guardrail already blocks mismatches)
- ABV within tolerance (≤0.5) → +5
- Country + region match → +5
- Optional: grape/style overlap (if available) → +3

**Notes**
- If input vintage is missing: score should not get any vintage points and final decision should prefer matching to `ProductFamily`.
- Scores without GTIN typically land 60–85; that's intended to push uncertain cases to review.

---

## Decision Thresholds
After scoring, decide:

1) **AUTO_MATCH**
   - `confidence_score >= 90`
   - guardrails passed
   - AND if vintage is present → must be exact match
   - Outcome: create/confirm mapping & mark line as matched

2) **AUTO_MATCH_WITH_SAMPLING_REVIEW**
   - `confidence_score 80–89`
   - guardrails passed
   - vintage must be exact if present
   - Outcome: match automatically but flag `sampling_review=true` for periodic batch audit

3) **REVIEW_QUEUE**
   - `confidence_score 60–79`
   - OR any "vintage not exact" situation
   - Outcome: enqueue with top candidate suggestions + reasons

4) **NO_MATCH**
   - `confidence_score < 60`
   - OR guardrail failure
   - Outcome: enqueue with reason; likely "create new product" or request better data

---

## Vintage Policy (Phase 1)
- Auto-match requires **exact vintage** when vintage is provided.
- If candidate differs by ±1 year:
  - Do NOT auto-match. Send to Review Queue (or sampling review if you choose to allow later).
- ±2 years or more:
  - Always Review Queue (high risk).

---

## Review Queue Prioritization
Sort by:
1) highest `confidence_score` first (fast wins)
2) items with GTIN present but not found in mappings (fix mappings quickly)
3) risk flags (missing vintage, ambiguous producer, multiple close candidates)

---

## Required Output for Each Match Attempt
Return:
- `decision`: AUTO_MATCH | AUTO_MATCH_WITH_SAMPLING_REVIEW | REVIEW_QUEUE | NO_MATCH
- `confidence_score`: 0–100
- `reasons[]`: e.g. ["GTIN_EXACT", "PRODUCER_EXACT", "VOLUME_MATCH"]
- `guardrail_failures[]`: if any
- `candidates[]` (top 3): { wf_product_id or wf_product_family_id, score, reason_summary }

---

## Example Reason Codes
- GTIN_EXACT
- SKU_MAPPING_FOUND
- PRODUCER_EXACT / PRODUCER_FUZZY
- PRODUCT_NAME_EXACT / PRODUCT_NAME_FUZZY
- VINTAGE_EXACT / VINTAGE_MISMATCH
- VOLUME_MATCH / VOLUME_MISMATCH
- PACK_MATCH / PACK_MISMATCH
- UNITS_PER_CASE_MATCH / UNITS_PER_CASE_MISMATCH
- ABV_WITHIN_TOLERANCE / ABV_OUT_OF_TOLERANCE
- REGION_MATCH

---

## Implementation Notes (Phase 1)
- GTIN is optional, but when present it should dominate scoring.
- Use "verify + cache" for GTIN verification. Never hard-depend on live GS1 in user flows.
- Store every manual decision as an append-only audit event:
  - who, when, action (approve/reject/create), before/after, reason.
- Ensure idempotency:
  - unique constraint on (supplier_id, supplier_sku)
  - prevent duplicate mappings and handle concurrency safely.

---

## Implementation Status

**v2 Implementation:** `lib/matching/product-matcher-v2.ts`
- ✅ All guardrails implemented
- ✅ Scoring model aligned (GTIN +70, SKU +60, etc.)
- ✅ Decision thresholds: 90/80/60
- ✅ Strict vintage policy (exact match required)
- ✅ Missing vintage handling (no auto-match to vintage-specific)
- ✅ Reason codes standardized
- ✅ Guardrail failure reporting

**Test Coverage:** `scripts/test-matching-rules.ts`
- ✅ All guardrails tested
- ✅ All decision thresholds tested
- ✅ Vintage policy tested
- ✅ GTIN matching tested
- ✅ Fuzzy matching tested

End.
