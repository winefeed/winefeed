# GS1 Master Data Use Cases

**Document:** Business Use Cases → Architecture Mapping
**Purpose:** Validate architecture solves real operational problems
**Date:** 2026-01-14

---

## Use Case Index

1. [Supplier Catalog Import with Auto-Matching](#use-case-1-supplier-catalog-import-with-auto-matching)
2. [Multi-Supplier Price Comparison (Same Product)](#use-case-2-multi-supplier-price-comparison-same-product)
3. [Quote Request with Product Confidence](#use-case-3-quote-request-with-product-confidence)
4. [Order-Shipment-Invoice Reconciliation](#use-case-4-order-shipment-invoice-reconciliation)
5. [Manual Product Review Queue](#use-case-5-manual-product-review-queue)
6. [Delivery Site Verification with GLN](#use-case-6-delivery-site-verification-with-gln)
7. [Cross-Supplier Product Analytics](#use-case-7-cross-supplier-product-analytics)
8. [Compliance Audit Trail](#use-case-8-compliance-audit-trail)

---

## Use Case 1: Supplier Catalog Import with Auto-Matching

### Business Problem
**Before:** Supplier uploads 500-line CSV. Operations team manually reviews each line, searching for duplicates and matching to existing products. Takes 4-6 hours per import.

**After:** Supplier uploads CSV with GTINs. System auto-matches 90%+ of products instantly. Only uncertain matches queued for review (10 minutes work).

---

### User Story
**As a** supplier onboarding manager
**I want to** import a wine catalog with GTINs
**So that** products are automatically matched to master products without manual work

---

### Flow Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│ SUPPLIER CATALOG IMPORT WITH AUTO-MATCHING                         │
└────────────────────────────────────────────────────────────────────┘

1. SUPPLIER: Upload CSV
   ↓
   ┌────────────────────────────────────────────────────────────┐
   │ CSV File                                                    │
   │ name,producer,vintage,volume,gtin,price_ex_vat             │
   │ "Margaux 2015","Château Margaux",2015,750,3012345678901,450│
   │ "Bordeaux 2016","Château B",2016,750,3012345678902,290     │
   └────────────────────────────────────────────────────────────┘

2. API: POST /api/suppliers/:id/catalog/import
   ↓
3. For each row:
   ├─► Extract GTIN: "3012345678901"
   │
   ├─► VERIFICATION SERVICE: Check GTIN
   │   ├─► Check cache (gs1_verification_cache)
   │   │   └─► Cache hit? → Return cached result ✓
   │   │
   │   └─► Cache miss? → Call GS1 API
   │       ├─► GS1 Sweden API: Verify GTIN
   │       └─► Store in cache (TTL: 30 days)
   │
   ├─► MATCHING ENGINE: Find master product
   │   │
   │   ├─► Rule 1: GTIN exact match
   │   │   └─► SELECT * FROM product_gtin_registry WHERE gtin = '3012345678901'
   │   │       └─► Found? → master_product_id = "WF-PROD-00123"
   │   │           Confidence = 1.00 ✓
   │   │
   │   ├─► Rule 2: SKU mapping lookup (if no GTIN match)
   │   │   └─► SELECT * FROM supplier_product_mappings WHERE supplier_sku = 'S-1234'
   │   │       └─► Found? → master_product_id = "WF-PROD-00456"
   │   │           Confidence = 0.90
   │   │
   │   └─► Rule 3: Fuzzy attribute match (if no SKU match)
   │       └─► Find candidates: producer + wine + vintage + volume
   │           └─► Calculate similarity score
   │               ├─► Score > 80%? → master_product_id = "WF-PROD-00789"
   │               │   Confidence = 0.65
   │               └─► Score < 80%? → No match
   │                   Confidence = 0.00
   │
   ├─► GUARDRAILS: Validate match
   │   ├─► Volume matches? ✓
   │   ├─► Pack size matches? ✓
   │   └─► Vintage matches (or NV)? ✓
   │
   ├─► DECISION: Auto-match or Review?
   │   ├─► Confidence >= 0.85? → Auto-match ✓
   │   │   └─► Create supplier_product_mapping (status: 'matched')
   │   │
   │   └─► Confidence < 0.85? → Review queue
   │       └─► Create supplier_product_mapping (status: 'pending')
   │
   └─► LOG: Record matching decision
       └─► INSERT INTO matching_decisions (...)

4. RESULT: Return summary
   ┌────────────────────────────────────────────────────────────┐
   │ {                                                           │
   │   "imported": 500,                                          │
   │   "auto_matched": 450,    // 90% with GTIN or high conf.   │
   │   "pending_review": 50,   // 10% need manual review        │
   │   "failed": 0                                               │
   │ }                                                            │
   └────────────────────────────────────────────────────────────┘

5. ADMIN: Review pending (50 products)
   ├─► GET /api/admin/product-mappings?status=pending
   └─► Review each, approve/reject
```

---

### Components Used

| Component | Table/Service | Purpose |
|-----------|---------------|---------|
| **Verification Service** | `gs1_verification_cache` | Cache GTIN verifications (avoid repeated API calls) |
| **GS1 API Client** | External API | Verify GTINs with GS1 Sweden |
| **Matching Engine** | `lib/matching/engine.ts` | Apply rules, calculate confidence |
| **Master Data** | `master_products`, `product_gtin_registry` | Golden product records |
| **Mappings** | `supplier_product_mappings` | Link supplier SKUs to master products |
| **Audit** | `matching_decisions` | Log all matching decisions |

---

### Business Outcome

**Time Saved:**
- Before: 4-6 hours per 500-line import
- After: 10 minutes (only review 50 uncertain matches)
- **Savings: 95% reduction in manual work**

**Quality Improvement:**
- Before: ~5% error rate (human mistakes)
- After: <1% error rate (GTIN exact match)
- **Improvement: 80% fewer matching errors**

---

## Use Case 2: Multi-Supplier Price Comparison (Same Product)

### Business Problem
**Before:** Restaurant searches "Château Margaux 2015". System shows 3 separate listings (one per supplier). Restaurant unsure if they're the same wine or different. Manually compares descriptions, volumes.

**After:** System recognizes all 3 offers map to same master product (via GTIN). Shows unified price comparison with confidence indicator.

---

### User Story
**As a** restaurant buyer
**I want to** see price comparison for the same verified product across suppliers
**So that** I can confidently choose the best offer

---

### Flow Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│ MULTI-SUPPLIER PRICE COMPARISON                                    │
└────────────────────────────────────────────────────────────────────┘

1. SETUP: 3 suppliers have imported catalogs
   ├─► Supplier A: "Margaux 2015" → GTIN: 3012345678901 → master_product_id: WF-PROD-00123
   ├─► Supplier B: "Château Margaux 2015" → GTIN: 3012345678901 → master_product_id: WF-PROD-00123
   └─► Supplier C: "Margaux Grand Vin 2015" → GTIN: 3012345678901 → master_product_id: WF-PROD-00123
       (All map to same master product via GTIN exact match)

2. RESTAURANT: Create quote request
   ┌────────────────────────────────────────────────────────────┐
   │ Quote Request                                               │
   │ Fritext: "Château Margaux 2015, 12 bottles"                │
   │ Budget: 500 SEK/bottle                                      │
   │ Quantity: 12                                                │
   └────────────────────────────────────────────────────────────┘

3. ROUTING ENGINE: Match to suppliers (existing logic)
   └─► Dispatched to Supplier A, B, C

4. SUPPLIERS: Create offers
   ├─► Supplier A: 450 SEK/bottle (supplier_wine_id: A-123 → master_product_id: WF-PROD-00123)
   ├─► Supplier B: 420 SEK/bottle (supplier_wine_id: B-456 → master_product_id: WF-PROD-00123)
   └─► Supplier C: 480 SEK/bottle (supplier_wine_id: C-789 → master_product_id: WF-PROD-00123)

5. RESTAURANT: List offers
   GET /api/quote-requests/:id/offers

6. API: Enhance offers with master product data
   ┌────────────────────────────────────────────────────────────┐
   │ SELECT                                                      │
   │   o.id,                                                     │
   │   o.offered_price_ex_vat_sek,                              │
   │   s.namn AS supplier_name,                                 │
   │   sw.name AS supplier_wine_name,                           │
   │   mp.wf_product_id,                                        │
   │   mp.wine_name AS master_wine_name,                        │
   │   mp.producer AS master_producer,                          │
   │   mp.vintage,                                               │
   │   mp.match_confidence,                                      │
   │   pgr.gtin,                                                 │
   │   pgr.is_verified                                           │
   │ FROM offers o                                               │
   │ JOIN supplier_wines sw ON sw.id = o.supplier_wine_id       │
   │ JOIN suppliers s ON s.id = o.supplier_id                   │
   │ LEFT JOIN master_products mp ON mp.id = sw.master_product_id│
   │ LEFT JOIN product_gtin_registry pgr ON pgr.master_product_id = mp.id│
   │ WHERE o.request_id = :quote_request_id                     │
   └────────────────────────────────────────────────────────────┘

7. RESULT: Unified price comparison
   ┌────────────────────────────────────────────────────────────┐
   │ {                                                           │
   │   "offers": [                                               │
   │     {                                                       │
   │       "id": "offer-b-456",                                  │
   │       "supplier": "Supplier B",                             │
   │       "price_ex_vat_sek": 420.00,                           │
   │       "total_inc_vat_sek": 6300.00,                         │
   │       "master_product": {                                   │
   │         "wf_product_id": "WF-PROD-00123",                   │
   │         "wine_name": "Château Margaux 2015",                │
   │         "producer": "Château Margaux",                      │
   │         "vintage": 2015,                                    │
   │         "volume_ml": 750,                                   │
   │         "gtin": "3012345678901",                            │
   │         "is_verified": true,                                │
   │         "match_confidence": 1.00    // ← GTIN exact match  │
   │       }                                                      │
   │     },                                                       │
   │     {                                                       │
   │       "id": "offer-a-123",                                  │
   │       "supplier": "Supplier A",                             │
   │       "price_ex_vat_sek": 450.00,                           │
   │       "master_product": { ... same WF-PROD-00123 ... }      │
   │     },                                                       │
   │     {                                                       │
   │       "id": "offer-c-789",                                  │
   │       "supplier": "Supplier C",                             │
   │       "price_ex_vat_sek": 480.00,                           │
   │       "master_product": { ... same WF-PROD-00123 ... }      │
   │     }                                                        │
   │   ],                                                         │
   │   "grouping": {                                              │
   │     "WF-PROD-00123": {                                       │
   │       "product": "Château Margaux 2015",                    │
   │       "offer_count": 3,                                      │
   │       "price_range": { "min": 420, "max": 480 },            │
   │       "best_offer": "offer-b-456"                            │
   │     }                                                         │
   │   }                                                           │
   │ }                                                             │
   └────────────────────────────────────────────────────────────┘

8. UI: Display grouped comparison
   ┌────────────────────────────────────────────────────────────┐
   │ Château Margaux 2015 (750ml) ✓ Verified GTIN              │
   │ ────────────────────────────────────────────────────────── │
   │ Supplier B       420 SEK/bottle   [Best Price] [Select]    │
   │ Supplier A       450 SEK/bottle                [Select]    │
   │ Supplier C       480 SEK/bottle                [Select]    │
   │                                                             │
   │ ℹ️ All offers verified as same product (GTIN match)        │
   └────────────────────────────────────────────────────────────┘
```

---

### Business Outcome

**Confidence Improvement:**
- Before: Restaurant unsure if offers are same product
- After: 100% confidence (GTIN-verified match)
- **Result: No more "did I order the right wine?" anxiety**

**Price Discovery:**
- Before: Manual comparison, may miss best price
- After: Automated grouping, clear best price
- **Result: Restaurants save 5-10% by choosing best offer**

---

## Use Case 3: Quote Request with Product Confidence

### Business Problem
**Before:** Restaurant creates vague request ("Bordeaux, 12 bottles"). Suppliers guess which wine. 30% of offers are rejected as "wrong product."

**After:** System suggests verified products based on fritext. Restaurant can optionally specify master_product_id. Suppliers see exact product requested.

---

### Flow Diagram

```
1. RESTAURANT: Create quote request (with optional product hint)
   ┌────────────────────────────────────────────────────────────┐
   │ POST /api/quote-requests                                    │
   │ {                                                           │
   │   "fritext": "Château Margaux 2015, 12 bottles, budget 500"│
   │   "suggested_master_product_id": "WF-PROD-00123" // optional│
   │ }                                                            │
   └────────────────────────────────────────────────────────────┘

2. ROUTING ENGINE: Match to suppliers
   └─► Filter suppliers with this master product (if specified)
       SELECT DISTINCT s.id
       FROM suppliers s
       JOIN supplier_wines sw ON sw.supplier_id = s.id
       WHERE sw.master_product_id = 'WF-PROD-00123'

3. SUPPLIERS: See exact product requested
   GET /api/suppliers/:id/quote-requests
   ┌────────────────────────────────────────────────────────────┐
   │ {                                                           │
   │   "quote_request": {                                        │
   │     "id": "...",                                            │
   │     "fritext": "Château Margaux 2015, 12 bottles",          │
   │     "suggested_product": {                                  │
   │       "wf_product_id": "WF-PROD-00123",                     │
   │       "wine_name": "Château Margaux 2015",                  │
   │       "gtin": "3012345678901",                              │
   │       "is_verified": true                                   │
   │     }                                                        │
   │   }                                                          │
   │ }                                                            │
   └────────────────────────────────────────────────────────────┘

4. SUPPLIER: Create offer with correct product
   POST /api/quote-requests/:id/offers
   {
     "supplier_wine_id": "S-123", // Maps to WF-PROD-00123
     "offered_price_ex_vat_sek": 450,
     ...
   }

5. RESULT: 0% wrong product offers
```

---

### Business Outcome
- Before: 30% offer rejection rate (wrong product)
- After: <5% rejection rate
- **Result: 25% more successful transactions**

---

## Use Case 4: Order-Shipment-Invoice Reconciliation

### Business Problem
**Before:** Restaurant receives shipment. Packing slip says "Bordeaux 2015." Invoice says "Margaux GV 2015." Order says "Château Margaux 2015." Operations team manually reconciles (30 minutes per order).

**After:** All documents reference same GTIN. System auto-matches order → shipment → invoice in seconds.

---

### Flow Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│ 3-WAY RECONCILIATION: ORDER ↔ SHIPMENT ↔ INVOICE                  │
└────────────────────────────────────────────────────────────────────┘

1. ORDER ACCEPTED (Commercial Intent)
   ┌────────────────────────────────────────────────────────────┐
   │ CommercialIntent                                            │
   │ - id: CI-001                                                │
   │ - master_product_id: WF-PROD-00123                          │
   │ - wine_name: "Château Margaux 2015"                         │
   │ - quantity: 12                                              │
   │ - total_payable: 5400 SEK                                   │
   │                                                             │
   │ Product Details (via master_product_id):                    │
   │ - GTIN: 3012345678901                                       │
   │ - Volume: 750ml                                             │
   │ - Producer: Château Margaux                                 │
   └────────────────────────────────────────────────────────────┘

2. SHIPMENT RECEIVED (Packing Slip)
   ┌────────────────────────────────────────────────────────────┐
   │ Packing Slip (from supplier)                                │
   │ - Product: "Margaux GV 2015" (different description!)       │
   │ - GTIN: 3012345678901 ✓ (barcode scanned)                  │
   │ - Quantity: 12                                              │
   └────────────────────────────────────────────────────────────┘

   SYSTEM: Match via GTIN
   ├─► Lookup GTIN in product_gtin_registry
   │   └─► gtin = '3012345678901' → master_product_id = WF-PROD-00123
   │
   └─► Find CommercialIntent with this master_product_id
       └─► commercial_intent.master_product_id = WF-PROD-00123 ✓
           └─► AUTO-MATCH: Shipment matches Order

   RESULT: Shipment auto-confirmed (no manual review)

3. INVOICE RECEIVED (from supplier)
   ┌────────────────────────────────────────────────────────────┐
   │ Invoice (EDI or PDF)                                        │
   │ - Line 1: GTIN 3012345678901, Qty 12, Price 450 SEK        │
   │ - Buyer GLN: 7300000000001 (restaurant)                    │
   │ - Ship-to GLN: 7300000000002 (delivery site)               │
   │ - Total: 5400 SEK                                           │
   └────────────────────────────────────────────────────────────┘

   SYSTEM: Match via GTIN + GLN
   ├─► Lookup GTIN → master_product_id = WF-PROD-00123 ✓
   ├─► Lookup Buyer GLN → master_party_id = WF-PARTY-00456 ✓
   ├─► Lookup Ship-to GLN → master_location_id = WF-LOC-00789 ✓
   │
   └─► Find CommercialIntent matching:
       ├─► master_product_id = WF-PROD-00123 ✓
       ├─► restaurant_id = WF-PARTY-00456 ✓
       ├─► delivery_location_id = WF-LOC-00789 ✓
       └─► total_payable = 5400 SEK ✓
           └─► AUTO-MATCH: Invoice matches Order + Shipment

   RESULT: Invoice auto-approved for payment

4. RECONCILIATION COMPLETE
   ┌────────────────────────────────────────────────────────────┐
   │ ✓ Order CI-001                                              │
   │ ✓ Shipment (GTIN: 3012345678901)                           │
   │ ✓ Invoice (GTIN + GLN matched)                             │
   │                                                             │
   │ Status: RECONCILED (auto-matched in 2 seconds)             │
   │ Action: Auto-approve payment                                │
   └────────────────────────────────────────────────────────────┘
```

---

### Components Used
- `master_products` + `product_gtin_registry`: GTIN → product mapping
- `master_parties` + `party_gln_registry`: GLN → party mapping
- `master_locations` + `location_gln_registry`: GLN → location mapping
- `commercial_intents`: Order record with master_product_id

---

### Business Outcome
- Before: 30 minutes manual reconciliation per order
- After: 2 seconds auto-reconciliation
- **Savings: 99.9% reduction in reconciliation time**

**Error Reduction:**
- Before: ~10% reconciliation errors (wrong matching)
- After: <1% errors (GTIN/GLN exact match)

---

## Use Case 5: Manual Product Review Queue

### Business Problem
**Before:** No systematic review process. Products with uncertain matches are auto-approved anyway. Causes downstream errors.

**After:** Clear review queue. Admin sees confidence scores, match reasons. Can approve, reject, or create new master product.

---

### Flow (Admin Review)

```
1. ADMIN: Open review queue
   GET /api/admin/product-mappings?status=pending&sort=confidence

2. SYSTEM: Show pending mappings (confidence < 0.85)
   ┌────────────────────────────────────────────────────────────┐
   │ Pending Product Mappings (50 items)                        │
   │                                                             │
   │ [1] Supplier: Wine Importer AB                             │
   │     Supplier SKU: S-12345                                  │
   │     Supplier Name: "Margaux 2015 Red Wine"                 │
   │     Volume: 750ml, Vintage: 2015                           │
   │     GTIN: None                                              │
   │                                                             │
   │     Suggested Match:                                        │
   │     → Master Product: WF-PROD-00123                         │
   │       "Château Margaux 2015"                                │
   │       Confidence: 0.72 (fuzzy attribute match)              │
   │       Reasons: [producer_similar:0.85, vintage_exact:1.00]  │
   │                                                             │
   │     Actions: [Approve] [Reject] [Create New Master]        │
   │                                                             │
   │ ──────────────────────────────────────────────────────────│
   │                                                             │
   │ [2] Supplier: French Wines Ltd                             │
   │     Supplier SKU: FW-789                                   │
   │     Supplier Name: "Bordeaux Premier Cru 2015"             │
   │     Confidence: 0.60 (low confidence, needs review)         │
   │     ...                                                     │
   └────────────────────────────────────────────────────────────┘

3. ADMIN ACTION: Approve mapping #1
   PATCH /api/admin/product-mappings/mapping-123
   {
     "action": "approve",
     "review_notes": "Confirmed: same wine, supplier uses shorter name"
   }

   SYSTEM:
   ├─► Update supplier_product_mappings
   │   ├─► mapping_status = 'matched'
   │   ├─► reviewed_by = admin_user_id
   │   └─► reviewed_at = NOW()
   │
   ├─► Update supplier_wines
   │   └─► master_product_id = 'WF-PROD-00123'
   │
   └─► Log decision
       └─► INSERT INTO matching_decisions (decision_type: 'manual_match', ...)

4. ADMIN ACTION: Create new master product for #2
   PATCH /api/admin/product-mappings/mapping-456
   {
     "action": "create_new_master",
     "new_product_data": {
       "producer": "Château Unknown",
       "wine_name": "Bordeaux Premier Cru",
       "vintage": 2015,
       "volume_ml": 750
     }
   }

   SYSTEM:
   ├─► Create new master_product
   │   └─► wf_product_id = 'WF-PROD-00999'
   │
   ├─► Update mapping
   │   └─► master_product_id = 'WF-PROD-00999'
   │       mapping_status = 'matched'
   │
   └─► Log decision
       └─► decision_type: 'manual_match_new_master'
```

---

### Business Outcome
- Before: No review process, 10% error rate
- After: Systematic review, <1% error rate
- **Result: 90% reduction in matching errors**

---

## Use Case 6: Delivery Site Verification with GLN

### Business Problem
**Before:** Restaurant provides delivery address as free text. Typos, missing apartment numbers, wrong city. 15% failed deliveries.

**After:** Restaurant registers delivery sites with GLN (verified via GS1). Orders use GLN. Supplier looks up verified address. 0% failed deliveries.

---

### Flow

```
1. RESTAURANT ONBOARDING: Register delivery site
   POST /api/restaurants/:id/delivery-sites
   {
     "name": "Main Kitchen",
     "address": "Storgatan 15",
     "city": "Stockholm",
     "postal_code": "11455",
     "gln": "7300000000001"  // Optional
   }

2. SYSTEM: Verify GLN with GS1
   ├─► Call GS1 API: verifyGLN("7300000000001")
   └─► GS1 returns:
       {
         "is_valid": true,
         "party_name": "Restaurant Margaux AB",
         "address": "Storgatan 15",
         "city": "Stockholm",
         "postal_code": "114 55"
       }

3. SYSTEM: Create master location
   ├─► INSERT INTO master_locations (...)
   │   └─► wf_location_id = 'WF-LOC-00789'
   │
   └─► INSERT INTO location_gln_registry (...)
       └─► gln = '7300000000001', is_verified = true

4. ORDER PLACEMENT: Use verified delivery site
   POST /api/offers/:id/accept
   {
     "delivery_site_id": "WF-LOC-00789"
   }

   SYSTEM: Resolve GLN from location
   └─► location_gln_registry.gln = '7300000000001'

5. SUPPLIER: Receive order with GLN
   └─► Lookup GLN in their system → verified address
   └─► Ship to correct location ✓

6. RESULT: 0% failed deliveries (address verified)
```

---

### Business Outcome
- Before: 15% failed deliveries (wrong address)
- After: <1% failed deliveries
- **Savings: 14% reduction in failed deliveries**

---

## Use Case 7: Cross-Supplier Product Analytics

### Business Problem
**Before:** Cannot analyze "how many bottles of Château Margaux 2015 did we sell?" because each supplier has different product name. No unified reporting.

**After:** All sales link to master_product_id. Can aggregate across suppliers.

---

### Query Example

```sql
-- Report: Top 10 wines sold (cross-supplier)
SELECT
  mp.wf_product_id,
  mp.producer,
  mp.wine_name,
  mp.vintage,
  COUNT(DISTINCT ci.id) AS order_count,
  SUM(ci.quantity) AS total_bottles_sold,
  SUM(ci.total_payable_estimate_ore) / 100 AS total_revenue_sek,
  COUNT(DISTINCT ci.restaurant_id) AS unique_restaurants,
  COUNT(DISTINCT ci.supplier_id) AS unique_suppliers
FROM commercial_intents ci
JOIN master_products mp ON mp.id = ci.master_product_id
WHERE ci.accepted_at >= '2026-01-01'
  AND ci.status = 'confirmed'
GROUP BY mp.id, mp.producer, mp.wine_name, mp.vintage
ORDER BY total_revenue_sek DESC
LIMIT 10;
```

**Result:**
```
wf_product_id    | producer          | wine_name      | vintage | bottles | revenue  | restaurants | suppliers
─────────────────┼───────────────────┼────────────────┼─────────┼─────────┼──────────┼─────────────┼──────────
WF-PROD-00123    | Château Margaux   | Grand Vin      | 2015    | 1,234   | 555,300  | 45          | 3
WF-PROD-00456    | Domaine Leroy     | Chambertin     | 2010    | 892     | 2,140,000| 12          | 2
...
```

---

### Business Outcome
- Before: No cross-supplier analytics
- After: Full product-level insights
- **Result: Data-driven inventory and pricing decisions**

---

## Use Case 8: Compliance Audit Trail

### Business Problem
**Before:** Auditor asks "Show me all changes to product data in 2025." No centralized log. Takes weeks to reconstruct.

**After:** All changes logged in `data_change_log`. Export CSV in 5 minutes.

---

### Flow

```
1. AUDITOR REQUEST: "Show all product changes in 2025"

2. ADMIN: Export audit log
   GET /api/admin/audit/product-changes?start_date=2025-01-01&end_date=2025-12-31&export=csv

3. SYSTEM: Query change log
   SELECT
     dcl.changed_at,
     dcl.table_name,
     dcl.operation,
     dcl.before_snapshot->>'wine_name' AS old_name,
     dcl.after_snapshot->>'wine_name' AS new_name,
     dcl.change_reason,
     u.email AS changed_by
   FROM data_change_log dcl
   LEFT JOIN auth.users u ON u.id = dcl.changed_by
   WHERE dcl.table_name = 'master_products'
     AND dcl.changed_at BETWEEN '2025-01-01' AND '2025-12-31'
   ORDER BY dcl.changed_at;

4. EXPORT: CSV file
   ┌────────────────────────────────────────────────────────────┐
   │ date,operation,old_name,new_name,reason,changed_by         │
   │ 2025-03-15,UPDATE,"Margaux 2015","Château Margaux 2015",...│
   │ 2025-06-20,INSERT,NULL,"Bordeaux 2016","supplier_import",...│
   │ ...                                                         │
   └────────────────────────────────────────────────────────────┘

5. RESULT: Auditor receives complete audit trail in 5 minutes
```

---

### Business Outcome
- Before: Weeks to reconstruct audit trail
- After: 5 minutes to export
- **Result: 99.9% reduction in audit prep time**

---

## Summary: Use Cases → Business Value

| Use Case | Time Saved | Error Reduction | Key Benefit |
|----------|-----------|-----------------|-------------|
| **1. Catalog Import** | 95% (4h → 10min) | 80% fewer errors | Supplier onboarding efficiency |
| **2. Price Comparison** | N/A | 100% confidence | Better purchasing decisions |
| **3. Product Confidence** | N/A | 25% fewer rejections | Higher order success rate |
| **4. Reconciliation** | 99.9% (30min → 2sec) | 90% fewer errors | Operations efficiency |
| **5. Review Queue** | N/A | 90% fewer errors | Data quality |
| **6. Delivery GLN** | N/A | 14% fewer failures | Logistics reliability |
| **7. Analytics** | N/A | N/A | Data-driven insights |
| **8. Audit Trail** | 99.9% (weeks → 5min) | N/A | Compliance readiness |

---

**Total Estimated ROI:**
- **Operations Time Saved:** 80% reduction in manual work
- **Error Rate Reduction:** 85% fewer product/delivery errors
- **Compliance Cost:** 95% reduction in audit prep time

---

**Document Version:** 1.0
**Status:** ✅ Complete
**Next Steps:** Validate with stakeholders, begin Phase 1 implementation
