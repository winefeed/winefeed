# Ship-Ready Gate + 5369 Document - Setup Guide

## Quick Start

### 1. Apply Database Migrations

Run migrations in order:

```bash
# If using Supabase CLI
npx supabase migration up

# Or apply manually via Supabase Studio SQL Editor
```

**Migration Order:**
1. `20260115_add_importer_type.sql` - Adds importer.type (SE/EU_PARTNER)
2. `20260115_create_import_documents.sql` - Creates import_documents table

### 2. Verify Migrations

```sql
-- Check importer type column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'importers' AND column_name = 'type';

-- Check import_documents table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'import_documents';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'import_documents';
```

### 3. Create Supabase Storage Bucket (if not exists)

```sql
-- Insert bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
```

**Or via Supabase Dashboard:**
1. Go to Storage
2. Create new bucket: `documents`
3. Set to **private** (not public)

### 4. Update Test Data (Optional)

Set importer type for existing importers:

```sql
-- Set test importer to SE type
UPDATE importers
SET type = 'SE'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Or create new EU_PARTNER importer
INSERT INTO importers (tenant_id, legal_name, org_number, contact_name, contact_email, contact_phone, type)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'EU Wine Partner GmbH',
  '234567-8902',
  'Hans Schmidt',
  'hans@euwinepartner.de',
  '+49301234567',
  'EU_PARTNER'
)
RETURNING id;
```

### 5. Ensure DDL is APPROVED for Test

For shipment validation to pass, the delivery location must be APPROVED:

```sql
-- Check DDL status
SELECT id, status, delivery_address_line1, city
FROM direct_delivery_locations
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Update test DDL to APPROVED (if needed)
UPDATE direct_delivery_locations
SET status = 'APPROVED', status_updated_at = NOW()
WHERE id = '<your-ddl-id>'
AND tenant_id = '00000000-0000-0000-0000-000000000001';
```

### 6. Start Dev Server

```bash
npm run dev
```

### 7. Run Enhanced Smoke Test

```bash
# Replace with actual IDs from your test data
npm run test:importcase \
  '<restaurant_id>' \
  '<importer_id>' \
  '<delivery_location_id>'

# Example with real UUIDs:
npm run test:importcase \
  '11111111-1111-1111-1111-111111111111' \
  '22222222-2222-2222-2222-222222222222' \
  '33333333-3333-3333-3333-333333333333'
```

## Manual Testing

### Test Sequence

#### 1. Create Import Case

```bash
curl -X POST http://localhost:3000/api/imports \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "restaurant_id": "YOUR_RESTAURANT_ID",
    "importer_id": "YOUR_IMPORTER_ID",
    "delivery_location_id": "YOUR_DDL_ID"
  }'
```

Save the returned `id` as `IMPORT_ID`.

#### 2. Validate Shipment (Should FAIL)

```bash
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/validate-shipment \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

**Expected:**
```json
{
  "valid": false,
  "error_code": "IMPORT_NOT_APPROVED",
  "error_message": "Importen måste vara godkänd innan leverans kan ske. Aktuell status: NOT_REGISTERED"
}
```

#### 3. Approve Import Case

```bash
# Submit
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/status \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"to_status": "SUBMITTED", "why": "Ready for review"}'

# Approve
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/status \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"to_status": "APPROVED", "why": "All documents OK"}'
```

#### 4. Validate Shipment (Should PASS)

```bash
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/validate-shipment \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

**Expected:**
```json
{
  "valid": true
}
```

If still failing, check DDL status:

```bash
# Check if DDL is approved
curl http://localhost:3000/api/imports/<IMPORT_ID> \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq '.delivery_location.status'
```

Should return `"APPROVED"`.

#### 5. Generate 5369 Document

```bash
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/documents/5369 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```

**Expected:**
```json
{
  "document_id": "...",
  "type": "SKV_5369_03",
  "version": 1,
  "sha256": "...",
  "storage_path": "documents/.../imports/.../5369/v1.pdf",
  "created_at": "...",
  "message": "5369_03 document generated successfully (version 1)"
}
```

#### 6. List Documents

```bash
curl http://localhost:3000/api/imports/<IMPORT_ID>/documents \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

**Expected:**
```json
{
  "import_id": "...",
  "documents": [
    {
      "id": "...",
      "type": "SKV_5369_03",
      "version": 1,
      "storage_path": "...",
      "sha256": "...",
      "created_at": "..."
    }
  ],
  "count": 1
}
```

#### 7. Verify PDF in Storage

Via Supabase Dashboard:
1. Go to Storage → `documents` bucket
2. Navigate to path: `documents/{tenant_id}/imports/{import_id}/5369/`
3. Should see `v1.pdf`
4. Download and open to verify content

## Troubleshooting

### Migration Errors

#### Error: "type already exists"

```sql
-- Drop and recreate if needed
DROP TYPE IF EXISTS importer_type CASCADE;
CREATE TYPE importer_type AS ENUM ('SE', 'EU_PARTNER');
```

#### Error: "table already exists"

```sql
-- Check if table exists
SELECT * FROM import_documents LIMIT 1;

-- If exists, migration already applied
-- Skip or drop table if testing
DROP TABLE IF EXISTS import_documents;
```

### Validation Errors

#### "DDL_NOT_APPROVED" after approving import

**Cause:** Delivery location (DDL) is not approved.

**Fix:**
```sql
UPDATE direct_delivery_locations
SET status = 'APPROVED', status_updated_at = NOW()
WHERE id = '<ddl-id>';
```

#### "IMPORTER_TYPE_MISSING"

**Cause:** Importer.type is NULL.

**Fix:**
```sql
UPDATE importers
SET type = 'SE'
WHERE id = '<importer-id>';
```

### Document Generation Errors

#### "Failed to upload PDF"

**Cause:** Storage bucket doesn't exist or wrong permissions.

**Fix:**
1. Check bucket exists in Supabase Dashboard → Storage
2. Create bucket named `documents` (private)
3. Ensure service role key has storage access

#### "Import case not found"

**Cause:** Wrong import_id or tenant_id mismatch.

**Fix:**
1. Verify import_id exists
2. Check tenant_id header matches import's tenant_id

#### "Failed to generate PDF"

**Cause:** Missing data (restaurant, importer, or DDL).

**Fix:**
```sql
-- Check all related data exists
SELECT
  i.id,
  r.id as restaurant_id,
  imp.id as importer_id,
  ddl.id as ddl_id
FROM imports i
LEFT JOIN restaurants r ON i.restaurant_id = r.id
LEFT JOIN importers imp ON i.importer_id = imp.id
LEFT JOIN direct_delivery_locations ddl ON i.delivery_location_id = ddl.id
WHERE i.id = '<import-id>';
```

All IDs should be non-null.

### TypeScript Errors

#### "Cannot find module '@/lib/shipment-validation-service'"

**Cause:** Path alias not configured.

**Fix:** Ensure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Restart Next.js dev server.

## Verification Queries

### Check Importer Types

```sql
SELECT id, legal_name, type
FROM importers
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
```

### Check Import Documents

```sql
SELECT
  id,
  import_id,
  type,
  version,
  storage_path,
  created_at
FROM import_documents
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC;
```

### Check DDL Status

```sql
SELECT
  id,
  delivery_address_line1,
  city,
  status,
  consent_given
FROM direct_delivery_locations
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
```

### Check Import Status

```sql
SELECT
  i.id,
  i.status,
  imp.type as importer_type,
  ddl.status as ddl_status
FROM imports i
LEFT JOIN importers imp ON i.importer_id = imp.id
LEFT JOIN direct_delivery_locations ddl ON i.delivery_location_id = ddl.id
WHERE i.tenant_id = '00000000-0000-0000-0000-000000000001';
```

## Test Data Setup Script

Create complete test data:

```sql
-- Set variables
\set tenant_id '00000000-0000-0000-0000-000000000001'
\set user_id '00000000-0000-0000-0000-000000000001'

-- 1. Create test importer (SE type)
INSERT INTO importers (tenant_id, legal_name, org_number, contact_name, contact_email, contact_phone, type)
VALUES (
  :'tenant_id',
  'Test Importer AB',
  '123456-7890',
  'Test Contact',
  'test@importer.se',
  '+46701234567',
  'SE'
)
ON CONFLICT DO NOTHING
RETURNING id;

-- 2. Create test restaurant (if not exists)
INSERT INTO restaurants (tenant_id, name, org_number, contact_email, contact_phone)
VALUES (
  :'tenant_id',
  'Test Restaurant',
  '234567-8901',
  'test@restaurant.se',
  '+46709876543'
)
ON CONFLICT DO NOTHING
RETURNING id;

-- 3. Create test DDL (APPROVED status)
INSERT INTO direct_delivery_locations (
  tenant_id,
  restaurant_id,
  importer_id,
  legal_name,
  org_number,
  delivery_address_line1,
  postal_code,
  city,
  country_code,
  contact_name,
  contact_email,
  contact_phone,
  consent_given,
  consent_timestamp,
  status
)
SELECT
  :'tenant_id',
  r.id,
  i.id,
  'Test Restaurant',
  '234567-8901',
  'Test Street 123',
  '12345',
  'Stockholm',
  'SE',
  'Test Manager',
  'manager@restaurant.se',
  '+46701112233',
  true,
  NOW(),
  'APPROVED'
FROM restaurants r, importers i
WHERE r.tenant_id = :'tenant_id'
  AND i.tenant_id = :'tenant_id'
LIMIT 1
ON CONFLICT DO NOTHING
RETURNING id;
```

## Next Steps After Setup

1. ✅ Verify all migrations applied
2. ✅ Run smoke test with real test data
3. ✅ Test API endpoints individually
4. 📋 Integrate validate-shipment into shipment creation workflow
5. 📋 Add document download endpoint
6. 📋 Build frontend UI for validation status
7. 📋 Add email sending for generated documents

## npm Scripts

```json
{
  "scripts": {
    "test:importcase": "bash scripts/mvp-importcase-smoke.sh",
    "test:routes": "bash scripts/test-check-route-slugs.sh"
  }
}
```

Run tests:
```bash
npm run test:importcase <restaurant_id> <importer_id> <ddl_id>
```

## Summary

**Setup Steps:**
1. ✅ Apply 2 migrations
2. ✅ Create `documents` storage bucket
3. ✅ Update test data (set importer.type, approve DDL)
4. ✅ Run smoke test
5. ✅ Verify validation and document generation works

**Common Issues:**
- DDL not approved → validation fails
- Importer type NULL → validation fails
- Storage bucket missing → document generation fails

**Expected Result:** All 11 smoke tests pass (or 9 if skipping supplier import attachment).
