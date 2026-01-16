# Restaurant Order Tracking 1.0 (Read-Only)

## Overview

Restaurant order tracking feature allows restaurants to view and track their orders after acceptance. This is a **read-only** view - restaurants cannot modify orders, only track status and view compliance information for EU orders.

**Goal:** Provide restaurants with visibility into their order fulfillment status and compliance.

**Key Features:**
- View all orders for restaurant
- Filter by status (CONFIRMED, IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)
- View order details: lines, events timeline, compliance summary
- Read-only compliance status for EU orders (import case, DDL, 5369 documents)
- Actor-based authentication (no hardcoded IDs)

---

## Architecture

### Actor Resolution

All endpoints use `actorService` to verify RESTAURANT role and resolve `restaurant_id`:

1. **Client sends headers:**
   ```
   x-tenant-id: <tenant_uuid>
   x-user-id: <user_uuid>
   ```

2. **Server resolves actor:**
   - Calls `actorService.resolveActor()`
   - Verifies user has RESTAURANT role
   - Extracts `restaurant_id` from `restaurant_users` table

3. **Authorization:**
   - Only shows orders where `orders.restaurant_id` matches actor's restaurant
   - Tenant isolation enforced

### Data Flow

```
User → Actor Resolution → Restaurant Orders API → Supabase → Enriched Response
```

**Enrichment:**
- Supplier names (from `suppliers` table)
- Importer names (from `importers` table)
- Import case status (from `imports` table if linked)
- DDL status (from `direct_delivery_locations` if import case exists)
- 5369 document versions (from `import_documents` if exists)

---

## API Endpoints

### GET /api/restaurant/orders

**Purpose:** List all orders for current restaurant.

**Authentication:**
- Requires `x-tenant-id` and `x-user-id` headers
- RESTAURANT role verified via actor service
- Uses resolved `restaurant_id` automatically

**Query Parameters:**
- `status` (optional): Filter by status (CONFIRMED, IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)
- `limit` (optional): Max 100, default 50
- `offset` (optional): Pagination offset, default 0

**Response:**
```json
{
  "orders": [
    {
      "id": "order-uuid",
      "created_at": "2026-01-20T10:00:00Z",
      "updated_at": "2026-01-20T10:00:00Z",
      "status": "CONFIRMED",
      "supplier_name": "Test Winery AB",
      "supplier_type": "EU_PRODUCER",
      "importer_name": "Swedish IOR AB",
      "import_id": "import-uuid",
      "import_status": "NOT_REGISTERED",
      "lines_count": 3,
      "total_quantity": 36,
      "currency": "SEK"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

**Errors:**
- `401` - Missing authentication context
- `403` - User lacks RESTAURANT role
- `500` - Internal server error

---

### GET /api/restaurant/orders/[id]

**Purpose:** Get detailed information about a specific order.

**Authentication:**
- Requires `x-tenant-id` and `x-user-id` headers
- RESTAURANT role verified via actor service
- Order ownership verified (must belong to user's restaurant)

**Response:**
```json
{
  "order": {
    "id": "order-uuid",
    "restaurant_id": "restaurant-uuid",
    "seller_supplier_id": "supplier-uuid",
    "importer_of_record_id": "importer-uuid",
    "status": "CONFIRMED",
    "total_lines": 3,
    "total_quantity": 36,
    "currency": "SEK",
    "created_at": "2026-01-20T10:00:00Z",
    "updated_at": "2026-01-20T10:00:00Z",
    "supplier": {
      "namn": "Test Winery AB",
      "type": "EU_PRODUCER",
      "kontakt_email": "info@testwinery.com"
    },
    "importer": {
      "legal_name": "Swedish IOR AB",
      "contact_email": "ior@example.se"
    }
  },
  "lines": [
    {
      "id": "line-uuid",
      "wine_name": "Château Test 2020",
      "producer": "Test Winery",
      "vintage": "2020",
      "country": "France",
      "region": "Bordeaux",
      "quantity": 12,
      "unit": "bottle",
      "unit_price_sek": 150.00,
      "total_price_sek": 1800.00,
      "line_number": 1
    }
  ],
  "events": [
    {
      "id": "event-uuid",
      "event_type": "ORDER_CREATED",
      "from_status": null,
      "to_status": "CONFIRMED",
      "note": "Order created from accepted offer",
      "actor_name": "System",
      "created_at": "2026-01-20T10:00:00Z"
    }
  ],
  "compliance": {
    "import_case_id": "import-uuid",
    "import_status": "NOT_REGISTERED",
    "ddl_status": "APPROVED",
    "ddl_address": "Leveransgatan 123, 123 45 Stockholm",
    "latest_5369_version": 1,
    "latest_5369_generated_at": "2026-01-20T10:30:00Z"
  }
}
```

**Compliance Summary (EU Orders Only):**
- `import_case_id`: UUID of linked import case (null if not linked)
- `import_status`: Status of import case (NOT_REGISTERED, SUBMITTED, APPROVED, REJECTED)
- `ddl_status`: Status of Direct Delivery Location (APPROVED, PENDING, REJECTED)
- `ddl_address`: Formatted delivery address
- `latest_5369_version`: Version number of latest 5369 document
- `latest_5369_generated_at`: Timestamp when latest 5369 was generated

**Errors:**
- `401` - Missing authentication context
- `403` - User lacks RESTAURANT role or order doesn't belong to restaurant
- `404` - Order not found
- `500` - Internal server error

---

## UI Pages

### /orders (Order List Page)

**File:** `app/orders/page.tsx`

**Features:**
- List all orders for restaurant
- Status filter buttons (ALL, CONFIRMED, IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)
- Order table with columns:
  - Order ID (truncated)
  - Supplier (with EU/Swedish icon)
  - Importer
  - Status badge
  - Lines count
  - Total quantity
  - Compliance status badge (for EU orders)
  - Created date
  - Action button (Visa →)
- Click row or button to navigate to order detail
- Refresh button
- Loading and error states

**Actor Resolution:**
- Fetches `/api/me/actor` on mount
- Verifies RESTAURANT role
- Shows error if role missing with "Tillbaka" button

**Visual:**
```
┌─────────────────────────────────────────────────────┐
│ 📦 Mina Orders                        🔄 Refresh    │
│    Följ dina beställningar                          │
└─────────────────────────────────────────────────────┘

[Alla] [Bekräftad] [I leverans] [Skickad] [Levererad] [Avbruten]

┌─────────────────────────────────────────────────────┐
│ Orders (3)                                          │
├─────────────────────────────────────────────────────┤
│ Order ID  │ Leverantör      │ Status    │ Åtgärd   │
├─────────────────────────────────────────────────────┤
│ abc-123...│ 🇪🇺 Test Winery │ Bekräftad │ Visa →   │
│ def-456...│ 🇸🇪 Systemet AB │ Skickad   │ Visa →   │
└─────────────────────────────────────────────────────┘
```

---

### /orders/[id] (Order Detail Page)

**File:** `app/orders/[id]/page.tsx`

**Features:**
- Order summary card with:
  - Supplier info (name, type, email)
  - Importer info (name, email)
  - Order metadata (lines, quantity, currency, created date)
  - Status badge
- Compliance section (read-only, EU orders only):
  - Import case status badge
  - DDL status badge with address
  - 5369 document version info
  - Note: "Compliance status is managed by the IOR"
- Order lines table:
  - Line number, wine name, producer, vintage, country
  - Quantity, unit, unit price, total price
- Events timeline:
  - Chronological list of order events
  - Event type, status transitions, notes, actor
  - Visual timeline with dots and lines
- Back button to return to list

**Actor Resolution:**
- Fetches `/api/me/actor` on mount
- Verifies RESTAURANT role
- Verifies order ownership

**Visual:**
```
┌─────────────────────────────────────────────────────┐
│ ← Tillbaka  Order abc-123...                        │
│             Order detaljer                          │
└─────────────────────────────────────────────────────┘

┌─ Order Summary ─────────────────────────────────────┐
│ Status: [Bekräftad]                                 │
│                                                     │
│ Leverantör          │ Importör (IOR)               │
│ Test Winery AB      │ Swedish IOR AB               │
│ EU_PRODUCER         │ ior@example.se               │
└─────────────────────────────────────────────────────┘

┌─ Compliance Status (EU Order) ──────────────────────┐
│ Import Case Status    [NOT_REGISTERED]              │
│ Import ID: import-uuid                              │
│                                                     │
│ Direct Delivery Location (DDL)    [APPROVED]       │
│ Leveransgatan 123, 123 45 Stockholm                │
│                                                     │
│ 5369 Document    [Version 1]                       │
│ Generated: 2026-01-20 10:30                        │
│                                                     │
│ 📋 Compliance status is managed by the IOR.        │
└─────────────────────────────────────────────────────┘

┌─ Order Rader (3) ───────────────────────────────────┐
│ #  │ Vin             │ Antal │ Á-pris │ Totalt     │
│ 1  │ Château Test... │ 12    │ 150 kr │ 1,800 kr   │
│ 2  │ Burgundy Red... │ 6     │ 200 kr │ 1,200 kr   │
└─────────────────────────────────────────────────────┘

┌─ Event Timeline (2) ────────────────────────────────┐
│ ● ORDER_CREATED                    2026-01-20 10:00 │
│ │ → CONFIRMED                                       │
│ │ Av: System                                        │
│ │                                                   │
│ ● STATUS_CHANGED                   2026-01-20 11:00 │
│   CONFIRMED → IN_FULFILLMENT                        │
│   Av: Swedish IOR AB                                │
└─────────────────────────────────────────────────────┘
```

---

## Security

### Tenant Isolation
✅ All queries filtered by `tenant_id`
✅ Orders scoped to restaurant's tenant

### Restaurant Ownership
✅ Order detail endpoint verifies `order.restaurant_id === actor.restaurant_id`
✅ List endpoint only returns orders for actor's restaurant

### No Sensitive Fields
✅ No external market prices exposed
✅ Internal offer prices shown (OK - part of accepted offer)
✅ No supplier cost data exposed

### Actor-Based Auth
✅ No hardcoded restaurant IDs
✅ Dynamic resolution via `actorService`
✅ RESTAURANT role required

---

## Testing

### Smoke Test Script

**File:** `scripts/mvp-restaurant-order-tracking-smoke.sh`

**What it tests:**
1. Actor resolution (RESTAURANT role verification)
2. Create request (restaurant initiates)
3. Create offer (supplier responds)
4. Accept offer (order created)
5. List orders via `/api/restaurant/orders`
6. Get order detail via `/api/restaurant/orders/[id]`
7. Verify lines, events, compliance summary

**Setup:**
```bash
# Set test IDs
export RESTAURANT_ID="your-restaurant-id"
export SUPPLIER_ID="your-supplier-id"

# User must be mapped in restaurant_users table:
# INSERT INTO restaurant_users (user_id, restaurant_id, tenant_id)
# VALUES ('00000000-0000-0000-0000-000000000001', 'your-restaurant-id', 'tenant-id');
```

**Run test:**
```bash
# Start dev server
npm run dev

# Run smoke test
bash scripts/mvp-restaurant-order-tracking-smoke.sh
```

**Expected output:**
```
✓ PASS - Actor context retrieved
✓ PASS - User has RESTAURANT role
✓ PASS - Restaurant ID resolved
✓ PASS - Request created
✓ PASS - Offer created
✓ PASS - Offer accepted
✓ PASS - Order created
✓ PASS - Orders list retrieved
✓ PASS - Created order found in list
✓ PASS - Order detail retrieved
✓ PASS - Order status is CONFIRMED
✓ PASS - Order has lines
✓ PASS - Order has events
✓ PASS - Compliance summary present

✅ ALL TESTS PASSED
```

---

## Manual Testing (as Restaurant User)

### Prerequisites

1. **User must have RESTAURANT role:**
   ```sql
   -- Add user to restaurant_users table
   INSERT INTO restaurant_users (user_id, restaurant_id, tenant_id, created_at)
   VALUES (
     '00000000-0000-0000-0000-000000000001',  -- MVP test user
     'your-restaurant-id',
     '00000000-0000-0000-0000-000000000001',  -- tenant
     NOW()
   );
   ```

2. **At least one order exists:**
   - Create request → supplier creates offer → accept offer → order created

### Testing Steps

1. **Navigate to orders list:**
   ```
   http://localhost:3000/orders
   ```

2. **Verify UI:**
   - See list of orders
   - Status badges displayed correctly
   - Compliance column shows status for EU orders
   - Filter buttons work

3. **Click on an order:**
   - Navigate to detail page
   - Verify all sections display:
     - Order summary
     - Compliance section (if EU order)
     - Order lines table
     - Events timeline

4. **Test actor resolution:**
   - Remove user from `restaurant_users` table
   - Reload page
   - Should see: "Du saknar RESTAURANT-behörighet"
   - Re-add user
   - Reload → access restored

5. **Test cross-tenant isolation:**
   - Try to access order from different tenant
   - Should get 403 or 404 error

---

## Database Schema

### restaurant_users (User → Restaurant Mapping)

```sql
CREATE TABLE restaurant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, restaurant_id)
);

CREATE INDEX idx_restaurant_users_user ON restaurant_users(user_id);
CREATE INDEX idx_restaurant_users_restaurant ON restaurant_users(restaurant_id);
CREATE INDEX idx_restaurant_users_tenant ON restaurant_users(tenant_id);
```

**Note:** This table should already exist from previous features. If not, create it.

---

## Compliance Summary (Read-Only)

The compliance summary is **read-only** for restaurants. They can see the status but cannot modify it.

**Why read-only?**
- Compliance is managed by IOR (Importer-of-Record)
- Restaurant needs visibility but not control
- Prevents accidental changes to compliance data
- Restaurant can contact IOR if issues arise

**What restaurants can see:**
- Import case status (NOT_REGISTERED, SUBMITTED, APPROVED, REJECTED)
- DDL status (APPROVED, PENDING, REJECTED)
- DDL delivery address
- Latest 5369 document version and generation date

**What restaurants cannot do:**
- Create or update import cases
- Approve/reject DDL
- Generate 5369 documents
- Modify import case status

---

## Email Notifications

### ORDER_STATUS_UPDATED (Implemented)

Restaurants receive automatic email notifications when order status changes.

**Triggers:**
- IOR manually updates order status (POST /api/ior/orders/[id]/status)
- Import case approved → order auto-confirmed (POST /api/imports/[id]/status with `to_status=APPROVED`)

**Recipients:**
- All active `restaurant_users` linked to the order's restaurant
- Fallback to `restaurants.contact_email` if no active users

**Email Content:**
- Swedish subject with status icon (e.g., "✓ Din order har uppdaterats: Bekräftad")
- Restaurant name
- Order ID (truncated)
- New status with Swedish translation + icon:
  - `CONFIRMED` → "✓ Bekräftad" (blue)
  - `IN_FULFILLMENT` → "📦 I leverans" (orange)
  - `SHIPPED` → "🚚 Skickad" (purple)
  - `DELIVERED` → "✅ Levererad" (green)
  - `CANCELLED` → "❌ Avbruten" (red)
- Status-specific message (e.g., "Din order är nu på väg!")
- Deep link to order detail page: `/orders/[id]`

**Security:**
- Email addresses masked in `order_events` logs (`m***@example.com`)
- No price data included in emails
- Fail-safe: Email failures do not block status updates

**Auto-Confirmation Flow:**

When import case is approved, linked orders are automatically confirmed:

```
Import Case → APPROVED
    ↓
Find linked orders (orders.import_id = import.id)
    ↓
Auto-confirm order (if not already IN_FULFILLMENT+)
    ↓
Log STATUS_AUTO_UPDATED event
    ↓
Send ORDER_STATUS_UPDATED email to restaurant
```

**Benefits:**
- **No Manual Updates Needed:** Orders confirmed automatically after compliance clearance
- **Instant Restaurant Visibility:** Email notification sent immediately
- **Full Audit Trail:** `STATUS_AUTO_UPDATED` event logged in `order_events`

**Example Email Event (order_events):**

```json
{
  "event_type": "MAIL_SENT",
  "actor_user_id": null,
  "actor_name": "System",
  "metadata": {
    "template": "ORDER_STATUS_UPDATED",
    "to_masked": "r***@restaurant.com",
    "success": true
  }
}
```

---

## Future Enhancements

### Additional Notifications (Phase 2)
- Push notifications for mobile app
- SMS alerts for important status changes
- Configurable notification preferences per user

### Delivery Tracking (Phase 2)
- Tracking number display
- Estimated delivery date
- Carrier information
- Real-time tracking link

### Document Downloads (Phase 2)
- Download 5369 documents (PDF)
- Download delivery notes
- Download invoices

### Order Filters (Phase 2)
- Date range filter
- Supplier filter
- Search by order ID or wine name

### Export (Phase 2)
- Export orders to CSV/Excel
- Export for accounting integration

---

## Related Documentation

- **Actor Service:** `lib/actor-service.ts`
- **Order Service:** `lib/order-service.ts`
- **IOR Compliance Flow:** `docs/IOR_COMPLIANCE_FLOW.md`
- **API Endpoints:** `/api/restaurant/orders/*`

---

## Migration Checklist

When deploying this feature:

- [ ] Verify `restaurant_users` table exists
- [ ] Add test users to `restaurant_users` table
- [ ] Test actor resolution with `/api/me/actor`
- [ ] Verify RESTAURANT role returned for test user
- [ ] Create test order (request → offer → accept)
- [ ] Test `/api/restaurant/orders` endpoint
- [ ] Test `/api/restaurant/orders/[id]` endpoint
- [ ] Load `/orders` UI page
- [ ] Load `/orders/[id]` UI page
- [ ] Run smoke test script
- [ ] Verify compliance summary shows for EU orders
- [ ] Verify tenant isolation (try cross-tenant access)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
**Author:** Claude Code (MVP Implementation)
