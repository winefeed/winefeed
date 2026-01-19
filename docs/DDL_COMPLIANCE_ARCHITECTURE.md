# Direct Delivery Location (DDL) Compliance System - Architecture

**Purpose:** Automate Skatteverket "Direkt leveransplats" (form 5369_03) compliance for under-suspension alcohol shipments

**Version:** 1.0.0
**Date:** 2024-01-14

---

## Overview

This system ensures that EMCS (Excise Movement and Control System) shipments under suspension can only be delivered to restaurants that have been registered and approved as Direct Delivery Locations (Direkt leveransplats) with Skatteverket.

### Key Features
1. **Data Capture** - Restaurant onboarding step collects required information
2. **Document Generation** - Auto-generate PDF application (form 5369_03)
3. **Status Workflow** - Track approval process with audit trail
4. **Shipment Gating** - Block under-suspension shipments to unapproved locations
5. **Multi-tenant** - Full tenant isolation with RBAC

---

## Business Rules

### Critical Compliance Rule
> **Shipments "under suspension" (EMCS) can ONLY be delivered to restaurants with DDL status = APPROVED for that specific importer + delivery address.**

### Status Workflow
```
NOT_REGISTERED → SUBMITTED → APPROVED
                           ↘ REJECTED
                           ↘ EXPIRED (optional)
```

### Validation Rules
1. Swedish org number format (10 digits, NNNNNN-NNNN)
2. Valid delivery address in Sweden (country_code = SE)
3. Contact email + phone required
4. Explicit consent required before submission
5. Unique combination: (tenant_id, restaurant_id, importer_id, address, postal_code, city)

---

## Data Model

### Core Tables

#### 1. `direct_delivery_locations`
Master record for each DDL registration.

```sql
- id (uuid, PK)
- tenant_id (uuid, FK → tenants) [multi-tenant isolation]
- restaurant_id (uuid, FK → restaurants)
- importer_id (uuid, FK → importers) [which approved actor]
- legal_name (text) [from Bolagsverket]
- org_number (text) [Swedish orgnr, indexed]
- delivery_address_line1 (text)
- delivery_address_line2 (text, nullable)
- postal_code (text)
- city (text)
- country_code (text) [always 'SE']
- contact_name (text)
- contact_email (text)
- contact_phone (text)
- consent_given (boolean)
- consent_timestamp (timestamptz)
- status (enum: NOT_REGISTERED, SUBMITTED, APPROVED, REJECTED, EXPIRED)
- status_updated_at (timestamptz)
- current_document_id (uuid, nullable, FK → ddl_documents)
- created_at (timestamptz)
- updated_at (timestamptz)

UNIQUE CONSTRAINT: (tenant_id, restaurant_id, importer_id, delivery_address_line1, postal_code, city)
```

#### 2. `ddl_documents`
Document archive with versioning.

```sql
- id (uuid, PK)
- tenant_id (uuid, FK → tenants)
- ddl_id (uuid, FK → direct_delivery_locations)
- document_type (enum: SKV_5369_03)
- version (integer) [1, 2, 3...]
- file_url (text) [S3/Supabase storage path]
- file_hash (text) [SHA-256 of PDF content]
- created_by_user_id (uuid, FK → users)
- created_at (timestamptz)
- metadata_json (jsonb) [{ date, internal_reference, generation_params }]
```

#### 3. `ddl_status_events`
Audit trail for all status changes.

```sql
- id (uuid, PK)
- tenant_id (uuid, FK → tenants)
- ddl_id (uuid, FK → direct_delivery_locations)
- from_status (text)
- to_status (text)
- note (text, nullable)
- changed_by_user_id (uuid, FK → users)
- created_at (timestamptz)
```

---

## System Components

### 1. Data Capture (Onboarding)

**Location:** Restaurant onboarding flow → "Direct Delivery Readiness" step

**Flow:**
1. User enters org_number
2. System fetches legal_name from Bolagsverket (or stub)
3. User fills delivery address + contact info
4. User selects importer (approved actor)
5. User checks consent box
6. System validates all fields
7. Creates DDL record with status = NOT_REGISTERED

**API Endpoint:**
```
POST /api/restaurants/:restaurantId/direct-delivery-locations
```

### 2. Document Generation

**Generator:** `lib/compliance/ddl-document-generator.ts`

**Template:** Internal PDF layout with required fields:
- Importer details (legal name, orgnr, contact)
- Restaurant details (legal name, orgnr)
- Delivery address (full)
- Contact person
- Consent statement + timestamp
- Internal reference: `DDL-{ddl_id}-{YYYYMMDD}-v{version}`
- Date of creation

**Technology:** `pdf-lib` (TypeScript PDF generation)

**Output:** PDF stored in Supabase Storage at `/ddl-documents/{tenant_id}/{ddl_id}/application-v{version}.pdf`

**Versioning:** Incremental version number, each generation creates new document record

**API Endpoint:**
```
POST /api/direct-delivery-locations/:ddlId/generate-document
```

### 3. Status Workflow

**Actions:**

| Action | Precondition | Transition | Who |
|--------|-------------|------------|-----|
| Generate Document | status = NOT_REGISTERED | (no change) | Restaurant Admin |
| Mark Submitted | document exists | NOT_REGISTERED → SUBMITTED | Restaurant Admin |
| Mark Approved | status = SUBMITTED | SUBMITTED → APPROVED | Compliance Admin |
| Mark Rejected | status = SUBMITTED | SUBMITTED → REJECTED | Compliance Admin |
| Regenerate | status = NOT_REGISTERED or REJECTED | (creates new version) | Restaurant Admin |

**API Endpoints:**
```
POST /api/direct-delivery-locations/:ddlId/submit
POST /api/direct-delivery-locations/:ddlId/approve
POST /api/direct-delivery-locations/:ddlId/reject
```

**Audit:** Every status change creates `ddl_status_events` record

### 4. Shipment Gating

**Location:** Order creation flow, before confirming shipment

**Rule:**
```typescript
if (shipment.shipment_type === 'UNDER_SUSPENSION') {
  const ddl = await validateDDL(
    shipment.restaurant_id,
    shipment.importer_id,
    shipment.delivery_address
  );

  if (!ddl || ddl.status !== 'APPROVED') {
    throw new Error(
      `Direkt leveransplats saknas eller är inte godkänd för denna leverans under uppskov. Status: ${ddl?.status || 'NOT_REGISTERED'}`
    );
  }

  if (!addressMatches(ddl.delivery_address, shipment.delivery_address)) {
    throw new Error(
      'Leveransadressen matchar inte den godkända Direkt leveransplatsen'
    );
  }
}
```

**API Endpoint:**
```
POST /api/shipments/validate-ddl
  → Returns: { valid: boolean, ddl_id?: uuid, error?: string }
```

---

## Security & Access Control

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|------------|
| **Restaurant Admin** | Create DDL, view own DDLs, generate documents, submit |
| **Compliance Admin** | View all DDLs, approve/reject, view audit trail |
| **System** | Enforce shipment gating |

### Multi-Tenant Isolation

All queries MUST filter by `tenant_id`:
```sql
WHERE tenant_id = auth.tenant_id()
```

### RLS Policies (Supabase)

```sql
-- Restaurant users see only their DDLs
CREATE POLICY "restaurants_own_ddls" ON direct_delivery_locations
  FOR SELECT USING (
    tenant_id = auth.tenant_id() AND
    restaurant_id IN (SELECT id FROM restaurants WHERE tenant_id = auth.tenant_id())
  );

-- Compliance admins see all DDLs in their tenant
CREATE POLICY "compliance_admins_all_ddls" ON direct_delivery_locations
  FOR ALL USING (
    tenant_id = auth.tenant_id() AND
    auth.jwt() ->> 'role' = 'compliance_admin'
  );
```

---

## API Specification

### REST Endpoints

#### 1. Create DDL
```
POST /api/restaurants/:restaurantId/direct-delivery-locations
Body: {
  importer_id: uuid,
  org_number: string,
  legal_name: string,
  delivery_address: {
    line1: string,
    line2?: string,
    postal_code: string,
    city: string,
    country_code: 'SE'
  },
  contact: {
    name: string,
    email: string,
    phone: string
  },
  consent_given: true
}
Response: { ddl_id: uuid, status: 'NOT_REGISTERED' }
```

#### 2. Generate Document
```
POST /api/direct-delivery-locations/:ddlId/generate-document
Response: {
  document_id: uuid,
  version: number,
  file_url: string,
  internal_reference: string
}
```

#### 3. Submit for Approval
```
POST /api/direct-delivery-locations/:ddlId/submit
Body: { note?: string }
Response: { status: 'SUBMITTED', status_updated_at: timestamp }
```

#### 4. Approve
```
POST /api/direct-delivery-locations/:ddlId/approve
Body: { note?: string }
Response: { status: 'APPROVED', status_updated_at: timestamp }
```

#### 5. Reject
```
POST /api/direct-delivery-locations/:ddlId/reject
Body: { note: string }
Response: { status: 'REJECTED', status_updated_at: timestamp }
```

#### 6. List DDLs
```
GET /api/direct-delivery-locations?tenant_id=<uuid>&status=<status>
Response: {
  ddls: [{ id, restaurant_name, legal_name, status, current_document_url, ... }]
}
```

#### 7. Get DDL Details
```
GET /api/direct-delivery-locations/:ddlId
Response: {
  ddl: { ... },
  documents: [{ version, file_url, created_at, ... }],
  status_history: [{ from_status, to_status, note, changed_at, changed_by, ... }]
}
```

#### 8. Validate for Shipment
```
POST /api/shipments/validate-ddl
Body: {
  restaurant_id: uuid,
  importer_id: uuid,
  delivery_address: { line1, postal_code, city }
}
Response: {
  valid: boolean,
  ddl_id?: uuid,
  status?: string,
  error?: string
}
```

---

## Document Generation Details

### PDF Structure (5369_03 Application)

```
┌─────────────────────────────────────────────────────┐
│ ANSÖKAN OM DIREKT LEVERANSPLATS                    │
│ (Application for Direct Delivery Location)         │
│ Blankettkod: SKV 5369_03                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ IMPORTÖR (Approved Actor)                          │
│ Legal Name: [importer.legal_name]                  │
│ Org.nr: [importer.org_number]                      │
│ Kontaktperson: [importer.contact_name]             │
│ E-post: [importer.contact_email]                   │
│                                                     │
│ RESTAURANG (Restaurant)                            │
│ Legal Name: [restaurant.legal_name]                │
│ Org.nr: [restaurant.org_number]                    │
│                                                     │
│ LEVERANSADRESS (Delivery Address)                  │
│ Adress: [delivery_address_line1]                   │
│         [delivery_address_line2]                   │
│ Postnr: [postal_code]                              │
│ Ort: [city]                                        │
│                                                     │
│ KONTAKTPERSON (Contact Person)                     │
│ Namn: [contact_name]                               │
│ E-post: [contact_email]                            │
│ Telefon: [contact_phone]                           │
│                                                     │
│ SAMTYCKE (Consent)                                 │
│ ☑ Jag godkänner att denna adress registreras som  │
│   Direkt leveransplats hos Skatteverket            │
│ Datum: [consent_timestamp]                         │
│                                                     │
│ INTERN REFERENS: DDL-[id]-[YYYYMMDD]-v[version]   │
│ Skapad: [created_at]                               │
└─────────────────────────────────────────────────────┘
```

### Generator Implementation

**Library:** `pdf-lib` (pure TypeScript, no external dependencies)

**Steps:**
1. Create PDF document
2. Add header with form code
3. Render sections with labels + values
4. Add consent statement with timestamp
5. Add footer with internal reference
6. Compute SHA-256 hash
7. Upload to storage
8. Create `ddl_documents` record

**Deterministic:** Same input data produces same PDF (for hash verification)

---

## Testing Strategy

### Unit Tests

1. **Org Number Validation**
   - Valid: `123456-7890`
   - Invalid: `12345`, `abc`, `123456-789A`

2. **Status Transitions**
   - NOT_REGISTERED → SUBMITTED (valid)
   - SUBMITTED → APPROVED (valid)
   - APPROVED → REJECTED (invalid)
   - NOT_REGISTERED → APPROVED (invalid)

3. **Document Versioning**
   - First generation: version = 1
   - Regeneration: version = 2, 3, ...
   - current_document_id updates

4. **Shipment Gating**
   - APPROVED DDL + matching address → allowed
   - SUBMITTED DDL → blocked
   - No DDL → blocked
   - Address mismatch → blocked

5. **Address Matching**
   - Exact match → pass
   - Different postal code → fail
   - Case insensitive → pass

### Integration Tests

1. Full workflow: Create → Generate → Submit → Approve
2. Multi-tenant isolation (tenant A cannot see tenant B's DDLs)
3. RBAC enforcement (restaurant cannot approve)
4. Audit trail completeness

---

## Deployment Checklist

- [ ] Run database migration
- [ ] Configure Supabase Storage bucket: `ddl-documents`
- [ ] Set up RLS policies
- [ ] Configure RBAC roles (compliance_admin)
- [ ] Add Bolagsverket lookup service (or stub)
- [ ] Test PDF generation locally
- [ ] Verify shipment gating blocks unapproved locations
- [ ] Set up monitoring/alerts for rejected DDLs
- [ ] Train compliance admins on approval workflow

---

## Future Enhancements

1. **Skatteverket API Integration** - Auto-submit to Skatteverket (when available)
2. **DOCX/XML Export** - Additional document formats
3. **Expiration Tracking** - Auto-expire DDLs after N years
4. **Bulk Upload** - Import multiple DDLs from CSV
5. **Reminders** - Notify when DDL status needs action
6. **Dashboard** - Compliance overview (pending approvals, expiring DDLs)
7. **Multi-language** - Support English translations

---

## References

- Skatteverket Form 5369_03: "Ansökan om direkt leveransplats"
- EMCS (Excise Movement and Control System)
- Swedish Org Number Format: NNNNNN-NNNN (10 digits)
- Bolagsverket (Swedish Companies Registration Office)

---

**Document Owner:** Winefeed Compliance Team
**Last Updated:** 2024-01-14
**Version:** 1.0.0
