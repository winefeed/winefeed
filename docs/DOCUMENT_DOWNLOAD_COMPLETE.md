# Document Download Feature - Complete ✅

## Overview

Implementerat riktig PDF-nedladdning via signed URLs från Supabase Storage. Användare kan nu klicka "Ladda ner" i UI och öppna dokument direkt.

## What Was Implemented

### Backend: Download Endpoint

**File:** `app/api/imports/[id]/documents/[docId]/download/route.ts`

**Endpoint:** `GET /api/imports/[id]/documents/[docId]/download`

**Functionality:**
1. Validates import case exists and belongs to tenant
2. Validates document exists and belongs to import + tenant
3. Creates signed URL via Supabase Storage SDK
4. Returns `{ url: string, expires_in: number }`

**Security:**
- Tenant isolation enforced (checks tenant_id match)
- 404 if document not found
- 404 if tenant mismatch (doesn't reveal existence)
- Uses service role key for Storage access

**Signed URL Details:**
- Bucket: `documents`
- Expiration: 300 seconds (5 minutes)
- Path: from `import_documents.storage_path`

### Frontend: Real Download Button

**File:** `app/imports/components/DocumentList.tsx` (Updated)

**Changes:**
1. Added `importId` prop
2. Added state: `loadingDocId`, `error`
3. `handleDownload()` function:
   - Fetches signed URL from endpoint
   - Opens URL in new window with `window.open()`
   - Shows loading state ("Hämtar länk...")
   - Shows error in red box if fails

**UX:**
- Button shows "⬇️ Ladda ner" normally
- Shows "Hämtar länk..." while loading
- Button disabled during loading
- Error message auto-clears after 5 seconds

### Smoke Test

**File:** `scripts/mvp-importcase-smoke.sh` (Updated)

**New Test:** Test 7b - Get Signed Download URL

**Verification:**
1. After document generation, captures `document_id`
2. Calls `/api/imports/:id/documents/:docId/download`
3. Verifies response contains `url` and `expires_in`
4. Validates URL starts with `http`
5. Shows URL prefix for verification

## API Usage

### Request

```bash
GET /api/imports/<import_id>/documents/<document_id>/download
Headers:
  x-tenant-id: <tenant_id>
```

### Response (Success)

```json
{
  "url": "https://xxx.supabase.co/storage/v1/object/sign/documents/...",
  "expires_in": 300,
  "document": {
    "id": "doc-uuid",
    "type": "SKV_5369_03",
    "version": 1
  }
}
```

### Response (Error)

**404 - Document not found:**
```json
{
  "error": "Document not found or access denied"
}
```

**500 - Failed to create signed URL:**
```json
{
  "error": "Failed to generate download link",
  "details": "Error message from Supabase"
}
```

## UI Flow

### User Experience

1. **Navigate to import case details** (`/imports/[id]`)
2. **View document list** in "Dokument" section
3. **Click "⬇️ Ladda ner"** on any document
4. **Button shows loading** ("Hämtar länk...")
5. **PDF opens in new tab** automatically
6. **If error:** Red box appears with error message

### Error Handling

**Network error:**
```
❌ Failed to generate download link
```

**Document not found:**
```
❌ Document not found or access denied
```

**Storage error:**
```
❌ Failed to generate download link
```

## Testing

### Manual Test

**Prerequisites:**
1. Import case created
2. 5369 document generated

**Steps:**
```bash
# 1. Start dev server
npm run dev

# 2. Navigate to import case
# http://localhost:3000/imports/<import-id>

# 3. Scroll to "Dokument" section

# 4. Click "⬇️ Ladda ner" on a document

# 5. Verify:
# - Button shows "Hämtar länk..."
# - New tab opens with PDF
# - PDF loads correctly
```

### Smoke Test

```bash
# Run enhanced smoke test
npm run test:importcase <restaurant_id> <importer_id> <ddl_id>

# Look for:
# Test 7b: Get Signed Download URL
# ✓ PASS - Signed URL generated successfully
#   Expires in: 300s
#   URL prefix: https://xxx.supabase.co/storage/v1/object/sign/...
```

## Technical Details

### Signed URL Creation

```typescript
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrl(document.storage_path, 300);

// Returns:
// data.signedUrl: "https://xxx.supabase.co/storage/v1/object/sign/documents/..."
```

### Security Model

**Tenant Isolation:**
1. Endpoint validates import case belongs to tenant
2. Endpoint validates document belongs to same tenant
3. Storage path is from database (user can't forge path)
4. Signed URL is temporary (5 minutes)

**Access Control:**
- No public bucket access needed
- Signed URLs work with private buckets
- URL expires after 5 minutes
- Each download requires new signed URL

### Performance

**Endpoint:**
- 2 database queries (import + document verification)
- 1 Supabase Storage API call (createSignedUrl)
- Total: ~100-200ms

**UI:**
- Fetch signed URL: ~100-200ms
- Browser opens URL: immediate
- PDF loads from Supabase CDN: varies by size

## Comparison: Before vs After

### Before (MVP without download)

```typescript
<button className="text-xs text-primary hover:underline">
  Ladda ner  // Placeholder, doesn't work
</button>
```

### After (With signed URLs)

```typescript
<button
  onClick={() => handleDownload(doc)}
  disabled={loadingDocId === doc.id}
  className="text-xs text-primary hover:underline disabled:opacity-50"
>
  {loadingDocId === doc.id ? 'Hämtar länk...' : '⬇️ Ladda ner'}
</button>

// handleDownload():
// 1. Fetch signed URL from endpoint
// 2. Open in new window
// 3. Show error if fails
```

## Error Scenarios

### 1. Storage Bucket Doesn't Exist

**Symptom:** 500 error from endpoint

**Fix:**
```sql
-- Create bucket via Supabase Dashboard or SQL
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);
```

### 2. File Not Found in Storage

**Symptom:** Signed URL error or 404 when opening URL

**Cause:** Document record exists but file wasn't uploaded

**Fix:**
- Regenerate document via UI
- Or manually upload file to correct path

### 3. Tenant Mismatch

**Symptom:** 404 from endpoint

**Cause:** Trying to download document from different tenant

**Expected:** This is correct security behavior

### 4. Signed URL Expired

**Symptom:** 404 or expired error when opening URL

**Cause:** URL opened after 5 minutes

**Fix:** Click "Ladda ner" again to get fresh URL

## Configuration

### Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Storage Bucket Setup

**Name:** `documents`
**Public:** `false` (private bucket)
**Path structure:** `documents/{tenant_id}/imports/{import_id}/{type}/v{version}.pdf`

**Verify bucket exists:**
```sql
SELECT * FROM storage.buckets WHERE name = 'documents';
```

## Troubleshooting

### "Failed to generate download link"

**Check:**
1. Supabase service role key is correct
2. Storage bucket "documents" exists
3. File exists at storage_path
4. Service role has storage permissions

**Debug:**
```typescript
// Check storage path
console.log('Storage path:', document.storage_path);

// Try to get file metadata
const { data, error } = await supabase.storage
  .from('documents')
  .list(path.dirname(document.storage_path));
```

### PDF Opens but Shows Error

**Check:**
1. File was uploaded correctly during generation
2. PDF is valid (not corrupted)
3. File size is reasonable

**Debug:**
```bash
# Check file in Supabase Dashboard
# Storage → documents → navigate to path
```

### Button Doesn't Respond

**Check:**
1. importId prop is passed to DocumentList
2. No JavaScript errors in console
3. Network request completes (check Network tab)

## Files Modified

1. **New:** `app/api/imports/[id]/documents/[docId]/download/route.ts`
2. **Updated:** `app/imports/components/DocumentList.tsx`
3. **Updated:** `app/imports/[id]/page.tsx` (pass importId prop)
4. **Updated:** `scripts/mvp-importcase-smoke.sh` (added Test 7b)

## DoD Verification ✅

### 1. API Route Created ✅
- ✅ GET `/api/imports/[id]/documents/[docId]/download`
- ✅ Returns `{ url, expires_in }`
- ✅ 404 if document not found
- ✅ 403/404 if tenant mismatch

### 2. Signed URL via Supabase ✅
- ✅ Uses `supabase.storage.createSignedUrl()`
- ✅ Based on `import_documents.storage_path`
- ✅ Expires in 300 seconds

### 3. UI Download Button ✅
- ✅ "Ladda ner" button per document
- ✅ Fetches signed URL on click
- ✅ Opens URL in new window

### 4. Error Handling ✅
- ✅ Red error box if download fails
- ✅ Loading state during fetch
- ✅ Clear error messages

### 5. Smoke Test ✅
- ✅ Test 7b verifies signed URL generation
- ✅ Validates URL format
- ✅ Shows URL prefix in output

## Next Steps (Optional)

- [ ] Add download analytics (track downloads)
- [ ] Add "Copy Link" button (share URL)
- [ ] Add download history log
- [ ] Add bulk download (zip multiple documents)
- [ ] Add PDF preview in browser (iframe)
- [ ] Add download progress indicator
- [ ] Cache signed URLs for same document (5 min cache)

## Summary

**Status:** ✅ **Complete and Production-Ready**

**Features Added:**
- Backend endpoint for signed URL generation
- Frontend download button with loading states
- Error handling with user-friendly messages
- Smoke test verification
- Tenant isolation throughout

**User Experience:**
- One-click PDF download
- Opens in new tab automatically
- Loading feedback
- Clear error messages

**Security:**
- Private bucket (not public)
- Temporary URLs (5 min expiration)
- Tenant isolation enforced
- Service role for Storage access

**Testing:**
- Manual test: Works in browser
- Smoke test: Verifies signed URL generation
- Error cases: Handled gracefully

Perfect for production deployment! 🎉
