# Admin Review Queue UI Spec (Phase 1 Minimal)

**Purpose:** Allow admin users to review and approve/reject uncertain product matches (confidence 0.50-0.84)

**URL:** `/admin/product-review`

---

## Page Layout (Wireframe)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Winefeed Admin - Product Match Review Queue                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Filters: [All Suppliers ▼] [Pending ▼]                  🔄 Refresh     │
│                                                                         │
│ 12 items pending review                                                │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ [1] Supplier: French Wine Importer                                  ││
│ │ SKU: MARG-2015-750  │  Status: Pending  │  Added: 2026-01-14 10:30 ││
│ │                                                                      ││
│ │ Supplier Data:                                                       ││
│ │ • Producer: Château Margaux                                         ││
│ │ • Product: Château Margaux 2015                                     ││
│ │ • Vintage: 2015                                                      ││
│ │ • Volume: 750ml  │  Pack: bottle                                    ││
│ │ • GTIN: 3012345678901 (✓ GS1 verified)                             ││
│ │                                                                      ││
│ │ Match Candidates (top 3):                                           ││
│ │                                                                      ││
│ │ ○ [Candidate A] Confidence: 82%  ⭐⭐⭐⭐                            ││
│ │   WF-PROD-00042 │ Château Margaux 2015 │ 750ml │ bottle            ││
│ │   Reasons: producer_match:28pts, product_name_match:29pts,          ││
│ │            vintage_exact:15pts, volume_match:10pts                  ││
│ │   [✓ Approve Match]  [Create New Product]                          ││
│ │                                                                      ││
│ │ ○ [Candidate B] Confidence: 68%  ⭐⭐⭐                              ││
│ │   WF-PROD-00123 │ Château Margaux 2016 │ 750ml │ bottle            ││
│ │   Reasons: producer_match:29pts, product_name_match:28pts,          ││
│ │            vintage_near:10pts                                       ││
│ │   [✓ Approve Match]  [Create New Product]                          ││
│ │                                                                      ││
│ │ ○ [Candidate C] Confidence: 54%  ⭐⭐                                ││
│ │   WF-PROD-00201 │ Margaux Reserve 2015 │ 750ml │ bottle            ││
│ │   Reasons: producer_match:15pts, product_name_match:18pts,          ││
│ │            vintage_exact:15pts, country_match:5pts                  ││
│ │   [✓ Approve Match]  [Create New Product]                          ││
│ │                                                                      ││
│ │ [⨉ Reject All - No Match]                                           ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ [2] Supplier: Tuscany Wine Collection                               ││
│ │ ...                                                                  ││
│ └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## UI Components

### 1. Queue List
- Show all pending items (paginated, 10 per page)
- Sort by: created_at DESC (newest first)
- Filter by:
  - Supplier (dropdown)
  - Status (pending | approved | rejected)
  - Date range

### 2. Review Item Card

**Header:**
- Supplier name
- Supplier SKU
- Status badge
- Timestamp

**Supplier Data Section:**
- Producer, product name, vintage
- Volume, pack type, units per case
- GTIN (with GS1 verification status: ✓ verified | ✗ not found | - not provided)
- Country, region
- ABV, other attributes

**Match Candidates Section:**
- Show top 3 candidates
- Each candidate shows:
  - Confidence score (%) with star rating (★★★★ = 80%+, ★★★ = 60-79%, ★★ = 40-59%)
  - wf_product_id
  - Product details (producer, wine name, vintage, volume, pack)
  - Match reasons (bullet points with scores)
- **Actions per candidate:**
  - "✓ Approve Match" → create mapping
  - "Create New Product" → create new master_product + mapping

**Footer Actions:**
- "⨉ Reject All - No Match" → mark as rejected (no mapping created)

---

## User Actions & API Calls

### Action 1: Approve Match

**Trigger:** User clicks "✓ Approve Match" on Candidate A

**API Call:**
```typescript
POST /api/admin/product-review/:queueItemId/approve

Body:
{
  "masterProductId": "uuid-of-candidate-a",
  "reviewNotes": "Optional admin notes"
}
```

**Backend Logic:**
1. Create `supplier_product_mappings` row:
   - supplier_id, supplier_sku, master_product_id
   - match_confidence (from candidate)
   - match_method = 'fuzzy_match'
   - approved_by_user_id = current admin user
2. Update `product_match_review_queue`:
   - status = 'approved'
   - reviewed_by_user_id = current admin user
   - reviewed_at = NOW()
   - approved_master_product_id = candidate ID
3. Write audit log:
   - event_type = 'mapping_approved'
   - entity_type = 'supplier_mapping'
   - before_state = null
   - after_state = {mapping details}

**UI Response:**
- Show success toast: "✅ Mapping approved"
- Remove item from queue
- Move to next item

---

### Action 2: Create New Product

**Trigger:** User clicks "Create New Product"

**API Call:**
```typescript
POST /api/admin/product-review/:queueItemId/create-new

Body:
{
  "reviewNotes": "Optional admin notes"
}
```

**Backend Logic:**
1. Create `product_families` row (if doesn't exist):
   - wf_family_id = generate_wf_family_id()
   - producer, wine_name, country, region (from supplier data)
2. Create `master_products` row:
   - wf_product_id = generate_wf_product_id()
   - family_id
   - vintage, volume_ml, pack_type, units_per_case (from supplier data)
   - data_source = 'supplier_import'
3. If GTIN provided → create `product_gtin_registry` row:
   - gtin, master_product_id
   - is_verified = (from GS1 verification)
4. Create `supplier_product_mappings` row:
   - supplier_id, supplier_sku, master_product_id
   - match_confidence = 1.00 (new product = perfect match)
   - match_method = 'manual_override'
5. Update queue item: status = 'approved'
6. Write audit logs (product_created + mapping_created)

**UI Response:**
- Show success toast: "✅ New product created: WF-PROD-00XXX"
- Remove item from queue

---

### Action 3: Reject All

**Trigger:** User clicks "⨉ Reject All - No Match"

**API Call:**
```typescript
POST /api/admin/product-review/:queueItemId/reject

Body:
{
  "reviewNotes": "Required: reason for rejection"
}
```

**Backend Logic:**
1. Update `product_match_review_queue`:
   - status = 'rejected'
   - reviewed_by_user_id = current admin
   - review_notes = user input
2. Write audit log:
   - event_type = 'review_rejected'

**UI Response:**
- Show warning toast: "⚠️  Match rejected"
- Remove item from queue

---

## API Endpoints Summary

```typescript
// List queue items
GET /api/admin/product-review
  ?status=pending
  &supplierId=uuid
  &page=1
  &limit=10

Response:
{
  items: Array<{
    id: string;
    supplierId: string;
    supplierName: string;
    supplierSku: string;
    supplierData: {...};
    matchCandidates: Array<{
      masterProductId: string;
      wfProductId: string;
      confidence: number;
      matchReasons: string[];
      productData: {...};
    }>;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}

// Approve match
POST /api/admin/product-review/:id/approve
Body: { masterProductId: string; reviewNotes?: string }
Response: { success: true; mappingId: string }

// Create new product
POST /api/admin/product-review/:id/create-new
Body: { reviewNotes?: string }
Response: { success: true; wfProductId: string; mappingId: string }

// Reject
POST /api/admin/product-review/:id/reject
Body: { reviewNotes: string }
Response: { success: true }
```

---

## Design Tokens (Minimal Styling)

**Colors:**
- Confidence 80%+: `text-green-600`, `bg-green-50`
- Confidence 60-79%: `text-yellow-600`, `bg-yellow-50`
- Confidence 40-59%: `text-orange-600`, `bg-orange-50`

**Typography:**
- Queue item header: `text-lg font-semibold`
- Match candidate: `text-base`
- Match reasons: `text-sm text-muted-foreground`

**Spacing:**
- Queue item card: `p-6 mb-4 border rounded-lg`
- Match candidate: `p-4 mb-2 border-l-4`

---

## Success Metrics

**Per Admin Session:**
- Time per review: target <30 seconds
- Items reviewed per hour: target 120+ (2 per minute)

**Overall:**
- Review queue depth: target <50 items
- Approval rate: target 70%+ (most candidates are good)
- New product creation rate: target <20% (most products already exist)

---

## Implementation Notes

1. **No real-time updates needed** (manual refresh OK for Phase 1)
2. **No bulk actions needed** (approve one-by-one is fine for Phase 1)
3. **No advanced search** (simple dropdown filters sufficient)
4. **Use existing Winefeed UI components** (Card, Button, Badge, etc.)

---

**Status:** Ready for Implementation
**Estimated effort:** 2-3 days (1 day API, 1-2 days UI)
