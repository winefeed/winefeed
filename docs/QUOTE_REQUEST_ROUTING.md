# Quote Request Routing & Marketplace Documentation

**Version:** 1.0
**Date:** 2026-01-14
**Status:** ✅ Complete

---

## Overview

This document describes the Quote Request Routing system that makes Winefeed an operational marketplace. The system automatically matches restaurant quote requests to suitable suppliers based on multi-dimensional scoring, then tracks supplier engagement through assignment workflows.

---

## Architecture

### Data Model

```
┌─────────────────────────────────────────────────────────────┐
│              QUOTE REQUEST ROUTING FLOW                      │
└─────────────────────────────────────────────────────────────┘

1. Restaurant creates QuoteRequest
   └─> stored in requests table

2. Dispatch (manual or auto-triggered)
   POST /api/quote-requests/:id/dispatch
   ├─> QuoteRequestRouter.routeQuoteRequest()
   │   ├─> Evaluate all active suppliers
   │   ├─> Score each supplier (0-100)
   │   └─> Return top N matches
   └─> Create QuoteRequestAssignments
       ├─> status: SENT
       ├─> expiresAt: now + 48h
       └─> matchScore + matchReasons stored

3. Supplier views assigned requests
   GET /api/suppliers/:id/quote-requests
   └─> Auto-update: SENT → VIEWED

4. Supplier creates offer
   POST /api/quote-requests/:id/offers
   ├─> Validate assignment exists
   ├─> Validate not expired
   ├─> Create offer
   └─> Auto-update: VIEWED → RESPONDED

5. Assignment expires
   └─> Status: EXPIRED (if no response)
```

### QuoteRequestAssignment Table

```sql
CREATE TABLE quote_request_assignments (
  id UUID PRIMARY KEY,
  quote_request_id UUID NOT NULL REFERENCES requests(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),

  -- Status tracking
  status assignment_status DEFAULT 'SENT',
    -- SENT: Assignment created
    -- VIEWED: Supplier has seen the request
    -- RESPONDED: Supplier created offer
    -- EXPIRED: Past deadline

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Routing metadata
  match_score DECIMAL(4,2),      -- 0.00-100.00
  match_reasons TEXT[],          -- ["region_match:25pts", "budget_match:20pts"]

  -- Constraints
  UNIQUE (quote_request_id, supplier_id)
);
```

**Indexes:**
- `(supplier_id, status)` - Fast lookup of supplier's active assignments
- `(quote_request_id)` - Fast lookup of request's assignments
- `(expires_at)` - Expiry cleanup queries

**RLS Policies:**
- Suppliers can only see their own assignments
- Restaurants can see assignments for their requests
- Only service role can create/update assignments

---

## Routing Algorithm

### Input Data

**QuoteRequest (from `requests` table):**
- `fritext` - Free text description (e.g., "Söker elegant rött vin från Bordeaux")
- `budget_per_flaska` - Budget per bottle (SEK)
- `antal_flaskor` - Requested quantity
- `leverans_senast` - Delivery deadline (ISO date)
- `specialkrav` - Special requirements (array: ["ekologiskt", "veganskt"])

**Supplier Catalog (`supplier_wines`):**
- `country`, `region`, `grape` - Wine attributes
- `price_ex_vat_sek` - Price in öre (integer)
- `min_order_qty` - Minimum bottles per order
- `lead_time_days` - Delivery lead time

### Scoring Components

Total score: **0-100 points**

#### 1. Region/Country/Style Match (0-30 points)

**Keyword extraction from `fritext`:**
- **Regions:** bordeaux, rioja, tuscany, barossa, napa, etc.
- **Countries:** france, italy, spain, portugal, germany, etc.
- **Styles:** röd/red, vit/white, rosé, cabernet, pinot noir, etc.

**Scoring:**
```typescript
// Find wines matching keywords
matches = wines.filter(wine =>
  wine.country/region/grape includes keyword
);

matchPercentage = (matches / totalWines) * 100;
score = min(30, matchPercentage * 0.3);
```

**Example:**
- Request: "Bordeaux, France, röd"
- Supplier has 10 wines, 6 from Bordeaux → 60% match → 18 points

---

#### 2. Budget Match (0-25 points)

Wines within budget ±20%:

```typescript
budgetOre = budgetSek * 100;
withinBudget = wines.filter(wine =>
  wine.price >= budgetOre * 0.8 &&
  wine.price <= budgetOre * 1.2
);

matchPercentage = (withinBudget / totalWines) * 100;
score = min(25, matchPercentage * 0.25);
```

**Example:**
- Budget: 500 SEK → accept 400-600 SEK
- 8 out of 10 wines in range → 80% → 20 points

---

#### 3. Lead Time Match (0-20 points)

Can supplier deliver before deadline?

```typescript
daysUntilDelivery = (deliveryDate - today) / 86400000;

if (daysUntilDelivery < supplierLeadTime) {
  score = 0; // Cannot meet deadline
} else if (daysUntilDelivery >= supplierLeadTime * 2) {
  score = 20; // Plenty of time
} else {
  score = 10 + proportionalBonus; // 10-20 points
}
```

**Example:**
- Request needs delivery in 10 days
- Supplier lead time: 5 days → 20 points
- Supplier lead time: 8 days → ~15 points
- Supplier lead time: 12 days → 0 points

---

#### 4. Minimum Order Quantity Match (0-15 points)

Can supplier fulfill requested quantity?

```typescript
availableWines = wines.filter(wine =>
  wine.minOrderQty <= requestedQty
);

matchPercentage = (availableWines / totalWines) * 100;
score = min(15, matchPercentage * 0.15);
```

**Example:**
- Request: 12 bottles
- 10 wines have minOrderQty ≤ 12 → 100% → 15 points
- 5 wines have minOrderQty ≤ 12 → 50% → 7.5 points

---

#### 5. Catalog Size Bonus (0-10 points)

Larger catalogs increase chances of good match:

```typescript
catalogBonus = min(10, catalogSize / 10);
```

**Example:**
- 50 wines → 5 points
- 100+ wines → 10 points

---

### Final Score Example

```
Request: "12 bottles, Bordeaux red wine, 450 SEK/bottle, 14 days"

Supplier A (French Importer):
- Region match: 25 points (80% Bordeaux wines)
- Budget match: 22 points (90% within 360-540 SEK)
- Lead time: 20 points (3 day lead time)
- Min qty: 15 points (all wines available)
- Catalog: 8 points (80 wines)
TOTAL: 90 points ✅

Supplier B (Italian Importer):
- Region match: 5 points (20% French wines)
- Budget match: 18 points (70% within budget)
- Lead time: 15 points (7 day lead time)
- Min qty: 12 points (80% available)
- Catalog: 6 points (60 wines)
TOTAL: 56 points ✅

Supplier C (Spanish Importer):
- No French wines → 0 region match
- Lead time: 0 points (20 day lead time, too slow)
TOTAL: 22 points → Below minScore threshold (default 20)
```

**Result:** Dispatch to Supplier A and B (top 2)

---

## API Reference

### 1. Dispatch Quote Request

**Endpoint:** `POST /api/quote-requests/:id/dispatch`

**Request Body:**
```json
{
  "maxMatches": 10,          // Top N suppliers (default: 10)
  "minScore": 20,            // Minimum score threshold (default: 20)
  "expiresInHours": 48       // Assignment validity (default: 48h)
}
```

**Response (201 Created):**
```json
{
  "quoteRequestId": "uuid",
  "assignmentsCreated": 3,
  "matches": [
    {
      "supplierId": "uuid",
      "supplierName": "French Wine Importer AB",
      "matchScore": 90,
      "matchReasons": [
        "region_match:25pts",
        "budget_match:22pts",
        "lead_time_ok:20pts",
        "min_order_ok:15pts",
        "catalog_size:80"
      ],
      "catalogSize": 80,
      "assignmentId": "uuid"
    }
  ],
  "expiresAt": "2026-01-16T12:00:00Z",
  "routingTimestamp": "2026-01-14T12:00:00Z",
  "message": "Dispatched to 3 suppliers"
}
```

**Errors:**
- `404` - Quote request not found
- `409` - Already dispatched (idempotency protection)
- `404` - No suitable suppliers found (all below minScore)

**Idempotency:**
- Duplicate dispatch returns `409 Conflict`
- To re-dispatch, first delete existing assignments (future feature)

---

### 2. Get Dispatch Status / Preview

**Endpoint:** `GET /api/quote-requests/:id/dispatch[?preview=true]`

**Without preview (status only):**
```json
{
  "dispatched": true,
  "assignmentsCount": 3,
  "assignments": [
    {
      "id": "uuid",
      "supplierId": "uuid",
      "status": "RESPONDED",
      "matchScore": 90,
      "sentAt": "2026-01-14T12:00:00Z",
      "expiresAt": "2026-01-16T12:00:00Z"
    }
  ]
}
```

**With preview (routing simulation):**
```json
{
  "dispatched": false,
  "assignmentsCount": 0,
  "preview": {
    "potentialMatches": [
      {
        "supplierId": "uuid",
        "supplierName": "Supplier Name",
        "matchScore": 85,
        "matchReasons": ["region_match:25pts", "..."],
        "catalogSize": 50
      }
    ],
    "totalSuppliersEvaluated": 15
  }
}
```

**Use cases:**
- **Status check:** Verify if request has been dispatched
- **Preview:** Test routing algorithm before actual dispatch

---

### 3. Supplier Lists Assigned Requests

**Endpoint:** `GET /api/suppliers/:id/quote-requests?status=active&limit=50&offset=0`

**Query Parameters:**
- `status`: active | expired | all (default: active)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "restaurantId": "uuid",
      "restaurantName": "Restaurang Gott",
      "fritext": "Söker elegant rött vin från Bordeaux",
      "budgetPerFlaska": 450,
      "antalFlaskor": 12,
      "leveransSenast": "2026-02-01",
      "specialkrav": ["ekologiskt"],
      "createdAt": "2026-01-14T10:00:00Z",
      "assignment": {
        "id": "uuid",
        "status": "VIEWED",          // Auto-updated from SENT
        "matchScore": 90,
        "matchReasons": ["region_match:25pts", "..."],
        "sentAt": "2026-01-14T12:00:00Z",
        "viewedAt": "2026-01-14T12:05:00Z",  // Auto-set
        "respondedAt": null,
        "expiresAt": "2026-01-16T12:00:00Z",
        "isExpired": false
      },
      "myOfferCount": 0,
      "totalOfferCount": 2
    }
  ],
  "total": 5,
  "hasMore": false
}
```

**Access Control:**
- ✅ Supplier only sees requests they have assignments for
- ✅ No assignment = request not visible
- ✅ RLS enforces at database level

**Auto-Status Update:**
- When supplier GETs this endpoint, all `SENT` assignments → `VIEWED`
- `viewed_at` timestamp is set automatically

---

### 4. Create Offer (with Assignment Validation)

**Endpoint:** `POST /api/quote-requests/:id/offers`

**Request Body:**
```json
{
  "supplierId": "uuid",
  "supplierWineId": "uuid",
  "offeredPriceExVatSek": 440.00,
  "quantity": 12,
  "deliveryDate": "2026-02-01",
  "leadTimeDays": 7,
  "notes": "Perfect match for your request"
}
```

**NEW Validation (Assignment Check):**
```typescript
// 1. Verify assignment exists
assignment = getAssignment(quoteRequestId, supplierId);
if (!assignment) {
  return 403 "No valid assignment found";
}

// 2. Check not expired
if (assignment.expiresAt < now || assignment.status === 'EXPIRED') {
  return 403 "Assignment has expired";
}

// 3. Create offer
offer = createOffer(...);

// 4. Auto-update assignment status
updateAssignment(assignmentId, {
  status: 'RESPONDED',
  respondedAt: now
});
```

**Response (201 Created):**
```json
{
  "offer": { ... },
  "message": "Offer created successfully"
}
```

**Errors:**
- `403` - No valid assignment found
- `403` - Assignment has expired
- `403` - Wine does not belong to supplier (existing tenant isolation)
- `400` - Quantity below minimum order quantity

---

## Access Control & Security

### Assignment-Based Access

```
┌────────────────────────────────────────────────────┐
│          ACCESS CONTROL ENFORCEMENT                 │
└────────────────────────────────────────────────────┘

Supplier can ONLY:
├─ See quote requests WHERE assignment exists
├─ Create offers WHERE assignment is valid
└─ View assignment details for their own assignments

Validation layers:
1. RLS at database level (quote_request_assignments)
2. API endpoint checks assignment existence
3. Expiry validation before offer creation
```

### Tenant Isolation

**Database Level (RLS):**
```sql
-- Suppliers see only their own assignments
CREATE POLICY "Suppliers see own assignments"
  ON quote_request_assignments FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );
```

**API Level:**
```typescript
// In GET /api/suppliers/:id/quote-requests
assignments = getAssignments({ supplierId });
quoteRequests = getRequests({ ids: assignments.map(a => a.quoteRequestId) });

// Supplier CANNOT see requests without assignments
```

**Offer Creation:**
```typescript
// Validate assignment before allowing offer
if (!hasValidAssignment(quoteRequestId, supplierId)) {
  return 403 Forbidden;
}
```

---

## Status Workflow

```
┌─────────────────────────────────────────────────────┐
│         ASSIGNMENT STATUS STATE MACHINE              │
└─────────────────────────────────────────────────────┘

SENT
  ├─> VIEWED (auto-updated when supplier lists requests)
  │   └─> RESPONDED (auto-updated when supplier creates offer)
  │       └─> [Terminal state]
  │
  └─> EXPIRED (when now > expiresAt and no response)
      └─> [Terminal state]

Constraints:
- Status can only move forward (no backwards transitions)
- EXPIRED can be set from SENT or VIEWED
- RESPONDED is permanent (even if expires later)
```

**Timestamp Validation:**
```sql
-- Database constraint
CHECK (
  (viewed_at IS NULL OR viewed_at >= sent_at) AND
  (responded_at IS NULL OR responded_at >= sent_at) AND
  (responded_at IS NULL OR viewed_at IS NULL OR responded_at >= viewed_at)
);
```

---

## Expiry Management

### Database Function

```sql
CREATE FUNCTION auto_expire_assignments()
RETURNS void AS $$
BEGIN
  UPDATE quote_request_assignments
  SET status = 'EXPIRED'
  WHERE status IN ('SENT', 'VIEWED')
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### Execution Options

**Option 1: Scheduled Job (Recommended)**
```bash
# Using pg_cron or external cron
*/5 * * * * psql -c "SELECT auto_expire_assignments();"
```

**Option 2: On-Read Check**
```typescript
// In GET /api/suppliers/:id/quote-requests
await supabase.rpc('auto_expire_assignments');
const assignments = await getAssignments();
```

**Option 3: Supabase Edge Function**
```typescript
// Scheduled via Supabase Dashboard
Deno.serve(async () => {
  await supabase.rpc('auto_expire_assignments');
  return new Response('OK');
});
```

**For MVP:** Call `auto_expire_assignments()` in GET quote-requests endpoint

---

## Testing

### Test Coverage

**Total Tests:** 17
- **Integration:** 9 tests (routing flow)
- **Attack:** 8 tests (access control)

### Integration Tests

**File:** `tests/integration/quote-request-routing-flow.test.ts`

**Scenarios:**
1. ✅ Restaurant creates quote request
2. ✅ Dispatch routes to matched suppliers
3. ✅ Supplier views assigned requests (status → VIEWED)
4. ✅ Supplier creates offer (status → RESPONDED)
5. ✅ Assignment status tracking
6. ✅ Multiple suppliers can respond
7. ✅ Restaurant sees all offers
8. ✅ Duplicate dispatch prevention
9. ✅ Dispatch status and preview

**Example Flow:**
```typescript
// 1. Create restaurant + quote request
quoteRequest = createQuoteRequest({
  fritext: "Bordeaux red wine, 12 bottles, 450 SEK"
});

// 2. Dispatch
dispatch(quoteRequestId);
// → 2 suppliers matched (French: 90pts, Italian: 56pts)

// 3. French supplier views requests
GET /api/suppliers/french-supplier-id/quote-requests
// → Assignment status: SENT → VIEWED

// 4. French supplier creates offer
POST /api/quote-requests/:id/offers
// → Assignment status: VIEWED → RESPONDED

// 5. Verify
assignment.status === 'RESPONDED' ✅
assignment.respondedAt !== null ✅
```

---

### Attack Tests

**File:** `tests/attack/assignment-access-control.test.ts`

**Scenarios:**
1. ✅ **ATTACK 1:** Cannot create offer without assignment → 403
2. ✅ **ATTACK 2:** Only see requests with assignments
3. ✅ **ATTACK 3:** Cannot create offer on expired assignment → 403
4. ✅ **ATTACK 4:** Cannot steal other supplier's assignment → 403
5. ✅ **ATTACK 5:** RLS prevents direct database access
6. ✅ **ATTACK 6:** Expired assignments hidden from active list
7. ✅ **ATTACK 7:** Valid assignment allows offer creation
8. ✅ **ATTACK 8:** Status transitions work correctly

**Example Attack:**
```typescript
// Supplier B tries to create offer on Supplier A's assignment
POST /api/quote-requests/assigned-to-A/offers
{
  "supplierId": "supplier-B-id",  // ATTACK
  "supplierWineId": "wine-B-id",
  ...
}

Response: 403 Forbidden
{
  "error": "No valid assignment found",
  "details": "You can only create offers for quote requests you have been assigned to."
}
```

---

## Running Tests

```bash
# Install dependencies
npm install

# Apply database migration
# Run in Supabase SQL Editor:
# supabase/migrations/20260114_quote_request_routing.sql

# Run all tests
npm run test

# Run only routing integration tests
npm run test tests/integration/quote-request-routing-flow

# Run only attack tests
npm run test tests/attack/assignment-access-control

# Watch mode
npm run test:watch
```

**Expected Output:**
```
✓ tests/integration/quote-request-routing-flow.test.ts (9)
  ✓ Step 1: Restaurant creates quote request
  ✓ Step 2: Dispatch routes to matched suppliers
  ✓ Step 3: Supplier views assigned requests
  ✓ Step 4: Supplier creates offer
  ✓ Step 5: Assignment status updated to RESPONDED
  ✓ Step 6: Multiple suppliers can respond
  ✓ Step 7: Restaurant sees all offers
  ✓ Step 8: Duplicate dispatch prevented
  ✓ Step 9: Dispatch status and preview

✓ tests/attack/assignment-access-control.test.ts (8)
  ✓ ATTACK 1: Cannot create offer without assignment
  ✓ ATTACK 2: Only see assigned requests
  ✓ ATTACK 3: Cannot create offer on expired assignment
  ✓ ATTACK 4: Cannot steal assignment
  ✓ ATTACK 5: RLS prevents DB access
  ✓ ATTACK 6: Expired hidden from active list
  ✓ ATTACK 7: Valid assignment works
  ✓ ATTACK 8: Status transitions correct

Test Files  2 passed (2)
     Tests  17 passed (17)
```

---

## Usage Examples

### Example 1: Complete Routing Flow

```bash
# 1. Restaurant creates quote request
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": "uuid",
    "fritext": "12 bottles Bordeaux red wine, budget 450 SEK/bottle, 14 days",
    "budget_per_flaska": 450,
    "antal_flaskor": 12,
    "leverans_senast": "2026-02-01"
  }'

# 2. Dispatch to suppliers (manual or auto-triggered)
curl -X POST http://localhost:3000/api/quote-requests/{requestId}/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "maxMatches": 10,
    "minScore": 20,
    "expiresInHours": 48
  }'

# Response:
# {
#   "assignmentsCreated": 3,
#   "matches": [
#     { "supplierId": "...", "matchScore": 90, "supplierName": "French Importer" },
#     { "supplierId": "...", "matchScore": 75, "supplierName": "Italian Importer" },
#     { "supplierId": "...", "matchScore": 55, "supplierName": "Spanish Importer" }
#   ],
#   "expiresAt": "2026-01-16T12:00:00Z"
# }

# 3. Supplier views their assigned requests
curl http://localhost:3000/api/suppliers/{supplierId}/quote-requests?status=active

# Response:
# {
#   "requests": [
#     {
#       "id": "...",
#       "fritext": "12 bottles Bordeaux...",
#       "assignment": {
#         "status": "VIEWED",  // Auto-updated!
#         "matchScore": 90,
#         "expiresAt": "2026-01-16T12:00:00Z"
#       }
#     }
#   ]
# }

# 4. Supplier creates offer
curl -X POST http://localhost:3000/api/quote-requests/{requestId}/offers \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "uuid",
    "supplierWineId": "uuid",
    "offeredPriceExVatSek": 440.00,
    "quantity": 12,
    "deliveryDate": "2026-01-28",
    "leadTimeDays": 7
  }'

# Assignment status is now RESPONDED automatically!
```

---

### Example 2: Preview Routing (No Dispatch)

```bash
# Preview which suppliers would be matched
curl http://localhost:3000/api/quote-requests/{requestId}/dispatch?preview=true

# Response:
# {
#   "dispatched": false,
#   "preview": {
#     "potentialMatches": [
#       {
#         "supplierId": "...",
#         "supplierName": "French Wine Importer AB",
#         "matchScore": 90,
#         "matchReasons": [
#           "region_match:25pts",
#           "budget_match:22pts",
#           "lead_time_ok:20pts"
#         ],
#         "catalogSize": 80
#       }
#     ],
#     "totalSuppliersEvaluated": 15
#   }
# }
```

---

## File Structure

```
winefeed/
├── supabase/migrations/
│   └── 20260114_quote_request_routing.sql   # Assignment table + RLS
│
├── lib/
│   └── quote-request-router.ts              # Scoring algorithm
│
├── app/api/
│   ├── quote-requests/[id]/
│   │   ├── dispatch/route.ts                # Dispatch endpoint
│   │   └── offers/route.ts                  # Updated with assignment validation
│   └── suppliers/[id]/
│       └── quote-requests/route.ts          # Updated with assignment filtering
│
├── tests/
│   ├── integration/
│   │   └── quote-request-routing-flow.test.ts  # 9 tests
│   └── attack/
│       └── assignment-access-control.test.ts   # 8 tests
│
└── docs/
    └── QUOTE_REQUEST_ROUTING.md             # This file
```

---

## Performance Considerations

### Database Indexes

```sql
-- Fast supplier lookups
CREATE INDEX idx_assignments_supplier_status
  ON quote_request_assignments(supplier_id, status);

-- Fast quote request lookups
CREATE INDEX idx_assignments_quote_request
  ON quote_request_assignments(quote_request_id);

-- Expiry cleanup
CREATE INDEX idx_assignments_expires
  ON quote_request_assignments(expires_at);
```

### Optimization Tips

1. **Routing Algorithm:**
   - Limit to active suppliers only (`is_active = true`)
   - Cache wine catalog in memory if needed
   - Parallelize supplier evaluation (future)

2. **Assignment Queries:**
   - Use composite index `(supplier_id, status)` for filtering
   - Paginate results (default: 50 per page)

3. **Expiry Management:**
   - Run expiry job every 5-15 minutes
   - Consider TTL-based cleanup (Supabase Edge Functions)

---

## Next Steps

### Phase 2: Enhanced Routing

1. **Machine Learning Scoring:**
   - Train model on historical offers
   - Predict supplier response likelihood
   - Personalized scoring per supplier

2. **Dynamic Expiry:**
   - Shorter expiry for urgent requests
   - Extend expiry if no responses

3. **Supplier Preferences:**
   - Supplier sets preferred regions/styles
   - Opt-in/opt-out of certain request types

### Phase 3: Notifications

4. **Email/Push Notifications:**
   - Notify suppliers of new assignments
   - Remind before expiry
   - Alert restaurant when offers received

5. **Real-time Updates:**
   - WebSocket for live assignment updates
   - Real-time offer count

### Phase 4: Analytics

6. **Routing Metrics:**
   - Average match score over time
   - Response rate per supplier
   - Time-to-first-offer

7. **A/B Testing:**
   - Test different scoring weights
   - Optimize maxMatches value

---

## Troubleshooting

### Common Issues

**Problem:** Dispatch returns "No suitable suppliers found"

**Solution:**
- Check suppliers have active catalogs (`supplier_wines.is_active = true`)
- Lower `minScore` threshold (default: 20)
- Verify supplier lead times are reasonable
- Check budget range is realistic

---

**Problem:** Supplier cannot see quote requests

**Solution:**
- Verify assignment was created: `SELECT * FROM quote_request_assignments WHERE supplier_id = ?`
- Check assignment is not expired: `expires_at > NOW()`
- Verify supplier is active: `suppliers.is_active = true`

---

**Problem:** Offer creation returns "No valid assignment"

**Solution:**
- Verify assignment exists for this supplier+request combo
- Check assignment has not expired
- Ensure assignment status is SENT or VIEWED (not EXPIRED)

---

**Problem:** Assignment status stuck on SENT

**Solution:**
- Supplier must call GET `/api/suppliers/:id/quote-requests` to trigger VIEWED
- Auto-update only happens when listing endpoint is called
- Manual update: `UPDATE quote_request_assignments SET status = 'VIEWED' WHERE id = ?`

---

## Changelog

### Version 1.0 (2026-01-14)

**Added:**
- ✅ QuoteRequestAssignment data model with status workflow
- ✅ QuoteRequestRouter service with multi-dimensional scoring
- ✅ Dispatch endpoint (POST /dispatch)
- ✅ Assignment-based access control
- ✅ Auto-status updates (SENT → VIEWED → RESPONDED)
- ✅ Expiry management (database function)
- ✅ 17 comprehensive tests (9 integration + 8 attack)
- ✅ RLS policies for tenant isolation

**Scoring Algorithm:**
- Region/Country/Style matching: 0-30 points
- Budget matching: 0-25 points
- Lead time capability: 0-20 points
- Minimum order quantity: 0-15 points
- Catalog size bonus: 0-10 points

**Security:**
- Suppliers can only see assigned requests
- Assignment expiry enforced
- RLS at database level
- Attack tests prove isolation

---

**Author:** Claude Sonnet 4.5
**Project:** Winefeed - B2B Wine Marketplace
**Documentation Version:** 1.0
**Status:** Production Ready
