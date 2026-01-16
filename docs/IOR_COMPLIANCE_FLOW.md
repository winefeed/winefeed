# IOR COMPLIANCE FLOW - Orders ↔ Import Cases Integration

## Overview

This document describes how orders are integrated with import cases for EU compliance tracking in the IOR (Importer-of-Record) operational flow.

**Goal:** Enable IOR to manage both fulfillment (orders) and compliance (import cases) in a unified view.

**Key Features:**
- Auto-create import cases for EU orders (when DDL available)
- Link orders to import cases via `orders.import_id`
- View compliance status in IOR order detail page
- Manual import case creation for orders (on-demand)
- Dynamic actor resolution for IOR access (no hardcoded IDs)

---

## Authentication & Actor Resolution

**New in this version:** IOR endpoints now use dynamic actor resolution instead of hardcoded importer IDs.

### How It Works

1. **Client sends authentication headers:**
   ```
   x-tenant-id: <tenant_uuid>
   x-user-id: <user_uuid>
   ```

2. **Server resolves actor context:**
   - Calls `actorService.resolveActor()` with user_id and tenant_id
   - Checks `restaurant_users`, `supplier_users` for role membership
   - Matches `suppliers.org_number` ↔ `importers.org_number` for IOR role
   - Returns actor with roles and entity IDs

3. **IOR verification:**
   - Verifies user has IOR role: `actorService.hasIORAccess(actor)`
   - Uses resolved `actor.importer_id` for all operations
   - No manual ID passing required

### Actor Endpoint

**GET /api/me/actor**

Returns current user's actor context:

```json
{
  "tenant_id": "uuid",
  "user_id": "uuid",
  "roles": ["RESTAURANT", "SELLER", "IOR"],
  "restaurant_id": "uuid",
  "supplier_id": "uuid",
  "importer_id": "uuid",
  "user_email": "user@example.com"
}
```

**Used by:**
- IOR UI pages (`/ior/orders`, `/ior/orders/[id]`)
- Client-side role verification
- Dynamic importer_id resolution

**Benefits:**
- No hardcoded IDs in UI code
- Works in pilot/production without manual editing
- Dual-role support (same user can be SELLER + IOR)
- Tenant-scoped and secure

---

## Database Schema

### New Column: `orders.import_id`

```sql
ALTER TABLE orders
ADD COLUMN import_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_import ON orders(import_id);
CREATE INDEX idx_orders_tenant_import ON orders(tenant_id, import_id);
```

**Purpose:** Link operational orders to compliance import cases.

**Nullability:** Nullable - not all orders require import cases (e.g., Swedish domestic orders).

---

## Auto-Creation Flow

### When Does Auto-Creation Happen?

Auto-creation is attempted when:
1. Offer is accepted → order created
2. Supplier is EU type (`EU_PRODUCER` or `EU_IMPORTER`)
3. Restaurant has an approved DDL (Direct Delivery Location)

### Flow Diagram

```
Offer ACCEPTED
    ↓
createOrderFromAcceptedOffer()
    ↓
Check: Is supplier EU_PRODUCER or EU_IMPORTER?
    ├─ NO  → Order created WITHOUT import case (Swedish domestic)
    └─ YES → Attempt auto-create import case
           ↓
       Find restaurant's approved DDL
           ├─ Found     → Create import case + link to order
           └─ Not Found → Order created WITHOUT import case
                         (IOR can create manually later via UI)
```

### Auto-Creation Logic

**File:** `lib/order-service.ts:305-323`

```typescript
// After order creation, if EU supplier:
if (supplier.type === 'EU_PRODUCER' || supplier.type === 'EU_IMPORTER') {
  try {
    const importResult = await this.createImportCaseForOrder({
      order_id: order.id,
      tenant_id,
      actor_user_id
    });
    console.log(`✓ Import case ${importResult.import_id} auto-created`);
  } catch (importError) {
    console.warn(`⚠️  Could not auto-create import case:`, importError.message);
    // Order is still valid - IOR can create manually later
  }
}
```

**Fail-Safe Behavior:**
- If DDL not found → Order created WITHOUT import case
- If import case creation fails → Order creation succeeds (logged but not thrown)
- IOR can always create import case manually later via UI

---

## Auto-Confirmation Flow

### What is Auto-Confirmation?

When an import case status is set to **APPROVED**, all linked orders are automatically confirmed. This reduces manual handpåläggning and ensures orders progress immediately after compliance approval.

### When Does Auto-Confirmation Happen?

Auto-confirmation triggers when:
1. Import case status is updated to `APPROVED` (via POST /api/imports/[id]/status)
2. Order is linked to the import case (`orders.import_id` matches)
3. Order status is not already in a later stage (IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)

### Flow Diagram

```
Import Case Status → APPROVED
    ↓
Find all linked orders (orders.import_id = import.id)
    ↓
For each order:
    ├─ Status = CONFIRMED?          → Skip (already confirmed)
    ├─ Status = IN_FULFILLMENT+?    → Skip (already progressed)
    └─ Status = other?              → Update to CONFIRMED
           ↓
       Log STATUS_AUTO_UPDATED event
           ↓
       Send ORDER_STATUS_UPDATED email (fail-safe)
```

### Auto-Confirmation Logic

**File:** `app/api/imports/[id]/status/route.ts:42-177`

```typescript
// After import status update to APPROVED:
if (to_status === 'APPROVED') {
  // Find orders linked to this import case
  const { data: linkedOrders } = await supabase
    .from('orders')
    .select('id, status, restaurant_id')
    .eq('tenant_id', tenantId)
    .eq('import_id', importId);

  for (const order of linkedOrders) {
    // Skip if already in later status
    const laterStatuses = [OrderStatus.IN_FULFILLMENT, OrderStatus.SHIPPED,
                          OrderStatus.DELIVERED, OrderStatus.CANCELLED];
    if (laterStatuses.includes(order.status)) continue;

    // Update to CONFIRMED (if not already)
    if (order.status !== OrderStatus.CONFIRMED) {
      await supabase.from('orders').update({
        status: OrderStatus.CONFIRMED,
        updated_at: new Date().toISOString()
      }).eq('id', order.id);

      // Log event: STATUS_AUTO_UPDATED
      await supabase.from('order_events').insert({
        tenant_id, order_id: order.id,
        event_type: 'STATUS_AUTO_UPDATED',
        from_status: order.status,
        to_status: OrderStatus.CONFIRMED,
        note: `Order automatically confirmed after import case ${importId} was approved`,
        metadata: { import_id: importId, trigger: 'IMPORT_APPROVED' },
        actor_user_id: null, actor_name: 'System'
      });

      // Send ORDER_STATUS_UPDATED email (fail-safe)
      const recipients = await getRestaurantRecipients(order.restaurant_id, tenantId);
      for (const email of recipients) {
        await sendEmail({ to: email, subject, html, text });
        await logOrderEmailEvent(tenantId, order.id, { type: 'ORDER_STATUS_UPDATED', to: email });
      }
    }
  }
}
```

### Email Notification

When order is auto-confirmed:
- **Template:** `ORDER_STATUS_UPDATED`
- **Recipient:** All active restaurant_users (via `getRestaurantRecipients()`)
- **Subject:** "✓ Din order har uppdaterats: Bekräftad"
- **Content:** Order confirmed notification with deep link to `/orders/[id]`
- **Fail-Safe:** Email failures do not block status update

### Event Logging

**New Event Type:** `STATUS_AUTO_UPDATED`

```json
{
  "event_type": "STATUS_AUTO_UPDATED",
  "from_status": "CONFIRMED",
  "to_status": "CONFIRMED",
  "note": "Order automatically confirmed after import case abc-123 was approved",
  "metadata": {
    "import_id": "abc-123",
    "trigger": "IMPORT_APPROVED",
    "previous_status": "CONFIRMED"
  },
  "actor_user_id": null,
  "actor_name": "System"
}
```

### Benefits

- **Reduced Manual Work:** IOR doesn't need to manually confirm orders after approval
- **Faster Order Processing:** Orders progress immediately after compliance clearance
- **Audit Trail:** STATUS_AUTO_UPDATED events provide full traceability
- **Restaurant Visibility:** Email notifications keep restaurant informed

---

## Manual Creation Flow

### When to Use Manual Creation?

- Restaurant didn't have approved DDL when order was created
- Auto-creation failed for any reason
- Import case was deleted and needs to be recreated

### How to Create Manually?

**Via UI:**
1. Navigate to `/ior/orders/[id]`
2. If no import case linked, UI shows "Create Import Case" button
3. Click button → Import case created and linked automatically

**Via API:**
```bash
POST /api/ior/orders/[id]/create-import
Headers:
  x-tenant-id: <tenant_id>
  x-importer-id: <importer_id>

Response:
{
  "message": "Import case created and linked successfully",
  "order_id": "uuid",
  "import_id": "uuid"
}
```

---

## API Endpoints

### POST /api/ior/orders/[id]/create-import

**Purpose:** On-demand import case creation for order.

**Authentication:**
- Requires `x-tenant-id` and `x-user-id` headers
- IOR role and importer_id resolved via actor service
- User must have IOR access (verified automatically)

**Requirements:**
- Restaurant must have approved DDL
- Order must NOT already have import case

**Response:**
```json
{
  "message": "Import case created and linked successfully",
  "order_id": "order-uuid",
  "import_id": "import-uuid"
}
```

**Errors:**
- `400` - No approved DDL found
- `401` - Missing authentication context
- `403` - User lacks IOR role or importer_id
- `409` - Order already has import case

---

### POST /api/ior/orders/[id]/link-import

**Purpose:** Manually link order to existing import case.

**Authentication:**
- Requires `x-tenant-id` and `x-user-id` headers
- IOR role and importer_id resolved via actor service
- User must have IOR access (verified automatically)

**Request:**
```json
{
  "import_id": "import-uuid"
}
```

**Validation:**
- Order's IOR must match import case's importer
- Import case must exist and belong to same tenant

**Response:**
```json
{
  "message": "Import case linked successfully",
  "order_id": "order-uuid",
  "import_id": "import-uuid"
}
```

**Errors:**
- `401` - Missing authentication context
- `403` - User lacks IOR role or not authorized for this order
- `404` - Order or import case not found
- `409` - IOR mismatch between order and import case

---

### GET /api/ior/orders/[id]

**Authentication:**
- Requires `x-tenant-id` and `x-user-id` headers
- IOR role and importer_id resolved via actor service
- User must have IOR access (verified automatically)
- Order must belong to user's importer (verified automatically)

**Updated Response:**
```json
{
  "order": {
    "id": "order-uuid",
    "import_case": {
      "id": "import-uuid",
      "status": "NOT_REGISTERED",
      "created_at": "...",
      "delivery_location": {
        "id": "ddl-uuid",
        "status": "APPROVED",
        "delivery_address_line1": "...",
        "postal_code": "...",
        "city": "..."
      }
    },
    "compliance": {
      "import_case_status": "NOT_REGISTERED",
      "ddl_status": "APPROVED",
      "documents_count": 0,
      "latest_5369": null
    }
  },
  "lines": [...],
  "events": [...],
  "documents": []  // 5369 documents for this import case
}
```

**New Fields:**
- `order.import_case` - Full import case data (if linked)
- `order.compliance` - Quick compliance status summary
- `documents` - Array of 5369 documents (latest 5 versions)

**Errors:**
- `401` - Missing authentication context
- `403` - User lacks IOR role or not authorized for this order
- `404` - Order not found

---

## UI - IOR Order Detail Page

### Compliance Section

**Location:** `/ior/orders/[id]` - Between "Order Summary" and "Status Update Actions"

**File:** `app/ior/orders/[id]/page.tsx:379-505`

### Components

#### 1. Import Case Status Card

Shows when import case is linked:
- Import case status badge (NOT_REGISTERED, SUBMITTED, APPROVED, REJECTED)
- Import case ID
- Link to import case detail page

**Visual:**
```
┌─────────────────────────────────────┐
│ Import Case Status    [NOT_REGISTERED] │
│ Import ID: abc-123...                │
│ → Visa import case detaljer          │
└─────────────────────────────────────┘
```

#### 2. DDL Status Card

Shows when DDL is linked to import case:
- DDL status badge (APPROVED, PENDING, REJECTED)
- Delivery address details

**Visual:**
```
┌─────────────────────────────────────┐
│ Direct Delivery Location  [APPROVED]│
│ Leveransgatan 123                   │
│ 123 45 Stockholm                    │
└─────────────────────────────────────┘
```

#### 3. 5369 Documents Card

Shows generated 5369 documents:
- Document count
- Latest versions (up to 3 shown)
- Download buttons
- "Generate 5369" button (if no documents)

**Visual:**
```
┌─────────────────────────────────────┐
│ 5369 Documents          2 version(s)│
│ ┌─────────────────────────────────┐ │
│ │ Version 2           ⬇ Download  │ │
│ │ Generated: 2026-01-19 14:30     │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Version 1           ⬇ Download  │ │
│ │ Generated: 2026-01-19 10:15     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### 4. No Import Case State

Shows when no import case linked:
- Info message explaining why import case is needed
- "Create Import Case" button (for EU orders)

**Visual:**
```
┌─────────────────────────────────────┐
│            📦                        │
│ No import case linked to this order │
│                                     │
│ This is an EU order and requires an │
│ import case for compliance.         │
│                                     │
│      [+ Create Import Case]          │
└─────────────────────────────────────┘
```

---

## Event Logging

### New Event Types

**IMPORT_CASE_LINKED:**
- Triggered when order is linked to import case
- Actor: System or User

**IMPORT_CASE_CREATED:**
- Triggered when import case is created for order
- Metadata includes `import_id` and `delivery_location_id`
- Actor: System (auto-create) or User (manual)

### Example Events Timeline

```
1. ORDER_CREATED        (from accepted offer)
2. IMPORT_CASE_CREATED  (auto-created for EU order)
3. STATUS_CHANGED       (CONFIRMED → IN_FULFILLMENT)
4. STATUS_CHANGED       (IN_FULFILLMENT → SHIPPED)
```

---

## Testing

### Smoke Test Updates

**File:** `scripts/mvp-eu-order-ior-smoke.sh`

**New Tests:**

**TEST 9: Verify Import Case Auto-Created**
- Checks if `order.import_case.id` exists
- Verifies import case status is `NOT_REGISTERED`
- Warns if not created (expected if DDL missing)

**TEST 10: Verify Compliance Data**
- Checks `order.compliance` structure
- Verifies DDL status field
- Verifies documents count field

### Running Tests

```bash
# Set test IDs
export RESTAURANT_ID="your-restaurant-id"
export EU_SUPPLIER_ID="your-eu-supplier-id"  # Must have default_importer_id set
export IMPORTER_ID="your-importer-id"

# Run smoke test
bash scripts/mvp-eu-order-ior-smoke.sh
```

**Expected Results:**
- All tests pass OR
- TEST 9 warns about missing DDL (acceptable)
- Created order has `import_id` set (if DDL available)

---

## Troubleshooting

### Import Case Not Auto-Created

**Symptom:** Order created but `import_id` is NULL.

**Common Causes:**
1. Restaurant has no approved DDL
2. Supplier is not EU type (SWEDISH_IMPORTER)
3. DDL query failed

**Solution:**
```sql
-- Check restaurant has approved DDL
SELECT id, status
FROM direct_delivery_locations
WHERE restaurant_id = 'YOUR_RESTAURANT_ID'
  AND status = 'APPROVED'
ORDER BY created_at DESC;

-- If DDL exists, create import case manually via UI
```

### IOR Mismatch Error

**Symptom:** "IOR mismatch" error when linking import case.

**Cause:** Order's `importer_of_record_id` doesn't match import case's `importer_id`.

**Solution:**
- Verify both order and import case belong to same IOR
- Check that order was created with correct IOR from supplier's `default_importer_id`

### DDL Not Found Error

**Symptom:** "No approved DDL found for restaurant" when creating import case.

**Cause:** Restaurant doesn't have any DDL with status=APPROVED.

**Solution:**
1. Create DDL for restaurant via `/api/direct-delivery-locations`
2. Get DDL approved (status → APPROVED)
3. Retry import case creation

---

## Security & Compliance

### Tenant Isolation

✅ **All operations are tenant-scoped:**
- Orders can only link to import cases in same tenant
- IOR can only access orders where `importer_of_record_id` matches their importer

### IOR Authorization

✅ **IOR verification on all operations:**
- Create import: Verifies order belongs to IOR
- Link import: Verifies both order and import belong to IOR
- View order: Verifies IOR access

### No Price Data Policy

✅ **Maintained in compliance section:**
- Only shows compliance metadata (status, DDL, documents)
- No wine prices or market data exposed
- Order prices (internal) remain in separate order lines section

---

## Future Enhancements

### Automatic 5369 Generation

**Current:** Manual generation via button.

**Future:** Auto-generate 5369 when import case reaches SUBMITTED status.

### Multi-Import Case Support

**Current:** One order → one import case.

**Future:** Support splitting order into multiple import cases (for different DDLs or delivery batches).

### DDL Auto-Selection

**Current:** Uses restaurant's most recent approved DDL.

**Future:** Allow restaurant to specify preferred DDL per order.

### Compliance Notifications

**Future:**
- Email to IOR when import case needs action
- Email to restaurant when 5369 is ready
- SMS alerts for urgent compliance issues

---

## Migration Checklist

When deploying this feature:

- [ ] Apply migration: `20260119_add_import_id_to_orders.sql`
- [ ] Verify `orders.import_id` column exists
- [ ] Verify indexes created
- [ ] Update existing EU suppliers with `default_importer_id`
- [ ] Create at least one approved DDL for test restaurant
- [ ] **Set up actor resolution:**
  - [ ] Verify `supplier_users` table has user mappings
  - [ ] Verify `importers` table has correct org_numbers matching suppliers
  - [ ] Test GET `/api/me/actor` with test user
  - [ ] Verify user gets IOR role and importer_id
- [ ] Run smoke test to verify auto-creation
- [ ] Test manual creation via UI
- [ ] Verify compliance section displays correctly
- [ ] Test 5369 generation (existing endpoint)
- [ ] **Verify no hardcoded IDs in code:**
  - [ ] Search codebase for `IMPORTER_ID` constants (should be removed)
  - [ ] Check IOR UI pages use actor fetch on mount
  - [ ] Verify IOR API endpoints use actor service

---

## Related Documentation

- **Actor Service:** `lib/actor-service.ts` (role resolution)
- **Actor API:** `/api/me/actor` (client-side actor context)
- **Import Service:** `lib/import-service.ts`
- **Order Service:** `lib/order-service.ts`
- **5369 Generation:** `/api/imports/[id]/generate-5369`
- **DDL Management:** `/api/direct-delivery-locations`
- **Original Invites Doc:** `docs/INVITES.md`

---

**Document Version:** 2.0
**Last Updated:** 2026-01-20
**Author:** Claude Code (MVP Implementation)
**Changelog:**
- v2.0 (2026-01-20): Added actor resolution, removed hardcoded IDs
- v1.0 (2026-01-19): Initial IOR compliance flow implementation
