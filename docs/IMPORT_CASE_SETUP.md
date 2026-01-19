# Import Case MVP - Setup Guide

## Quick Start

### 1. Apply Database Migrations

Run migrations in this specific order:

```bash
# If using Supabase CLI
npx supabase migration up

# Or apply manually via Supabase Studio SQL Editor
```

**Migration Order:**
1. `20260115_create_importers_table.sql`
2. `20260115_create_imports_table.sql`
3. `20260115_add_import_id_to_supplier_imports.sql`
4. `20260115_create_import_status_events.sql`
5. `20260115_enable_rls_imports.sql`

### 2. Verify Tables Created

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('importers', 'imports', 'import_status_events');

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('importers', 'imports', 'import_status_events');
```

### 3. Create Test Data (Optional)

```sql
-- Set your tenant_id
SET LOCAL my.tenant_id = '00000000-0000-0000-0000-000000000001';

-- Create test restaurant (if not exists)
INSERT INTO restaurants (tenant_id, name, contact_email, contact_phone, org_number)
VALUES (
  current_setting('my.tenant_id')::uuid,
  'Test Restaurant',
  'test@restaurant.se',
  '+46701234567',
  '123456-7890'
)
ON CONFLICT DO NOTHING
RETURNING id;

-- Create test importer
INSERT INTO importers (tenant_id, legal_name, org_number, contact_name, contact_email, contact_phone)
VALUES (
  current_setting('my.tenant_id')::uuid,
  'Test Importer AB',
  '234567-8901',
  'Test Contact',
  'test@importer.se',
  '+46709876543'
)
RETURNING id;

-- Create test DDL (if not exists)
INSERT INTO direct_delivery_locations (
  tenant_id,
  restaurant_id,
  delivery_address_line1,
  postal_code,
  city,
  status
)
SELECT
  current_setting('my.tenant_id')::uuid,
  r.id,
  'Test Street 1',
  '12345',
  'Stockholm',
  'SKATTEVERKET_OK'
FROM restaurants r
WHERE r.tenant_id = current_setting('my.tenant_id')::uuid
LIMIT 1
ON CONFLICT DO NOTHING
RETURNING id;
```

### 4. Set Environment Variables

Ensure these are in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 5. Start Dev Server

```bash
npm run dev
```

### 6. Run Smoke Test

```bash
# Replace with actual IDs from your test data
npm run test:importcase \
  '<restaurant_id>' \
  '<importer_id>' \
  '<delivery_location_id>'

# Example with UUIDs:
npm run test:importcase \
  '11111111-1111-1111-1111-111111111111' \
  '22222222-2222-2222-2222-222222222222' \
  '33333333-3333-3333-3333-333333333333'
```

## Manual Testing

### Test 1: Create Import Case

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

Expected: Status 201, returns created import case with `id` and `status: "NOT_REGISTERED"`

### Test 2: Get Import Case

```bash
curl http://localhost:3000/api/imports/<IMPORT_ID> \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

Expected: Status 200, returns import case with related restaurant, importer, DDL data

### Test 3: Update Status to SUBMITTED

```bash
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/status \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "to_status": "SUBMITTED",
    "why": "Ready for approval"
  }'
```

Expected: Status 200, returns transition confirmation

### Test 4: Update Status to APPROVED

```bash
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/status \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "to_status": "APPROVED",
    "why": "All documents valid"
  }'
```

Expected: Status 200, returns transition confirmation

### Test 5: Invalid Transition (should fail)

```bash
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/status \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "to_status": "SUBMITTED"
  }'
```

Expected: Status 409, error message about invalid transition from APPROVED to SUBMITTED

### Test 6: Attach Supplier Import (optional)

```bash
curl -X POST http://localhost:3000/api/imports/<IMPORT_ID>/attach-supplier-import \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "supplier_import_id": "YOUR_SUPPLIER_IMPORT_ID"
  }'
```

Expected: Status 200, confirmation message

### Test 7: List Linked Supplier Imports

```bash
curl http://localhost:3000/api/imports/<IMPORT_ID>/supplier-imports \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

Expected: Status 200, returns array of linked supplier imports (empty array if none)

## Troubleshooting

### Migration Errors

**Error: "relation already exists"**
- Some tables may already exist from previous attempts
- Solution: Drop tables and rerun migrations, or skip that specific migration

**Error: "type already exists"**
- The `import_status` enum already exists
- Solution: Use `CREATE TYPE IF NOT EXISTS` or drop the type first

**Error: "column already exists"**
- The import_id column may already be on supplier_imports
- Solution: Skip that migration or use ALTER TABLE IF NOT EXISTS (Postgres 9.6+)

### API Errors

**401 Unauthorized**
- Missing `x-tenant-id` or `x-user-id` header
- Solution: Add required headers to request

**400 Bad Request**
- Missing required fields or invalid UUIDs
- Solution: Check request body matches expected schema

**404 Not Found**
- Import case doesn't exist or wrong tenant
- Solution: Verify import_id and tenant_id are correct

**409 Conflict**
- Invalid status transition attempted
- Solution: Check current status and valid transitions in service layer

**500 Internal Server Error**
- Database connection issue or FK violation
- Solution: Check Supabase logs and verify referenced IDs exist

### TypeScript Errors

**Cannot find module '@/lib/import-service'**
- tsconfig.json may not have path alias configured
- Solution: Ensure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Type errors in API routes**
- May need to restart Next.js dev server
- Solution: `npm run dev` (restart)

## Verification Commands

### Check Tables Created

```sql
-- List import-related tables
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%import%';
```

### Check Indexes

```sql
-- List indexes on imports table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'imports';
```

### Check RLS Policies

```sql
-- List policies on imports table
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'imports';
```

### Check Foreign Keys

```sql
-- List FK constraints on imports table
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'imports';
```

### Test Data Query

```sql
-- Count records
SELECT
  (SELECT COUNT(*) FROM importers) as importers_count,
  (SELECT COUNT(*) FROM imports) as imports_count,
  (SELECT COUNT(*) FROM import_status_events) as events_count;
```

## Next Steps After Setup

1. ✅ Verify all migrations applied successfully
2. ✅ Run smoke test with real test data
3. ✅ Test API endpoints individually
4. 📋 Create frontend UI for import case creation
5. 📋 Implement PDF generation workflow
6. 📋 Add email notifications
7. 📋 Build status dashboard

## Support

If you encounter issues:
1. Check Supabase logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure dev server is running (`npm run dev`)
4. Test database connectivity with simple query
5. Review migration order and dependencies

## Summary

**Files to verify:**
- ✅ 5 migration files in `supabase/migrations/`
- ✅ 2 service files in `lib/`
- ✅ 5 API route files in `app/api/imports/`
- ✅ 1 smoke test script in `scripts/`

**Commands to run:**
```bash
npx supabase migration up          # Apply migrations
npm run dev                        # Start dev server
npm run test:importcase <ids>     # Run smoke test
```

**Expected result:** All tests pass, import case workflow functions correctly.
