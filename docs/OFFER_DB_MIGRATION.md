# Offer DB Migration - Pilot Loop 1.0

## Overview

Migration of the Offer workflow from `localStorage` to database, enabling a complete pilot loop for real restaurants and suppliers.

**Before:** Offers stored in browser localStorage (dev/demo only)
**After:** Offers stored in PostgreSQL with full audit trail, immutability, and multi-tenancy

---

## What Changed

### **1. Database Schema**

**New Tables:**
- `offers` - Main offer table (DRAFT/SENT/ACCEPTED/REJECTED)
- `offer_lines` - Line items with Wine Check enrichment allowlist
- `offer_events` - Audit trail (CREATED, UPDATED, LINE_UPDATED, ACCEPTED, etc.)

**Key Features:**
- **Multi-line offers:** Each offer can have multiple wine line items
- **Immutability:** Offers lock after acceptance (snapshot + locked_at)
- **Wine Check integration:** Enrichment fields (canonical_name, producer, region, etc.)
- **Security:** NO price data from Wine-Searcher (allowlist only)
- **Audit trail:** All changes logged in offer_events
- **Tenant isolation:** RLS policies enforced

### **2. API Endpoints**

**New Endpoints:**
- `POST /api/offers` - Create offer with lines
- `GET /api/offers/[id]` - Get offer + lines + events
- `PATCH /api/offers/[id]` - Update offer/lines (DRAFT only)
- `POST /api/offers/[id]/accept` - Accept offer (lock + snapshot)

**Updated Endpoint:**
- `POST /api/offers/[id]/accept` - Now uses new multi-line structure

### **3. Service Layer**

**New Service:** `lib/offer-service.ts`
- `createOffer()` - Create with transaction (offer + lines + event)
- `getOffer()` - Load with relations
- `updateOffer()` - Update metadata (DRAFT only)
- `updateOfferLines()` - Update lines (DRAFT only)
- `acceptOffer()` - Lock + snapshot + event

**Security:**
- Validates no forbidden fields in enrichment
- Enforces immutability after acceptance
- Tenant isolation

### **4. UI Updates**

**Updated Pages:**
- `/offers/new` - Now creates DRAFT offer in DB
- `/offers/[id]` - Edit DRAFT, view ACCEPTED (read-only), show events

**Deprecated:**
- `lib/offer-storage.ts` - localStorage-based storage (kept for fallback)

---

## Migration Steps

### **1. Run Database Migrations**

```bash
# Run all offer-related migrations
npx supabase migration up
```

**Migrations:**
- `20260117_create_offers.sql` - offers table + triggers
- `20260117_create_offer_lines.sql` - offer_lines table + triggers
- `20260117_create_offer_events.sql` - offer_events audit table
- `20260117_enable_rls_offers.sql` - RLS policies

### **2. Verify Tables**

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('offers', 'offer_lines', 'offer_events');

-- Check RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('offers', 'offer_lines', 'offer_events');
```

### **3. Test API Endpoints**

```bash
# Run automated smoke test
npm run test:offer:mvp
```

**Tests:**
1. Create offer with 2 lines
2. Get offer
3. Update line with enrichment
4. Accept offer (lock + snapshot)
5. Verify immutability (update should fail)
6. Verify snapshot exists

### **4. Update Environment**

No new environment variables required. Uses existing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### **5. Deploy**

```bash
# Build and deploy
npm run build
# Deploy to Vercel/production
```

---

## Data Model

### **offers Table**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Multi-tenant isolation |
| restaurant_id | UUID | FK to restaurants |
| request_id | UUID | Optional FK to requests |
| supplier_id | UUID | Optional FK to suppliers |
| title | TEXT | Offer title |
| currency | TEXT | Currency code (default: SEK) |
| status | TEXT | DRAFT \| SENT \| ACCEPTED \| REJECTED |
| accepted_at | TIMESTAMPTZ | Acceptance timestamp |
| locked_at | TIMESTAMPTZ | Lock timestamp (immutable after) |
| snapshot | JSONB | Immutable snapshot at acceptance |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

### **offer_lines Table**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Multi-tenant isolation |
| offer_id | UUID | FK to offers |
| line_no | INTEGER | Line ordering |
| name | TEXT | Wine name (user input) |
| vintage | INTEGER | Vintage year |
| quantity | INTEGER | Quantity (bottles) |
| offered_unit_price_ore | INTEGER | Price in öre (ex VAT) |
| bottle_ml | INTEGER | Bottle size (ml) |
| packaging | TEXT | Packaging type |
| **canonical_name** | TEXT | Wine Check: canonical name |
| **producer** | TEXT | Wine Check: producer |
| **country** | TEXT | Wine Check: country |
| **region** | TEXT | Wine Check: region |
| **appellation** | TEXT | Wine Check: appellation |
| **ws_id** | TEXT | Wine Check: Wine-Searcher ID |
| **match_status** | TEXT | Wine Check: match status |
| **match_score** | INTEGER | Wine Check: confidence (0-100) |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

**Enrichment Allowlist:** Only canonical_name, producer, country, region, appellation, ws_id, match_status, match_score (NO PRICE DATA)

### **offer_events Table**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Multi-tenant isolation |
| offer_id | UUID | FK to offers |
| event_type | TEXT | CREATED \| UPDATED \| LINE_ADDED \| LINE_UPDATED \| LINE_DELETED \| SENT \| ACCEPTED \| REJECTED |
| actor_user_id | UUID | User who performed action |
| payload | JSONB | Optional event details |
| created_at | TIMESTAMPTZ | Event timestamp |

---

## API Usage Examples

### **Create Offer**

```bash
curl -X POST http://localhost:3000/api/offers \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "restaurant_id": "uuid",
    "title": "Weekly Wine Selection",
    "currency": "SEK",
    "lines": [
      {
        "line_no": 1,
        "name": "Château Margaux 2015",
        "vintage": 2015,
        "quantity": 6,
        "bottle_ml": 750,
        "offered_unit_price_ore": 50000
      },
      {
        "line_no": 2,
        "name": "Barolo DOCG 2018",
        "vintage": 2018,
        "quantity": 12,
        "bottle_ml": 750,
        "offered_unit_price_ore": 35000,
        "enrichment": {
          "canonical_name": "Barolo DOCG",
          "producer": "Giovanni Rosso",
          "country": "Italy",
          "region": "Piedmont",
          "ws_id": "123456",
          "match_status": "verified",
          "match_score": 95
        }
      }
    ]
  }'
```

### **Get Offer**

```bash
curl http://localhost:3000/api/offers/OFFER_ID \
  -H "x-tenant-id: YOUR_TENANT_ID"
```

### **Update Line**

```bash
curl -X PATCH http://localhost:3000/api/offers/OFFER_ID \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "lines": [
      {
        "id": "LINE_ID",
        "line_no": 1,
        "enrichment": {
          "canonical_name": "Château Margaux Premier Grand Cru Classé",
          "producer": "Château Margaux",
          "country": "France",
          "region": "Bordeaux",
          "appellation": "Margaux",
          "ws_id": "789012",
          "match_status": "verified",
          "match_score": 98
        }
      }
    ]
  }'
```

### **Accept Offer**

```bash
curl -X POST http://localhost:3000/api/offers/OFFER_ID/accept \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "x-user-id: USER_ID"
```

---

## Status Workflow

```
DRAFT
  ↓ (can edit)
SENT
  ↓ (can still edit by supplier)
ACCEPTED ──→ LOCKED (immutable, snapshot saved)
  ↓
[Read-only view with snapshot]

REJECTED
```

**Rules:**
- **DRAFT:** Fully editable
- **SENT:** Editable by supplier (TODO: enforce in RLS)
- **ACCEPTED:** Immutable, locked_at set, snapshot saved
- **REJECTED:** Immutable

---

## Security

### **1. NO PRICE DATA Policy**

Enrichment allowlist enforced in `offer-service.ts`:
- Allowed: canonical_name, producer, country, region, appellation, ws_id, match_status, match_score
- Forbidden: price, offer, currency, market, cost, value, $, €, £, USD, EUR, GBP

Validation happens on:
- Create offer
- Update lines

### **2. Immutability**

After acceptance:
- `locked_at` timestamp set
- `snapshot` JSONB saved (offer + lines)
- All update attempts return 409 Conflict

### **3. Tenant Isolation**

RLS policies enforce tenant_id matching on all operations.

### **4. Audit Trail**

All state changes logged in `offer_events`:
- CREATED, UPDATED, LINE_ADDED, LINE_UPDATED, SENT, ACCEPTED

---

## Backwards Compatibility

**localStorage code (lib/offer-storage.ts):**
- Deprecated but kept for dev fallback
- Default is now DB
- Remove localStorage code once fully migrated

**Old single-wine offer flow:**
- Still exists in `supplier_wines` + `offers` (old schema)
- New multi-line flow uses `offers` + `offer_lines` (new schema)
- Consider consolidating in Phase 2

---

## Testing

### **Automated Test**

```bash
npm run test:offer:mvp
```

Tests:
1. ✓ Create offer with 2 lines
2. ✓ Get offer
3. ✓ Update line with enrichment
4. ✓ Accept offer
5. ✓ Verify immutability
6. ✓ Verify snapshot

### **Manual Testing**

1. Visit `/offers/new`
2. Create offer with 2-3 wines
3. Use Wine Check to enrich each wine
4. Save (creates DRAFT in DB)
5. Visit `/offers/[id]`
6. Edit offer (add/update lines)
7. Click "Accept Offer"
8. Verify UI becomes read-only
9. Check database for snapshot

---

## Troubleshooting

### **Error: "Missing tenant context"**
- Add `x-tenant-id` header to all API requests
- Check auth/session setup

### **Error: "Cannot update offer: status is ACCEPTED"**
- Offer is locked after acceptance
- Expected behavior (immutability)

### **Error: "SECURITY_VIOLATION: Forbidden price data"**
- Enrichment contains forbidden fields
- Check Wine Check response
- Verify allowlist in offer-service.ts

### **Error: "Foreign key violation"**
- restaurant_id, request_id, or supplier_id doesn't exist
- Create test data first

---

## Next Steps

**Phase 2 Improvements:**
1. Restaurant-specific RLS policies (only see own offers)
2. Supplier-specific RLS policies (only see own offers)
3. Email notifications on offer events
4. Offer expiration workflow
5. Offer versioning (instead of immutable accept)
6. Consolidate old single-wine offer flow with new multi-line

---

## Support

- Test: `npm run test:offer:mvp`
- Docs: `/docs/OFFER_LINE_ITEMS.md` (old localStorage version)
- Schema: `supabase/migrations/20260117_create_offers*.sql`
- Service: `lib/offer-service.ts`

---

**Status:** ✅ Ready for pilot testing
**Version:** 1.0
**Date:** 2026-01-17
