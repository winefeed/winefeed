# Pilot Seed Kit - Winefeed Golden Path Demo

## Overview

The Pilot Seed Kit creates a complete EU order + compliance demonstration with a single command. It sets up all necessary entities, creates a full order flow, and provides URLs to test every view in the system.

**Goal:** Enable instant pilot demonstrations without manual data entry.

**Key Features:**
- Complete golden path: Request → Offer → Accept → Order → Import Case
- Multi-role user setup (RESTAURANT + SELLER + IOR)
- EU supplier with approved DDL
- Auto-created import case
- Ready-to-click URLs for all views

---

## Quick Start

```bash
# Prerequisites: Dev server running
npm run dev

# Run pilot seed
bash scripts/pilot-seed.sh
```

**Output:**
```
🎉 Pilot Seed Complete!

📱 Open these URLs in your browser:

RESTAURANT VIEW (Order Tracking):
🍷 View Request:  http://localhost:3000/dashboard/requests/[id]
📋 View All Orders: http://localhost:3000/orders
📦 View Order:    http://localhost:3000/orders/[id]

IOR VIEW (Compliance Console):
🏛️  View All Orders: http://localhost:3000/ior/orders
📑 View Order:     http://localhost:3000/ior/orders/[id]
🛂 View Import:    http://localhost:3000/imports/[id]

🔑 Test IDs (for manual testing):
TENANT_ID="00000000-0000-0000-0000-000000000001"
RESTAURANT_ID="..."
SUPPLIER_ID="..."
IMPORTER_ID="..."
ORDER_ID="..."
```

---

## What Gets Created

### 1. Restaurant Setup
**Table: `restaurants`**
- Name: `Pilot Restaurant [timestamp]`
- Contact: pilot@restaurant.se
- Address: Restauranggatan 1, Stockholm

**Table: `restaurant_users`**
- Maps `USER_ID` → `RESTAURANT_ID`
- Gives user RESTAURANT role

### 2. Direct Delivery Location (DDL)
**Table: `direct_delivery_locations`**
- Restaurant: Created restaurant
- Address: Leveransgatan 123, 123 45 Stockholm
- Status: **APPROVED** (ready for import cases)
- Contact: Lars Larsson

### 3. Importer (IOR)
**Table: `importers`**
- Legal Name: `Pilot IOR AB [timestamp]`
- Org Number: `556789-1234` (shared with supplier)
- License: LIC-12345 (verified)
- Contact: erik@pilotior.se
- Status: Active

### 4. EU Supplier
**Table: `suppliers`**
- Name: `Pilot EU Winery [timestamp]`
- Type: **EU_PRODUCER** (triggers import case flow)
- Org Number: `556789-1234` (matches importer for dual-role)
- Default IOR: Created importer ID
- Country: France

**Table: `supplier_users`**
- Maps `USER_ID` → `SUPPLIER_ID`
- Gives user SELLER role

### 5. Wine Request
**Table: `requests`**
- Restaurant: Created restaurant
- Title: `Pilot Wine Request [timestamp]`
- Status: OPEN

**Table: `request_wines`**
- Wine: Château Pilot 2020
- Producer: Pilot Winery
- Country: France, Region: Bordeaux
- Quantity: 24 bottles

### 6. Offer
**Table: `offers`**
- Restaurant: Created restaurant
- Supplier: Created EU supplier
- Title: `Pilot Offer [timestamp]`
- Currency: SEK
- Status: ACCEPTED (after accept)

**Table: `offer_lines`**
- Wine: Château Pilot 2020
- Quantity: 24 bottles
- Price: 150 SEK/bottle (15000 öre)
- Packaging: Hel låda 24st

### 7. Order (via Accept Endpoint)
**Table: `orders`**
- Created via: `POST /api/offers/[id]/accept`
- Restaurant: Created restaurant
- Supplier: Created EU supplier
- IOR: Created importer
- Status: CONFIRMED

**Table: `order_lines`**
- Copied from offer lines
- Wine details preserved

**Table: `order_events`**
- Event: ORDER_CREATED
- Actor: System

### 8. Import Case (Auto-Created)
**Table: `imports`**
- Restaurant: Created restaurant
- Importer: Created importer
- DDL: Created approved DDL
- Status: NOT_REGISTERED
- **Auto-created** when order created (EU supplier + approved DDL)

---

## Multi-Role User

The seed creates a user with **three roles**:

### 1. RESTAURANT Role
- Via `restaurant_users` table
- Can view orders in `/orders`
- Can create requests

### 2. SELLER Role
- Via `supplier_users` table
- Can create offers
- Can view supplier dashboard

### 3. IOR Role
- Via **org_number matching** (suppliers.org_number = importers.org_number)
- Can view IOR console at `/ior/orders`
- Can manage compliance
- Can update order status

**Actor Resolution:**
```bash
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
     http://localhost:3000/api/me/actor

# Response:
{
  "roles": ["RESTAURANT", "SELLER", "IOR"],
  "restaurant_id": "...",
  "supplier_id": "...",
  "importer_id": "..."
}
```

---

## Prerequisites

### 1. Dev Server Running
```bash
npm run dev
```

### 2. Environment Variables
**.env.local:**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Migrations Applied
All tables must exist:
- restaurants, restaurant_users
- suppliers, supplier_users
- importers
- direct_delivery_locations
- requests, request_wines
- offers, offer_lines
- orders, order_lines, order_events
- imports

---

## Usage

### Option 1: Via Bash Script (Recommended)

```bash
bash scripts/pilot-seed.sh
```

**Checks:**
- ✓ .env.local exists
- ✓ Dev server running on localhost:3000
- ✓ Required env vars set
- ✓ Runs TypeScript seed script
- ✓ Handles errors gracefully

### Option 2: Direct TypeScript

```bash
# Load env vars
source .env.local

# Run script
npx ts-node scripts/pilot-seed.ts
```

---

## Script Flow

```
1. Create Restaurant
   └─> Map USER_ID to restaurant (restaurant_users)

2. Create Approved DDL
   └─> Status: APPROVED (required for import case)

3. Create Importer (IOR)
   └─> Org Number: 556789-1234

4. Create EU Supplier
   ├─> Type: EU_PRODUCER (triggers compliance)
   ├─> Org Number: 556789-1234 (matches importer)
   └─> Default IOR: Importer ID

5. Map USER_ID to Supplier (supplier_users)
   └─> Enables dual-role (RESTAURANT + SELLER + IOR)

6. Create Request
   └─> From restaurant, with wine details

7. Create Offer
   └─> From supplier, responding to request

8. Accept Offer (via API)
   ├─> Creates order
   ├─> Copies offer lines to order lines
   ├─> Creates ORDER_CREATED event
   └─> Auto-creates import case (EU + DDL approved)

9. Verify Import Case
   └─> Check orders.import_id is set

10. Print URLs
    └─> Ready to test all views
```

---

## Output Example

```
════════════════════════════════════════
🌟 Winefeed Pilot Seed Kit
════════════════════════════════════════

📍 Step 1: Create Restaurant...
   ✓ Restaurant: Pilot Restaurant 1737369600000 (uuid)

👤 Step 2: Map User to Restaurant...
   ✓ User 00000000-0000-0000-0000-000000000001 → Restaurant uuid

🏢 Step 3: Create Approved DDL...
   ✓ DDL: Leveransgatan 123, Stockholm (uuid)

🇸🇪 Step 4: Create Importer (IOR)...
   ✓ Importer: Pilot IOR AB 1737369600000 (uuid)
   ✓ Org Number: 556789-1234

🇪🇺 Step 5: Create EU Supplier...
   ✓ Supplier: Pilot EU Winery 1737369600000 (uuid)
   ✓ Type: EU_PRODUCER
   ✓ Default IOR: uuid

👥 Step 6: Map User to Supplier (Dual-Role)...
   ✓ User 00000000-0000-0000-0000-000000000001 → Supplier uuid
   ✓ User now has both RESTAURANT and SELLER roles
   ✓ IOR role via org_number matching: 556789-1234

📝 Step 7: Create Wine Request...
   ✓ Request: Pilot Wine Request 1737369600000 (uuid)

💰 Step 8: Create Offer...
   ✓ Offer: Pilot Offer 1737369600000 (uuid)

✅ Step 9: Accept Offer (Create Order)...
   ✓ Order: uuid
   ✓ Status: CONFIRMED

🔍 Step 10: Verify Import Case Auto-Created...
   ✓ Import Case: uuid
   ✓ Status: NOT_REGISTERED
   ✓ DDL: uuid

════════════════════════════════════════
🎉 Pilot Seed Complete!
════════════════════════════════════════

📱 Open these URLs in your browser:

─────────────────────────────────────────
RESTAURANT VIEW (Order Tracking):
─────────────────────────────────────────
🍷 View Request:  http://localhost:3000/dashboard/requests/uuid
📋 View All Orders: http://localhost:3000/orders
📦 View Order:    http://localhost:3000/orders/uuid

─────────────────────────────────────────
SUPPLIER VIEW (Seller Dashboard):
─────────────────────────────────────────
💼 View Offer:    http://localhost:3000/supplier/offers/uuid

─────────────────────────────────────────
IOR VIEW (Compliance Console):
─────────────────────────────────────────
🏛️  View All Orders: http://localhost:3000/ior/orders
📑 View Order:     http://localhost:3000/ior/orders/uuid
🛂 View Import:    http://localhost:3000/imports/uuid

─────────────────────────────────────────
ADMIN VIEW (Pilot Dashboard):
─────────────────────────────────────────
⚙️  Pilot Admin:   http://localhost:3000/admin/pilot

════════════════════════════════════════
🔑 Test IDs (for manual testing):
════════════════════════════════════════
TENANT_ID="00000000-0000-0000-0000-000000000001"
USER_ID="00000000-0000-0000-0000-000000000001"
RESTAURANT_ID="uuid"
SUPPLIER_ID="uuid"
IMPORTER_ID="uuid"
REQUEST_ID="uuid"
OFFER_ID="uuid"
ORDER_ID="uuid"
IMPORT_ID="uuid"

💡 Tip: Use these IDs in smoke tests and manual testing

🎯 Actor Roles for USER_ID:
   - RESTAURANT (via restaurant_users)
   - SELLER (via supplier_users)
   - IOR (via org_number matching: 556789-1234)

✅ Ready for pilot demonstration!
```

---

## Testing the Pilot Demo

### 1. Restaurant View

**View All Orders:**
```
http://localhost:3000/orders
```
- Should see 1 order (CONFIRMED status)
- Compliance column shows import case status
- Click "Visa →" to see details

**View Order Detail:**
```
http://localhost:3000/orders/[ORDER_ID]
```
- Order summary with supplier and IOR info
- Compliance section (EU order):
  - Import case status: NOT_REGISTERED
  - DDL status: APPROVED
  - DDL address displayed
- Order lines table (24 bottles Château Pilot 2020)
- Events timeline (ORDER_CREATED event)

### 2. IOR View

**View All Orders:**
```
http://localhost:3000/ior/orders
```
- Should see 1 order
- Can filter by status
- Click to see order detail

**View Order Detail:**
```
http://localhost:3000/ior/orders/[ORDER_ID]
```
- Full order details
- Compliance section with:
  - Import case status
  - DDL status
  - 5369 document section (not generated yet)
- Can update order status (CONFIRMED → IN_FULFILLMENT)

**View Import Case:**
```
http://localhost:3000/imports/[IMPORT_ID]
```
- Import case details
- DDL information
- Can update import status
- Can generate 5369 document

### 3. Admin View

**Pilot Dashboard:**
```
http://localhost:3000/admin/pilot
```
- Overview of all pilot data
- Quick links to all entities
- Test IDs displayed

---

## Troubleshooting

### Error: Dev server not running

**Problem:**
```
❌ Error: Dev server not running on http://localhost:3000
```

**Solution:**
```bash
npm run dev
```

### Error: Missing environment variables

**Problem:**
```
❌ Error: Missing required environment variables
```

**Solution:**
Create `.env.local` with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Error: Failed to accept offer

**Problem:**
```
Failed to accept offer: 500 Internal Server Error
```

**Common Causes:**
1. Dev server not running
2. Missing migrations (orders table doesn't exist)
3. Missing service functions (order-service.ts)

**Solution:**
```bash
# Check dev server logs
# Verify all migrations applied
# Check Supabase dashboard for errors
```

### Import Case Not Auto-Created

**Problem:**
```
⚠ Import Case NOT auto-created (check logs)
```

**Common Causes:**
1. DDL not approved (status must be APPROVED)
2. Supplier not EU type (must be EU_PRODUCER or EU_IMPORTER)
3. Import service error (check server logs)

**Solution:**
```bash
# Check DDL status
SELECT status FROM direct_delivery_locations WHERE id = 'DDL_ID';

# Check supplier type
SELECT type FROM suppliers WHERE id = 'SUPPLIER_ID';

# Check server logs for import case creation errors
```

### User Missing Roles

**Problem:**
Actor endpoint returns empty roles:
```json
{ "roles": [] }
```

**Solution:**
```bash
# Re-run seed script (creates mappings)
bash scripts/pilot-seed.sh

# Or manually check:
SELECT * FROM restaurant_users WHERE user_id = 'USER_ID';
SELECT * FROM supplier_users WHERE user_id = 'USER_ID';
```

---

## Cleanup

To remove pilot data (optional):

```sql
-- Delete in reverse order (respects foreign keys)
DELETE FROM order_events WHERE order_id IN (
  SELECT id FROM orders WHERE restaurant_id IN (
    SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
  )
);

DELETE FROM order_lines WHERE order_id IN (
  SELECT id FROM orders WHERE restaurant_id IN (
    SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
  )
);

DELETE FROM imports WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
);

DELETE FROM orders WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
);

DELETE FROM offer_lines WHERE offer_id IN (
  SELECT id FROM offers WHERE restaurant_id IN (
    SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
  )
);

DELETE FROM offers WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
);

DELETE FROM request_wines WHERE request_id IN (
  SELECT id FROM requests WHERE restaurant_id IN (
    SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
  )
);

DELETE FROM requests WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
);

DELETE FROM direct_delivery_locations WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
);

DELETE FROM supplier_users WHERE supplier_id IN (
  SELECT id FROM suppliers WHERE namn LIKE 'Pilot EU Winery%'
);

DELETE FROM suppliers WHERE namn LIKE 'Pilot EU Winery%';

DELETE FROM restaurant_users WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE name LIKE 'Pilot Restaurant%'
);

DELETE FROM restaurants WHERE name LIKE 'Pilot Restaurant%';

DELETE FROM importers WHERE legal_name LIKE 'Pilot IOR AB%';
```

**Note:** Only deletes pilot-seeded data (identified by naming pattern).

---

## Integration with Smoke Tests

Use the generated IDs in smoke tests:

```bash
# After running pilot-seed.sh, copy the test IDs

# Run restaurant order tracking smoke test
export RESTAURANT_ID="[from pilot seed]"
export SUPPLIER_ID="[from pilot seed]"
bash scripts/mvp-restaurant-order-tracking-smoke.sh

# Run IOR smoke test
export RESTAURANT_ID="[from pilot seed]"
export EU_SUPPLIER_ID="[from pilot seed]"
# No need to export IMPORTER_ID - resolved via actor
bash scripts/mvp-eu-order-ior-smoke.sh
```

---

## Customization

To customize the seed data, edit `scripts/pilot-seed.ts`:

### Change Restaurant Details
```typescript
const { data, error } = await supabase
  .from('restaurants')
  .insert({
    name: 'Your Restaurant Name',  // <-- Change here
    contact_email: 'your@email.com',
    // ...
  })
```

### Change Wine Details
```typescript
await supabase.from('request_wines').insert({
  namn: 'Your Wine Name',          // <-- Change here
  producent: 'Your Producer',
  land: 'Italy',                    // <-- Change country
  // ...
});
```

### Change Org Number (Dual-Role)
```typescript
const ORG_NUMBER = '556789-1234';  // <-- Change at top of file
```

---

## Related Documentation

- **Actor Service:** `lib/actor-service.ts`
- **Order Service:** `lib/order-service.ts`
- **Import Service:** `lib/import-service.ts`
- **IOR Compliance Flow:** `docs/IOR_COMPLIANCE_FLOW.md`
- **Restaurant Order Tracking:** `docs/RESTAURANT_ORDER_TRACKING.md`

---

## CI/CD Integration

To use in CI/CD pipeline:

```yaml
# .github/workflows/pilot-seed.yml
name: Pilot Seed Test
on: [push]

jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2

      - name: Install dependencies
        run: npm install

      - name: Start dev server
        run: npm run dev &

      - name: Wait for server
        run: sleep 10

      - name: Run pilot seed
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}
        run: bash scripts/pilot-seed.sh
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
**Author:** Claude Code (MVP Implementation)
