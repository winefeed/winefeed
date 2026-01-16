# API JSON Shapes - Phase 1 Vertical Slice

This document defines the exact JSON shapes for API requests and responses in the Phase 1 import flow.

---

## 1. Upload CSV Import

### Request
```
POST /api/suppliers/:supplierId/imports
Content-Type: multipart/form-data

file: <CSV file>
```

OR

```
POST /api/suppliers/:supplierId/imports
Content-Type: application/json

{
  "csvText": "supplier_sku,producer_name,product_name,...",
  "filename": "price-list-2024.csv"
}
```

### Response
```json
{
  "importId": "550e8400-e29b-41d4-a716-446655440000",
  "supplierId": "123e4567-e89b-12d3-a456-426614174000",
  "filename": "price-list-2024.csv",
  "totalLines": 150,
  "status": "PARSED"
}
```

---

## 2. Run Matching

### Request
```
POST /api/imports/:importId/match
```

### Response
```json
{
  "importId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "MATCHED",
  "summary": {
    "totalLines": 150,
    "autoMatched": 85,
    "samplingReview": 12,
    "needsReview": 38,
    "noMatch": 15,
    "errors": 0,
    "autoMatchedPercent": "56.7",
    "needsReviewPercent": "25.3",
    "noMatchPercent": "10.0"
  }
}
```

**Idempotent Response** (if already matched):
```json
{
  "importId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "MATCHED",
  "summary": {
    "totalLines": 150,
    "autoMatched": 85,
    "samplingReview": 12,
    "needsReview": 38,
    "noMatch": 15,
    "errors": 0
  },
  "message": "Import already matched (idempotent)"
}
```

---

## 3. Fetch Review Queue

### Request
```
GET /api/admin/review-queue?importId=<uuid>&status=pending&limit=50&offset=0
```

Query Parameters:
- `importId` (optional): Filter by specific import
- `status` (default: "pending"): Filter by status (pending | resolved)
- `limit` (default: 50): Page size
- `offset` (default: 0): Pagination offset

### Response
```json
{
  "items": [
    {
      "queueItemId": "abc12345-e29b-41d4-a716-446655440001",
      "status": "pending",
      "createdAt": "2024-01-14T10:30:00Z",
      "resolvedAt": null,
      "resolvedBy": null,

      "supplier": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Premium Wine Distributors AB"
      },

      "line": {
        "importId": "550e8400-e29b-41d4-a716-446655440000",
        "lineNumber": 42,
        "supplierSku": "CH-2019-750",
        "gtinEach": "7350123456789",
        "gtinCase": null,
        "producerName": "Château Margaux",
        "productName": "Château Margaux Premier Grand Cru Classé",
        "vintage": 2019,
        "volumeMl": 750,
        "abvPercent": 13.5,
        "packType": "bottle",
        "unitsPerCase": null,
        "countryOfOrigin": "France",
        "region": "Margaux",
        "grapeVariety": "Cabernet Sauvignon blend",
        "priceExVatSek": 4500.00,
        "currency": "SEK",
        "rawData": {
          "supplier_sku": "CH-2019-750",
          "gtin_each": "7350123456789",
          "producer_name": "Château Margaux",
          "product_name": "Château Margaux Premier Grand Cru Classé",
          "vintage": "2019",
          "volume_ml": "750",
          "abv_percent": "13.5",
          "pack_type": "bottle",
          "price_net": "4500.00"
        }
      },

      "matchMetadata": {
        "status": "NEEDS_REVIEW",
        "confidenceScore": 75,
        "reasons": [
          "PRODUCER_FUZZY_STRONG",
          "PRODUCT_EXACT",
          "VINTAGE_EXACT",
          "VOLUME_EXACT"
        ],
        "guardrailFailures": []
      },

      "candidates": [
        {
          "id": "wf-prod-00123",
          "type": "master_product",
          "score": 85,
          "reasons": [
            "PRODUCER_EXACT",
            "PRODUCT_EXACT",
            "VINTAGE_EXACT",
            "VOLUME_EXACT",
            "ABV_WITHIN_TOLERANCE"
          ],
          "producerName": "Château Margaux",
          "productName": "Château Margaux 1er Cru",
          "vintage": 2019,
          "volumeMl": 750,
          "packType": "bottle",
          "abvPercent": 13.5,
          "reasonSummary": "Producer match • Product match • Vintage match • Volume match",
          "warnings": []
        },
        {
          "id": "wf-prod-00124",
          "type": "master_product",
          "score": 68,
          "reasons": [
            "PRODUCER_EXACT",
            "PRODUCT_FUZZY_STRONG",
            "VINTAGE_MISMATCH",
            "VOLUME_EXACT"
          ],
          "producerName": "Château Margaux",
          "productName": "Château Margaux 1er Cru",
          "vintage": 2018,
          "volumeMl": 750,
          "packType": "bottle",
          "abvPercent": 13.0,
          "reasonSummary": "Producer match • Product match • ⚠️ Vintage differs • Volume match",
          "warnings": ["VINTAGE_MISMATCH: input=2019, candidate=2018"]
        },
        {
          "id": "wf-family-456",
          "type": "product_family",
          "score": 65,
          "reasons": [
            "PRODUCER_EXACT",
            "PRODUCT_EXACT",
            "MISSING_VINTAGE",
            "FAMILY_CANDIDATE_FOUND"
          ],
          "producerName": "Château Margaux",
          "productName": "Château Margaux 1er Cru (Family)",
          "vintage": null,
          "volumeMl": 750,
          "packType": "bottle",
          "abvPercent": null,
          "reasonSummary": "Producer match • Product match • ⚠️ Missing vintage",
          "warnings": []
        }
      ]
    }
  ],

  "pagination": {
    "total": 38,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## 4. Resolve Queue Item

### Request
```
POST /api/admin/review-queue/:queueItemId/decision
Content-Type: application/json

{
  "action": "approve_match",
  "selectedId": "wf-prod-00123",
  "comment": "Verified match - exact GTIN and vintage",
  "reviewedBy": "user-uuid-12345"
}
```

**Actions:**
- `"approve_match"`: Approve match to specific MasterProduct (requires `selectedId`)
- `"approve_family"`: Approve match to ProductFamily (requires `selectedId`)
- `"reject"`: Reject all candidates (no mapping created)
- `"create_new_product"`: Create new MasterProduct from supplier data

**Fields:**
- `action` (required): One of the 4 actions above
- `selectedId` (required for approve_match/approve_family): Winefeed product/family ID
- `comment` (optional): Human comment for audit trail
- `reviewedBy` (optional): User ID who made the decision

### Response
```json
{
  "queueItemId": "abc12345-e29b-41d4-a716-446655440001",
  "status": "resolved",
  "action": "approve_match",
  "mapping": {
    "mappingId": "mapping-uuid-789",
    "masterProductId": "wf-prod-00123",
    "productFamilyId": null,
    "matchConfidence": 1.0,
    "matchMethod": "human_review"
  },
  "auditEventId": "audit-uuid-999",
  "message": "Successfully approved match"
}
```

**Idempotent Response** (if already resolved):
```json
{
  "queueItemId": "abc12345-e29b-41d4-a716-446655440001",
  "status": "resolved",
  "message": "Queue item already resolved (idempotent)",
  "existingMapping": {
    "id": "mapping-uuid-789",
    "supplier_id": "123e4567-e89b-12d3-a456-426614174000",
    "supplier_sku": "CH-2019-750",
    "master_product_id": "wf-prod-00123",
    "match_confidence": 1.0,
    "match_method": "human_review"
  }
}
```

### Response for `create_new_product`
```json
{
  "queueItemId": "abc12345-e29b-41d4-a716-446655440001",
  "status": "resolved",
  "action": "create_new_product",
  "mapping": {
    "mappingId": "mapping-uuid-790",
    "masterProductId": "wf-prod-99999",
    "productFamilyId": null,
    "matchConfidence": 1.0,
    "matchMethod": "create_new_product",
    "newProductCreated": true
  },
  "auditEventId": "audit-uuid-1000",
  "message": "Successfully approved match"
}
```

### Response for `reject`
```json
{
  "queueItemId": "abc12345-e29b-41d4-a716-446655440001",
  "status": "resolved",
  "action": "reject",
  "mapping": {
    "mappingId": null,
    "masterProductId": null,
    "productFamilyId": null,
    "rejected": true,
    "reason": "Supplier data incomplete - cannot verify identity"
  },
  "auditEventId": "audit-uuid-1001",
  "message": "Successfully rejected match"
}
```

---

## 5. Error Responses

All endpoints follow this error format:

```json
{
  "error": "Human-readable error message",
  "details": {
    "code": "ERROR_CODE",
    "message": "Detailed technical error"
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid request (missing fields, invalid action, etc.)
- `404 Not Found`: Resource not found (import, queue item, etc.)
- `500 Internal Server Error`: Server error

**Examples:**

```json
{
  "error": "Import not found",
  "status": 404
}
```

```json
{
  "error": "Invalid action. Must be: approve_match | approve_family | reject | create_new_product",
  "status": 400
}
```

```json
{
  "error": "selectedId required for approve actions",
  "status": 400
}
```

---

## 6. Audit Log Event Shape

Audit events are written to `product_audit_log` table (append-only):

```json
{
  "id": "audit-uuid-999",
  "event_type": "review_queue_approve_match",
  "entity_type": "supplier_product_mapping",
  "entity_id": "mapping-uuid-789",
  "user_id": "user-uuid-12345",
  "timestamp": "2024-01-14T10:35:00Z",
  "metadata": {
    "queueItemId": "abc12345-e29b-41d4-a716-446655440001",
    "supplierId": "123e4567-e89b-12d3-a456-426614174000",
    "supplierSku": "CH-2019-750",
    "selectedId": "wf-prod-00123",
    "action": "approve_match",
    "comment": "Verified match - exact GTIN and vintage",
    "beforeState": null,
    "afterState": {
      "mappingId": "mapping-uuid-789",
      "masterProductId": "wf-prod-00123",
      "matchConfidence": 1.0,
      "matchMethod": "human_review"
    }
  }
}
```

**Event Types:**
- `review_queue_approve_match`
- `review_queue_approve_family`
- `review_queue_reject`
- `review_queue_create_new_product`

---

## 7. CSV Upload Format

Expected CSV columns:

```csv
supplier_sku,gtin_each,gtin_case,producer_name,product_name,vintage,volume_ml,abv_percent,pack_type,units_per_case,country_of_origin,region,grape_variety,price_net,currency
CH-2019-750,7350123456789,,Château Margaux,Château Margaux Premier Grand Cru Classé,2019,750,13.5,bottle,,France,Margaux,Cabernet Sauvignon blend,4500.00,SEK
```

**Required Fields:**
- `supplier_sku`
- `producer_name`
- `product_name`
- `volume_ml`
- `pack_type`
- `price_net` (or `price_ex_vat_sek`)

**Optional Fields:**
- `gtin_each`
- `gtin_case`
- `vintage`
- `abv_percent`
- `units_per_case`
- `country_of_origin`
- `region`
- `grape_variety`
- `currency` (defaults to SEK)
