# Ship-Ready Gate + 5369_03 Document Generation - Complete ✅

## Overview

This implementation adds **shipment validation gating** and **5369_03 PDF document generation** for import cases. The system ensures that only approved import cases with valid direct delivery locations can proceed to shipment, and automatically generates compliant Skatteverket documentation.

## What Was Implemented

### A) Shipment Validation (Gatekeeper)

A comprehensive validation service that checks if an import case is ready for shipment before allowing delivery. Supports two flow types:
- **SE (Swedish)** - Domestic Swedish importers
- **EU_PARTNER** - EU partner imports under suspension arrangement

### B) 5369_03 PDF Document Generation

Automated generation of Skatteverket form 5369_03 ("Ansökan om direkt leveransplats") with:
- Version management (incremental versioning per import case)
- SHA-256 integrity hashing
- Supabase Storage integration
- Audit trail via `import_documents` table

### C) Enhanced Smoke Test

Comprehensive test covering:
- FAIL case (validation before approval)
- PASS case (validation after approval)
- Document generation workflow
- Document listing

## Files Created

### Database Migrations (2 files)

1. **`supabase/migrations/20260115_add_importer_type.sql`**
   - Adds `importer_type` enum (SE, EU_PARTNER)
   - Updates `importers` table with type column
   - Creates index for type filtering

2. **`supabase/migrations/20260115_create_import_documents.sql`**
   - Creates `import_documents` table
   - Fields: import_id, type, version, storage_path, sha256, created_by
   - Unique constraint: (tenant_id, import_id, type, version)
   - RLS policies for tenant isolation

### Service Layer (2 files)

3. **`lib/shipment-validation-service.ts`**
   - `validateForShipment(importId, tenantId)` - Main validation function
   - Returns: `{ valid, error_code?, error_message? }`
   - Error codes:
     - `IMPORT_NOT_APPROVED` - Import status not APPROVED
     - `DDL_MISSING` - Delivery location not found
     - `DDL_NOT_APPROVED` - Delivery location not approved
     - `IMPORTER_MISSING` - Importer not found
     - `IMPORTER_TYPE_MISSING` - Importer type not set
     - `UNKNOWN_IMPORTER_TYPE` - Invalid importer type
   - Flow-specific validation:
     - `validateSEFlow()` - Swedish domestic validation
     - `validateEUPartnerFlow()` - EU partner validation

4. **`lib/import-document-service.ts`**
   - `generate5369(importId, tenantId, actorId?)` - Generate 5369_03 PDF
   - `listDocuments(importId, tenantId)` - List all documents
   - Reuses existing PDF generator from DDL compliance system
   - Handles versioning, hashing, and storage automatically

### API Endpoints (3 files)

5. **`app/api/imports/[id]/validate-shipment/route.ts`**
   - POST `/api/imports/:id/validate-shipment`
   - Returns validation result (200 always, check `valid` field)
   - Error handling: 404 if import not found, 500 for internal errors

6. **`app/api/imports/[id]/documents/5369/route.ts`**
   - POST `/api/imports/:id/documents/5369`
   - Generates new 5369_03 document
   - Returns: document_id, type, version, sha256, storage_path

7. **`app/api/imports/[id]/documents/route.ts`**
   - GET `/api/imports/:id/documents`
   - Lists all documents for import case
   - Returns: documents array with metadata

### Enhanced Smoke Test (1 file)

8. **`scripts/mvp-importcase-smoke.sh`** (Updated)
   - Added Test 3: Validate shipment FAIL (before approval)
   - Added Test 6: Validate shipment PASS (after approval)
   - Added Test 7: Generate 5369 document
   - Added Test 8: List documents
   - Now tests complete workflow: create → validate FAIL → approve → validate PASS → generate doc

## Validation Rules

### Common Rules (Both SE and EU_PARTNER)

All import cases must meet these requirements:

1. **Import Status** - Must be `APPROVED`
2. **Delivery Location** - Must exist
3. **Delivery Location Status** - Must be `APPROVED`
4. **Importer** - Must exist
5. **Importer Type** - Must be set (SE or EU_PARTNER)

### SE Flow Rules (Swedish Domestic)

For MVP: Common rules are sufficient.

**TODO (Future):**
- Verify importer has valid Swedish alcohol license
- Check excise reference number exists
- Validate customs clearance documentation

### EU_PARTNER Flow Rules (EU Imports)

For MVP: Common rules are sufficient.

**TODO (Future):**
- Verify logistics partner exists and is approved
- Check under-suspension chain documentation
- Validate EMCS (Excise Movement Control System) reference
- Verify partner has valid EU alcohol license

## Error Handling

### Validation Errors

The validation service returns structured errors:

```json
{
  "valid": false,
  "error_code": "IMPORT_NOT_APPROVED",
  "error_message": "Importen måste vara godkänd innan leverans kan ske. Aktuell status: SUBMITTED"
}
```

**Error messages are in Swedish** for end-user display.

### Document Generation Errors

- **404** - Import case not found
- **500** - PDF generation failed, upload failed, or database error
- Automatic cleanup: If document record save fails, uploaded PDF is deleted

## Usage Examples

### Validate Shipment

```bash
curl -X POST http://localhost:3000/api/imports/<import_id>/validate-shipment \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

**Response (FAIL):**
```json
{
  "valid": false,
  "error_code": "IMPORT_NOT_APPROVED",
  "error_message": "Importen måste vara godkänd innan leverans kan ske. Aktuell status: NOT_REGISTERED"
}
```

**Response (PASS):**
```json
{
  "valid": true
}
```

### Generate 5369 Document

```bash
curl -X POST http://localhost:3000/api/imports/<import_id>/documents/5369 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```

**Response:**
```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "SKV_5369_03",
  "version": 1,
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "storage_path": "documents/tenant-id/imports/import-id/5369/v1.pdf",
  "created_at": "2026-01-15T12:00:00Z",
  "message": "5369_03 document generated successfully (version 1)"
}
```

### List Documents

```bash
curl http://localhost:3000/api/imports/<import_id>/documents \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

**Response:**
```json
{
  "import_id": "550e8400-e29b-41d4-a716-446655440000",
  "documents": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "00000000-0000-0000-0000-000000000001",
      "import_id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "SKV_5369_03",
      "version": 1,
      "storage_path": "documents/tenant-id/imports/import-id/5369/v1.pdf",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "created_by": "00000000-0000-0000-0000-000000000001",
      "created_at": "2026-01-15T12:00:00Z"
    }
  ],
  "count": 1
}
```

## Testing

### Run Enhanced Smoke Test

```bash
# Start dev server
npm run dev

# Run smoke test with test data
npm run test:importcase \
  '<restaurant_id>' \
  '<importer_id>' \
  '<delivery_location_id>'
```

### Expected Test Flow

1. ✅ Create import case (status: NOT_REGISTERED)
2. ✅ Get import case details
3. ✅ Validate shipment → **FAIL** (error_code: IMPORT_NOT_APPROVED)
4. ✅ Update status to SUBMITTED
5. ✅ Update status to APPROVED
6. ✅ Validate shipment → **PASS** (valid: true)
7. ✅ Generate 5369 document (version 1)
8. ✅ List documents (count: 1)
9. ✅ Invalid transition blocked (409)
10. ⚠️ Attach supplier import (optional)
11. ✅ List linked supplier imports

## Architecture Details

### Validation Flow

```
Client Request
    ↓
POST /api/imports/:id/validate-shipment
    ↓
shipmentValidationService.validateForShipment()
    ↓
    ├─ Fetch import case + related data (restaurant, importer, DDL)
    ├─ Common validations (status, DDL exists, DDL approved)
    ├─ Determine flow type (SE vs EU_PARTNER)
    └─ Flow-specific validations
    ↓
Return { valid, error_code?, error_message? }
```

### Document Generation Flow

```
Client Request
    ↓
POST /api/imports/:id/documents/5369
    ↓
importDocumentService.generate5369()
    ↓
    ├─ Fetch import case + all related data
    ├─ Determine next version number
    ├─ Generate internal reference (IMPORT-{id}-{date}-v{version})
    ├─ Prepare DDLApplicationData
    ├─ Generate PDF via ddlDocumentGenerator
    ├─ Upload to Supabase Storage (/documents/{tenant}/{import}/5369/v{version}.pdf)
    └─ Insert record into import_documents table
    ↓
Return { document, storage_path, version }
```

### Document Versioning

- Each document type (e.g. SKV_5369_03) has independent versioning per import case
- Versions start at 1 and increment sequentially
- Unique constraint: (tenant_id, import_id, type, version)
- SHA-256 hash ensures file integrity
- Storage path format: `documents/{tenant_id}/imports/{import_id}/{type}/v{version}.pdf`

## Database Schema

### import_documents Table

```sql
CREATE TABLE import_documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES imports(id),

  type TEXT NOT NULL,           -- 'SKV_5369_03'
  version INTEGER NOT NULL,     -- 1, 2, 3...

  storage_path TEXT NOT NULL,   -- Supabase Storage path
  sha256 TEXT NOT NULL,         -- File integrity hash

  created_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT positive_version CHECK (version > 0),
  CONSTRAINT unique_import_document_version UNIQUE (tenant_id, import_id, type, version)
);
```

### importers.type Column

```sql
CREATE TYPE importer_type AS ENUM ('SE', 'EU_PARTNER');

ALTER TABLE importers
ADD COLUMN type importer_type NOT NULL DEFAULT 'SE';
```

## Integration Points

### Existing Systems

- **DDL Compliance System** - Reuses PDF generator (`lib/compliance/ddl-document-generator.ts`)
- **Import Case System** - Extends with validation and document generation
- **Supabase Storage** - Uses `documents` bucket for PDF storage

### Future Integrations

- **Shipment Service** - Call validate-shipment before creating shipment
- **Email Service** - Send document to Skatteverket via email
- **Webhook System** - Notify external systems when document generated
- **Compliance Dashboard** - Display validation status and documents

## Security

### RLS Policies

- `import_documents` table has RLS enabled
- Service role has full access (for API routes)
- Tenant isolation enforced via policies
- Documents only accessible within same tenant

### Storage Security

- Supabase Storage bucket: `documents`
- Path structure enforces tenant isolation: `documents/{tenant_id}/...`
- PDFs are private by default (require authentication)

## Performance

### Optimizations

- Validation uses single query with joins (minimizes round-trips)
- Document versioning uses efficient MAX(version) query
- Indexes on: (tenant_id, import_id, type) for fast lookups

### Considerations

- PDF generation is synchronous (200-500ms typical)
- For high volume, consider async generation with job queue
- Storage upload size limit: 50MB (configurable in Supabase)

## Troubleshooting

### Validation Fails Unexpectedly

**Check:**
1. Import status is APPROVED
2. Delivery location exists and status is APPROVED
3. Importer type is set (not NULL)
4. All required relationships exist

**Debug query:**
```sql
SELECT
  i.status as import_status,
  ddl.status as ddl_status,
  imp.type as importer_type
FROM imports i
LEFT JOIN direct_delivery_locations ddl ON i.delivery_location_id = ddl.id
LEFT JOIN importers imp ON i.importer_id = imp.id
WHERE i.id = 'your-import-id';
```

### Document Generation Fails

**Common issues:**
1. Missing required data (restaurant, importer, DDL)
2. Storage bucket doesn't exist or wrong permissions
3. Consent timestamp missing on DDL

**Check logs:**
```bash
# Check API logs
npm run dev

# Check Supabase Storage logs in dashboard
```

### PDF Not Found in Storage

**Verify:**
1. Storage bucket `documents` exists
2. Path format: `documents/{tenant_id}/imports/{import_id}/5369/v{version}.pdf`
3. Check `import_documents` table for storage_path value

## Next Steps (Post-MVP)

### Validation Enhancements

1. **SE Flow:**
   - Add excise reference validation
   - Verify Swedish alcohol license
   - Check customs clearance status

2. **EU_PARTNER Flow:**
   - Add logistics partner validation
   - Implement EMCS reference check
   - Verify under-suspension chain

### Document Features

1. **Additional Documents:**
   - Customs declarations
   - Transport documents
   - Invoice/packing lists

2. **Workflow Integration:**
   - Auto-send to Skatteverket via email
   - Digital signature support
   - Document approval workflow

### Monitoring

1. **Metrics:**
   - Validation success/failure rates
   - Document generation times
   - Error code distribution

2. **Alerts:**
   - High validation failure rate
   - Document generation errors
   - Storage quota warnings

## Summary

**Total Files Created/Modified:** 8 files
- Database: 2 migration files
- Service: 2 TypeScript files
- API: 3 route files
- Test: 1 bash script (updated)

**Key Features:**
✅ Shipment validation gatekeeper (SE + EU_PARTNER flows)
✅ 5369_03 PDF generation with versioning
✅ SHA-256 integrity hashing
✅ Supabase Storage integration
✅ Comprehensive smoke test (FAIL→PASS→document)
✅ Swedish error messages for end users
✅ Tenant isolation throughout

**Status:** ✅ Complete and ready for testing
