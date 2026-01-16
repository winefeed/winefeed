# Supplier Onboarding Documentation

**Version:** 1.0
**Date:** 2026-01-14
**Status:** ✅ MVP Complete

---

## Overview

This document describes the Supplier Onboarding system for Winefeed, enabling Swedish wine importers to:
1. Create supplier accounts with authentication
2. Import their wine catalog via CSV
3. View and respond to restaurant quote requests
4. Manage offers and pricing

---

## Architecture

### Database Schema

The supplier onboarding system extends the core schema with:

#### New Tables

1. **supplier_users** - Multi-tenant authentication
   - Links Supabase auth users to suppliers
   - Supports multiple users per supplier (admin/staff roles)
   - RLS policies enforce tenant isolation

2. **supplier_wines** - Supplier-managed wine catalog
   - Each supplier manages their own wine inventory
   - Pricing in öre (integer) for precision
   - Optional stock tracking and delivery areas

3. **offers** - Supplier responses to quote requests
   - Links suppliers to restaurant quote requests
   - Tracks pricing, quantity, delivery commitments
   - Status workflow: pending → accepted/rejected/expired

#### Extended Tables

- **suppliers** - Added type, license, and compliance fields
  - `type`: SWEDISH_IMPORTER | EU_PRODUCER | EU_IMPORTER
  - `org_number`: Swedish organization number
  - `license_number`: Alcohol license ID
  - `is_active`: Account activation status

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                  SUPPLIER ONBOARDING FLOW                │
└─────────────────────────────────────────────────────────┘

1. ONBOARDING
   POST /api/suppliers/onboard
   ├─ Create Supplier record (type=SWEDISH_IMPORTER)
   ├─ Create Auth User (Supabase)
   └─ Link via supplier_users table

2. CATALOG IMPORT
   POST /api/suppliers/{id}/catalog/import
   ├─ Parse CSV file
   ├─ Validate each row
   ├─ Insert/Update supplier_wines
   └─ Return import summary

3. VIEW QUOTE REQUESTS
   GET /api/suppliers/{id}/quote-requests
   ├─ List all restaurant requests
   ├─ Show my offer count per request
   └─ Filter by status (open/with_offers)

4. CREATE OFFER
   POST /api/quote-requests/{requestId}/offers
   ├─ Validate supplier owns wine
   ├─ Validate minimum order quantity
   ├─ Validate SWEDISH_IMPORTER constraints
   └─ Create offer (status=pending)

5. RESTAURANT VIEWS OFFERS
   GET /api/quote-requests/{requestId}/offers
   └─ List all offers for their request
```

---

## API Reference

### 1. Supplier Onboarding

**Endpoint:** `POST /api/suppliers/onboard`

**Request Body:**
```json
{
  "email": "supplier@example.com",
  "password": "SecurePassword123!",
  "supplierName": "Vinkällaren AB",
  "contactEmail": "kontakt@vinkallaren.se",
  "phone": "+46701234567",
  "website": "https://vinkallaren.se",
  "orgNumber": "556123-4567",
  "licenseNumber": "ALK-2024-001",
  "normalDeliveryDays": 5
}
```

**Response (201 Created):**
```json
{
  "supplier": {
    "id": "uuid",
    "name": "Vinkällaren AB",
    "type": "SWEDISH_IMPORTER",
    "email": "kontakt@vinkallaren.se",
    "orgNumber": "556123-4567",
    "licenseNumber": "ALK-2024-001",
    "isActive": true
  },
  "user": {
    "id": "uuid",
    "email": "supplier@example.com"
  },
  "message": "Supplier onboarded successfully"
}
```

**Validation:**
- Email must be valid format
- Password must meet Supabase requirements
- Supplier name and contact email are required
- Organization number format (optional for MVP)

---

### 2. Catalog Import (CSV)

**Endpoint:** `POST /api/suppliers/{supplierId}/catalog/import`

**Request Body:**
```json
{
  "csvData": "name,producer,country,...",
  "replaceExisting": false
}
```

**CSV Format:**
```csv
name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Château Margaux 2015","Château Margaux","France","Bordeaux",2015,"Cabernet Sauvignon",450.00,25.00,24,6,7,"Stockholm,Göteborg"
"Barolo Riserva 2013","Marchesi di Barolo","Italy","Piedmont",2013,"Nebbiolo",320.50,25.00,12,6,5,"Stockholm,Malmö"
```

**CSV Fields:**

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| name | ✅ | string | Wine name | "Château Margaux 2015" |
| producer | ✅ | string | Producer/winery | "Château Margaux" |
| country | ✅ | string | Country of origin | "France" |
| region | ❌ | string | Wine region | "Bordeaux" |
| vintage | ❌ | integer | Year (1900-current) | 2015 |
| grape | ❌ | string | Grape variety | "Cabernet Sauvignon" |
| priceExVatSek | ✅ | decimal | Price excluding VAT (SEK) | 450.00 |
| vatRate | ❌ | decimal | VAT percentage (default 25%) | 25.00 |
| stockQty | ❌ | integer | Stock quantity (null = unlimited) | 24 |
| minOrderQty | ❌ | integer | Minimum bottles per order | 6 |
| leadTimeDays | ❌ | integer | Delivery lead time | 7 |
| deliveryAreas | ❌ | string | Comma-separated cities | "Stockholm,Göteborg" |

**Response (200 OK):**
```json
{
  "imported": 3,
  "updated": 0,
  "failed": 0,
  "errors": [],
  "totalRows": 3
}
```

**Validation Rules:**
- ✅ Price must be > 0
- ✅ Vintage must be 1900-2026
- ✅ VAT rate must be 0-100
- ✅ Stock quantity must be >= 0
- ✅ Minimum order quantity must be > 0
- ✅ Lead time must be >= 0

**Errors Example:**
```json
{
  "imported": 2,
  "updated": 0,
  "failed": 1,
  "errors": [
    { "row": 3, "error": "Invalid price '-10.00'" }
  ],
  "totalRows": 3
}
```

---

### 3. List Quote Requests

**Endpoint:** `GET /api/suppliers/{supplierId}/quote-requests?status=all&limit=50&offset=0`

**Query Parameters:**
- `status`: all | open | with_offers (default: all)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "requests": [
    {
      "id": "uuid",
      "restaurantId": "uuid",
      "restaurantName": "Restaurang Gott",
      "fritext": "Söker elegant rött vin från Bordeaux",
      "budgetPerFlaska": 500,
      "antalFlaskor": 12,
      "leveransSenast": "2026-02-15",
      "specialkrav": ["ekologiskt"],
      "createdAt": "2026-01-14T10:00:00Z",
      "myOfferCount": 1,
      "totalOfferCount": 3
    }
  ],
  "total": 25,
  "hasMore": false
}
```

**Usage:**
- Suppliers can see ALL quote requests (for MVP)
- Future: Add matching/targeting logic
- `myOfferCount`: How many offers this supplier submitted
- `totalOfferCount`: Total offers from all suppliers

---

### 4. Create Offer

**Endpoint:** `POST /api/quote-requests/{requestId}/offers`

**Request Body:**
```json
{
  "supplierId": "uuid",
  "supplierWineId": "uuid",
  "offeredPriceExVatSek": 440.00,
  "quantity": 12,
  "deliveryDate": "2026-02-01",
  "leadTimeDays": 7,
  "notes": "Specialpris för första beställningen",
  "expiresAt": "2026-01-21T23:59:59Z"
}
```

**Response (201 Created):**
```json
{
  "offer": {
    "id": "uuid",
    "requestId": "uuid",
    "supplierId": "uuid",
    "supplierWineId": "uuid",
    "wineName": "Château Margaux 2015",
    "offeredPriceExVatSek": 440.00,
    "vatRate": 25.00,
    "quantity": 12,
    "deliveryDate": "2026-02-01",
    "leadTimeDays": 7,
    "notes": "Specialpris för första beställningen",
    "status": "pending",
    "expiresAt": "2026-01-21T23:59:59Z",
    "createdAt": "2026-01-14T12:00:00Z"
  },
  "message": "Offer created successfully"
}
```

**Validation:**
- ✅ Quote request must exist
- ✅ Supplier must be active
- ✅ Wine must belong to this supplier (tenant isolation)
- ✅ Quantity must meet minimum order quantity
- ✅ Price must be > 0
- ✅ Delivery date must be valid ISO date
- ✅ Lead time must be >= 0
- ✅ SWEDISH_IMPORTER cannot have EU compliance fields

**Errors:**

```json
// 403 Forbidden - Tenant Isolation Violation
{
  "error": "Wine does not belong to this supplier (tenant isolation violation)"
}

// 400 Bad Request - Minimum Order Quantity
{
  "error": "Quantity must be at least 6 (minimum order quantity)"
}

// 404 Not Found
{
  "error": "Quote request not found"
}
```

---

### 5. List Offers for Quote Request

**Endpoint:** `GET /api/quote-requests/{requestId}/offers`

**Response (200 OK):**
```json
{
  "offers": [
    {
      "id": "uuid",
      "requestId": "uuid",
      "supplierId": "uuid",
      "supplierName": "Vinkällaren AB",
      "supplierEmail": "kontakt@vinkallaren.se",
      "wine": {
        "id": "uuid",
        "name": "Château Margaux 2015",
        "producer": "Château Margaux",
        "country": "France",
        "region": "Bordeaux",
        "vintage": 2015
      },
      "offeredPriceExVatSek": 440.00,
      "vatRate": 25.00,
      "quantity": 12,
      "deliveryDate": "2026-02-01",
      "leadTimeDays": 7,
      "notes": "Specialpris",
      "status": "pending",
      "expiresAt": "2026-01-21T23:59:59Z",
      "createdAt": "2026-01-14T12:00:00Z"
    }
  ]
}
```

**Access Control:**
- Restaurants can view offers on their own requests
- Suppliers can view all offers (to see competition)

---

## Security & Compliance

### Tenant Isolation

The system enforces strict multi-tenancy:

1. **Row Level Security (RLS)**
   - `supplier_users`: Users only see their own record
   - `supplier_wines`: Suppliers only see their own catalog
   - `offers`: Suppliers only see/create their own offers

2. **API Validation**
   - Offer creation validates wine belongs to supplier
   - Catalog import validates supplier_id
   - Quote request access is read-only (no modification)

3. **Attack Prevention**
   - ✅ Supplier A cannot use Supplier B's wines
   - ✅ Supplier A cannot import to Supplier B's catalog
   - ✅ Supplier A cannot pretend to be Supplier B
   - ✅ Suppliers cannot access non-existent resources

### Compliance for SWEDISH_IMPORTER

For Swedish importers (MVP focus):
- ✅ No EU-specific fields (EMCS, compliance importer)
- ✅ All pricing in SEK (converted to öre for precision)
- ✅ VAT handling (25% default)
- ✅ Organization number tracking
- ✅ License number tracking

Future: EU_PRODUCER and EU_IMPORTER types will add:
- EMCS references
- Compliance partner requirements
- Cross-border delivery validation

---

## Testing

### Test Suite

Run tests with:
```bash
npm run test
```

#### Integration Tests
**File:** `tests/integration/supplier-onboarding-flow.test.ts`

Tests complete flow:
1. ✅ Supplier onboards
2. ✅ Imports catalog via CSV
3. ✅ Views quote requests
4. ✅ Creates offer
5. ✅ Offer appears in restaurant's list
6. ✅ Validates minimum order quantity
7. ✅ Validates CSV pricing
8. ✅ Validates date formats

#### Attack Tests
**File:** `tests/attack/tenant-isolation.test.ts`

Validates security:
1. ✅ ATTACK 1: Cannot use other supplier's wine
2. ✅ ATTACK 2: Cannot import to other supplier's catalog
3. ✅ ATTACK 3: RLS prevents reading other supplier's data
4. ✅ ATTACK 4: Cannot create offer for fake quote request
5. ✅ ATTACK 5: Cannot use non-existent wine
6. ✅ ATTACK 6: Cannot pretend to be another supplier
7. ✅ ATTACK 7: Both suppliers can create legitimate offers

---

## Usage Examples

### Example 1: Onboard New Supplier

```bash
curl -X POST http://localhost:3000/api/suppliers/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "email": "supplier@vinkallaren.se",
    "password": "SecurePassword123!",
    "supplierName": "Vinkällaren AB",
    "contactEmail": "kontakt@vinkallaren.se",
    "orgNumber": "556123-4567",
    "licenseNumber": "ALK-2024-001"
  }'
```

### Example 2: Import Catalog

```bash
curl -X POST http://localhost:3000/api/suppliers/{supplierId}/catalog/import \
  -H "Content-Type: application/json" \
  -d '{
    "csvData": "name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas\n\"Château Margaux 2015\",\"Château Margaux\",\"France\",\"Bordeaux\",2015,\"Cabernet Sauvignon\",450.00,25.00,24,6,7,\"Stockholm,Göteborg\"",
    "replaceExisting": false
  }'
```

### Example 3: Create Offer

```bash
curl -X POST http://localhost:3000/api/quote-requests/{requestId}/offers \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "{supplierId}",
    "supplierWineId": "{wineId}",
    "offeredPriceExVatSek": 440.00,
    "quantity": 12,
    "deliveryDate": "2026-02-01",
    "leadTimeDays": 7,
    "notes": "Specialpris för första beställningen"
  }'
```

---

## Database Migration

To apply the schema changes, run the migration:

```bash
# Using Supabase CLI
supabase db reset

# Or via Supabase Dashboard SQL Editor
# Copy and run: supabase/migrations/20260114_supplier_onboarding.sql
```

---

## Next Steps

### Phase 2: Enhanced Features

1. **Email Notifications**
   - Notify suppliers of new quote requests
   - Notify restaurants when offers are received

2. **Offer Acceptance Flow**
   - Restaurant accepts offer → creates order
   - Integration with payment system

3. **Advanced Matching**
   - ML-based wine matching to quote requests
   - Automated supplier notifications for relevant requests

4. **Supplier Dashboard**
   - Analytics: conversion rate, average offer value
   - Catalog management UI
   - Offer tracking and history

### Phase 3: EU Compliance

1. **EU_PRODUCER Support**
   - Add EMCS fields
   - Brasri partnership integration

2. **EU_IMPORTER Support**
   - Compliance partner validation
   - Document upload and tracking

---

## Troubleshooting

### Common Issues

**Problem:** Supplier onboarding fails with "Failed to create user account"

**Solution:**
- Check Supabase service role key is set: `SUPABASE_SERVICE_ROLE_KEY`
- Verify email is unique (not already registered)
- Check Supabase auth settings allow email signup

---

**Problem:** CSV import fails with "Column count mismatch"

**Solution:**
- Ensure CSV has all required columns in correct order
- Check for extra commas or line breaks
- Validate CSV with online validator first

---

**Problem:** Offer creation fails with "tenant isolation violation"

**Solution:**
- Verify `supplierWineId` belongs to `supplierId`
- Check wine exists in `supplier_wines` table
- Ensure supplier is active (`is_active = true`)

---

## Changelog

### Version 1.0 (2026-01-14)

**Added:**
- ✅ Supplier onboarding endpoint
- ✅ CSV catalog import with validation
- ✅ Quote request listing for suppliers
- ✅ Offer creation with compliance rules
- ✅ Tenant isolation security
- ✅ Integration tests (8 tests)
- ✅ Attack tests (7 tests)
- ✅ Database migration with RLS policies

**Database Changes:**
- Added `supplier_type` enum
- Extended `suppliers` table
- Created `supplier_users` table
- Created `supplier_wines` table
- Created `offers` table
- Added RLS policies for multi-tenancy

**Compliance:**
- SWEDISH_IMPORTER type support
- Organization number tracking
- License number tracking
- No EU fields for Swedish importers

---

**Author:** Claude Sonnet 4.5
**Project:** Winefeed - B2B Wine Platform
**Documentation Version:** 1.0
