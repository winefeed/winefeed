## Direct Delivery Location (DDL) Compliance System - Implementation Summary

**Purpose:** Automate Skatteverket "Direkt leveransplats" compliance for EMCS under-suspension alcohol shipments

**Status:** ✅ Complete and ready for integration
**Date:** 2024-01-14

---

## 📦 What Was Built

### 1. Database Schema (3 tables)
- `direct_delivery_locations` - Master DDL records with status workflow
- `ddl_documents` - Document archive with versioning
- `ddl_status_events` - Complete audit trail

**Key Features:**
- Multi-tenant isolation (RLS policies)
- Unique constraints for idempotency
- Swedish org number format validation
- Status workflow (NOT_REGISTERED → SUBMITTED → APPROVED/REJECTED)

### 2. Core Business Logic
- **DDL Service** (`lib/compliance/ddl-service.ts`) - 450+ lines
  - Create DDL with validation
  - Generate PDF documents with versioning
  - Status transitions with audit trail
  - **Shipment gating** (critical compliance check)

- **Validation** (`lib/compliance/validation.ts`) - 300+ lines
  - Swedish org number validation (with Luhn checksum)
  - Email, postal code, phone validation
  - Status transition rules
  - Address matching logic

- **PDF Generator** (`lib/compliance/ddl-document-generator.ts`) - 250+ lines
  - Pure TypeScript PDF generation (pdf-lib)
  - Professional form layout
  - SHA-256 hash for integrity
  - Versioning support

### 3. REST API Endpoints (7 routes)
1. `POST /api/restaurants/:restaurantId/direct-delivery-locations` - Create DDL
2. `GET /api/direct-delivery-locations/:ddlId` - Get details
3. `POST /api/direct-delivery-locations/:ddlId/generate-document` - Generate PDF
4. `POST /api/direct-delivery-locations/:ddlId/submit` - Submit for approval
5. `POST /api/direct-delivery-locations/:ddlId/approve` - Approve (compliance admin)
6. `POST /api/direct-delivery-locations/:ddlId/reject` - Reject (compliance admin)
7. `POST /api/shipments/validate-ddl` - **Shipment gating** (CRITICAL)

### 4. Comprehensive Tests (2 test suites)
- **Validation Tests** - 60+ test cases
  - Org number validation (valid/invalid formats, Luhn algorithm)
  - Status transitions (all valid/invalid paths)
  - Address matching (case-insensitive, postal code formats)
  - Precondition checks (can generate, can submit, etc.)

- **Shipment Gating Tests** - Integration scenarios
  - APPROVED + matching address → ALLOW
  - SUBMITTED/REJECTED → BLOCK
  - Address mismatch → BLOCK
  - No DDL → BLOCK

---

## 🔑 Key Features

### Critical Business Rule (Shipment Gating)
```typescript
// BEFORE creating any under-suspension shipment:
const validation = await ddlService.validateForShipment(
  restaurant_id,
  importer_id,
  delivery_address,
  tenant_id
);

if (!validation.valid) {
  throw new Error(validation.error);
  // Example: "Direkt leveransplats saknas eller är inte godkänd"
}

// Only proceed if validation.valid === true
```

### Status Workflow with Audit Trail
```
NOT_REGISTERED
  ↓ (generate document)
  ↓ (submit)
SUBMITTED
  ↓ (compliance admin approve/reject)
APPROVED ← ✅ Only this status allows under-suspension shipments
  or
REJECTED → Can restart from NOT_REGISTERED
```

Every status change creates an audit event with:
- Who changed it (user_id)
- What changed (from_status → to_status)
- When (timestamp)
- Why (optional note)

### Document Versioning
- First generation: v1
- Regeneration: v2, v3, ...
- Each version stored separately
- Current version linked via `current_document_id`
- SHA-256 hash for integrity verification

---

## 🚀 Quick Start Guide

### 1. Apply Database Migration
```bash
psql $DATABASE_URL -f supabase/migrations/20260114_direct_delivery_locations.sql
```

**Verify tables created:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('direct_delivery_locations', 'ddl_documents', 'ddl_status_events');
```

### 2. Configure Storage Bucket
```bash
# Create Supabase Storage bucket
supabase storage create ddl-documents

# Set public access policy (for document downloads)
supabase storage update-policy ddl-documents --public
```

### 3. Install Dependencies
```bash
npm install pdf-lib
# Already using: @supabase/supabase-js
```

### 4. Set Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 5. Add RBAC Role (Optional)
```sql
-- Add compliance_admin role to users who can approve/reject
UPDATE users SET role = 'compliance_admin' WHERE id = '<user-id>';
```

---

## 📋 Integration Checklist

### Restaurant Onboarding
- [ ] Add "Direct Delivery Readiness" step in restaurant onboarding UI
- [ ] Implement Bolagsverket lookup (or use stub)
- [ ] Form fields:
  - [ ] Org number input with validation
  - [ ] Legal name (prefilled from Bolagsverket)
  - [ ] Delivery address (line1, postal_code, city)
  - [ ] Contact person (name, email, phone)
  - [ ] Importer selection dropdown
  - [ ] Consent checkbox

### Document Generation UI
- [ ] "Generate Application PDF" button
- [ ] Show generated documents list with version numbers
- [ ] Download button for each document

### Status Workflow UI
- [ ] "Submit for Approval" button (restaurant users)
- [ ] Approve/Reject buttons (compliance admin only)
- [ ] Status history timeline
- [ ] Status badge/indicator

### Shipment Creation
- [ ] **CRITICAL:** Call `POST /api/shipments/validate-ddl` BEFORE creating shipment
- [ ] Block shipment if `valid === false`
- [ ] Show clear error message to user

---

## 🧪 Testing Commands

### Run Unit Tests
```bash
# All validation tests
npm test lib/compliance/__tests__/validation.test.ts

# Shipment gating tests
npm test lib/compliance/__tests__/shipment-gating.test.ts
```

### Manual API Testing (cURL)

#### 1. Create DDL
```bash
curl -X POST http://localhost:3000/api/restaurants/restaurant-123/direct-delivery-locations \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-123" \
  -H "x-user-id: user-123" \
  -d '{
    "importer_id": "importer-123",
    "org_number": "556789-1234",
    "legal_name": "Test Restaurant AB",
    "delivery_address": {
      "line1": "Kungsgatan 1",
      "postal_code": "111 43",
      "city": "Stockholm",
      "country_code": "SE"
    },
    "contact": {
      "name": "John Doe",
      "email": "john@test.se",
      "phone": "070-123 45 67"
    },
    "consent_given": true
  }'
```

#### 2. Generate Document
```bash
curl -X POST http://localhost:3000/api/direct-delivery-locations/ddl-id/generate-document \
  -H "x-tenant-id: tenant-123" \
  -H "x-user-id: user-123"
```

#### 3. Submit for Approval
```bash
curl -X POST http://localhost:3000/api/direct-delivery-locations/ddl-id/submit \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-123" \
  -H "x-user-id: user-123" \
  -d '{"note": "Ready for review"}'
```

#### 4. Approve (Compliance Admin)
```bash
curl -X POST http://localhost:3000/api/direct-delivery-locations/ddl-id/approve \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-123" \
  -H "x-user-id: admin-123" \
  -H "x-user-role: compliance_admin" \
  -d '{"note": "Approved - all documents verified"}'
```

#### 5. Validate for Shipment (CRITICAL)
```bash
curl -X POST http://localhost:3000/api/shipments/validate-ddl \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-123" \
  -d '{
    "restaurant_id": "restaurant-123",
    "importer_id": "importer-123",
    "delivery_address": {
      "line1": "Kungsgatan 1",
      "postal_code": "11143",
      "city": "Stockholm"
    }
  }'
```

**Expected Response (APPROVED):**
```json
{
  "valid": true,
  "ddl_id": "ddl-id",
  "status": "APPROVED"
}
```

**Expected Response (BLOCKED):**
```json
{
  "valid": false,
  "ddl_id": "ddl-id",
  "status": "SUBMITTED",
  "error": "Direkt leveransplats är inte godkänd. Status: SUBMITTED"
}
```

---

## 📊 Database Schema Reference

### `direct_delivery_locations`
```sql
id                      UUID PRIMARY KEY
tenant_id               UUID NOT NULL
restaurant_id           UUID NOT NULL
importer_id             UUID NOT NULL
legal_name              TEXT NOT NULL
org_number              TEXT NOT NULL  -- Format: NNNNNN-NNNN
delivery_address_line1  TEXT NOT NULL
postal_code             TEXT NOT NULL
city                    TEXT NOT NULL
country_code            TEXT NOT NULL DEFAULT 'SE'
contact_name            TEXT NOT NULL
contact_email           TEXT NOT NULL
contact_phone           TEXT NOT NULL
consent_given           BOOLEAN NOT NULL
consent_timestamp       TIMESTAMPTZ
status                  ddl_status DEFAULT 'NOT_REGISTERED'
status_updated_at       TIMESTAMPTZ
current_document_id     UUID
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ

-- Unique constraint (tenant, restaurant, importer, address combo)
UNIQUE (tenant_id, restaurant_id, importer_id, delivery_address_line1, postal_code, city)
```

### `ddl_documents`
```sql
id                  UUID PRIMARY KEY
tenant_id           UUID NOT NULL
ddl_id              UUID NOT NULL
document_type       ddl_document_type DEFAULT 'SKV_5369_03'
version             INTEGER NOT NULL
file_url            TEXT NOT NULL
file_hash           TEXT NOT NULL  -- SHA-256
created_by_user_id  UUID NOT NULL
created_at          TIMESTAMPTZ
metadata_json       JSONB

-- Unique constraint per DDL + version
UNIQUE (ddl_id, version)
```

### `ddl_status_events`
```sql
id                  UUID PRIMARY KEY
tenant_id           UUID NOT NULL
ddl_id              UUID NOT NULL
from_status         TEXT NOT NULL
to_status           TEXT NOT NULL
note                TEXT
changed_by_user_id  UUID NOT NULL
created_at          TIMESTAMPTZ
```

---

## 🔒 Security & Access Control

### Row Level Security (RLS)

**Restaurant Users:**
- Can CREATE own DDLs
- Can VIEW own DDLs
- Can UPDATE own DDLs (only in NOT_REGISTERED or REJECTED status)
- Cannot APPROVE/REJECT

**Compliance Admins:**
- Can VIEW all DDLs in tenant
- Can APPROVE/REJECT DDLs
- Can VIEW all documents and audit trail

**System (Service Role):**
- Full access for shipment gating validation

### Multi-Tenant Isolation
All queries filter by `tenant_id`:
```sql
WHERE tenant_id = auth.tenant_id()
```

### Validation Constraints
- Swedish org number format enforced (database constraint)
- Email format validated
- Country code must be 'SE'
- Consent required before submission

---

## 📄 Document Structure (PDF)

### Generated PDF Layout
```
┌─────────────────────────────────────────────────────┐
│ ANSÖKAN OM DIREKT LEVERANSPLATS                    │
│ Blankettkod: SKV 5369_03                           │
├─────────────────────────────────────────────────────┤
│ IMPORTÖR / GODKÄND AKTÖR                           │
│   Företagsnamn: [importer.legal_name]              │
│   Org.nr: [importer.org_number]                    │
│   Kontakt: [importer.contact_name]                 │
│                                                     │
│ RESTAURANG / MOTTAGARE                             │
│   Företagsnamn: [restaurant.legal_name]            │
│   Org.nr: [restaurant.org_number]                  │
│                                                     │
│ LEVERANSADRESS                                      │
│   Adress: [delivery_address_line1]                 │
│   Postnr: [postal_code]                            │
│   Ort: [city]                                      │
│                                                     │
│ KONTAKTPERSON PÅ PLATS                             │
│   Namn: [contact_name]                             │
│   E-post: [contact_email]                          │
│   Telefon: [contact_phone]                         │
│                                                     │
│ SAMTYCKE                                            │
│   ☑ Jag godkänner att denna adress registreras... │
│   Datum: [consent_timestamp]                       │
│                                                     │
│ INTERN REFERENS: DDL-[id]-[YYYYMMDD]-v[version]   │
│ Skapad: [created_at]                               │
└─────────────────────────────────────────────────────┘
```

---

## 🚨 Critical Error Messages

### Shipment Blocked - No DDL
```
Error: Direkt leveransplats saknas för denna restaurang och importör
→ Restaurant must complete DDL registration first
```

### Shipment Blocked - Not Approved
```
Error: Direkt leveransplats är inte godkänd för denna leverans under uppskov. Status: SUBMITTED
→ Wait for compliance admin to approve
```

### Shipment Blocked - Address Mismatch
```
Error: Leveransadressen matchar inte den godkända Direkt leveransplatsen
→ Delivery address must match registered DDL address exactly
```

---

## 📈 Future Enhancements

### Phase 2 (Optional)
- Skatteverket API integration (auto-submit)
- DOCX/XML export formats
- Expiration tracking (auto-expire after N years)
- Bulk upload (CSV import of multiple DDLs)
- Dashboard (pending approvals, expiring DDLs)
- Email notifications (approval/rejection)
- Multi-language support (English translations)

### Phase 3 (Optional)
- OCR document scanning
- Automatic renewal reminders
- Analytics (approval rate, average processing time)
- Mobile app support

---

## 🐛 Troubleshooting

### PDF Generation Fails
**Symptom:** Document generation returns error
**Check:**
1. pdf-lib installed: `npm list pdf-lib`
2. Storage bucket exists: `supabase storage list`
3. Write permissions on bucket

### Shipment Still Blocked Despite Approval
**Check:**
1. DDL status is exactly APPROVED: `SELECT status FROM direct_delivery_locations WHERE id = '...'`
2. Address matches exactly (case-insensitive): Run validation query
3. Correct importer_id used

### Status Transition Fails
**Check:**
1. Current status allows transition: See status workflow diagram
2. Document exists before submit: `SELECT current_document_id FROM direct_delivery_locations WHERE id = '...'`
3. User has correct role for approve/reject

---

## 📞 Support

### Documentation Files
- `DDL_COMPLIANCE_ARCHITECTURE.md` - Complete architecture overview
- `DDL_IMPLEMENTATION_SUMMARY.md` - This file (implementation guide)
- `supabase/migrations/20260114_direct_delivery_locations.sql` - Database schema
- `lib/compliance/types.ts` - Type definitions
- `lib/compliance/validation.ts` - Validation logic
- `lib/compliance/ddl-service.ts` - Core business logic
- `lib/compliance/ddl-document-generator.ts` - PDF generation

### Test Files
- `lib/compliance/__tests__/validation.test.ts` - Validation tests
- `lib/compliance/__tests__/shipment-gating.test.ts` - Integration tests

---

## ✅ Definition of Done

- [x] Database schema with RLS policies
- [x] Core business logic (DDL service)
- [x] PDF document generator
- [x] 7 API endpoints
- [x] Swedish org number validation
- [x] Status transition validation
- [x] Address matching logic
- [x] **Shipment gating enforcement**
- [x] Audit trail (status events)
- [x] Document versioning
- [x] Multi-tenant isolation
- [x] Comprehensive tests (60+ test cases)
- [x] Architecture documentation
- [x] Implementation guide

---

**Implementation Complete:** ✅ All deliverables ready for integration
**Critical Feature:** Shipment gating prevents non-compliant deliveries
**Next Step:** Integrate with restaurant onboarding UI and shipment creation flow

---

**Document Owner:** Winefeed Compliance Team
**Last Updated:** 2024-01-14
**Version:** 1.0.0
