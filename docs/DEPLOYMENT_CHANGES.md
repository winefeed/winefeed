# Deployment Changes Summary

This document summarizes all changes made to prepare Winefeed for Vercel deployment.

## Changed Files

### 1. Configuration Files

#### `package.json` - Added Node 20 engine constraint
**Purpose:** Force Vercel to use Node 20 LTS instead of Node 24
**Changes:**
- Added `engines` field with `"node": ">=20 <21"` and `"npm": ">=10"`
- Added `csv-parse` dependency

#### `.nvmrc` - NEW FILE
**Purpose:** Explicit Node version specification for Vercel
**Content:**
```
20
```

#### `vercel.json` - NEW FILE
**Purpose:** Vercel deployment configuration
**Content:**
```json
{
  "buildCommand": "npm run build",
  "framework": "nextjs",
  "installCommand": "npm ci"
}
```

#### `.env.example` - UPDATED
**Purpose:** Comprehensive environment variable documentation
**Changes:**
- Reorganized with clear sections (REQUIRED vs OPTIONAL)
- Added EMAIL_NOTIFICATIONS_ENABLED flag
- Added EMAIL_FROM configuration
- Added GS1_API_KEY and GS1_API_URL
- Added API_BASE_URL
- Added matching engine configuration variables
- Added comprehensive comments explaining behavior when variables are missing

### 2. Code Fixes - Build Errors

#### `lib/email-service.ts` - CRITICAL FIX
**Purpose:** Prevent build failure when RESEND_API_KEY is missing
**Changes:**
- Changed from eager initialization (`const resend = new Resend(...)`) to lazy initialization
- Added `getResendClient()` function that only creates Resend client when API key is available
- Updated `sendEmail()` to use lazy-initialized client

**Before:**
```typescript
const resend = new Resend(process.env.RESEND_API_KEY);
```

**After:**
```typescript
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}
```

#### TypeScript Compilation Fixes (Multiple Files)

The following files had TypeScript strict mode errors fixed:

**app/admin/pilot/page.tsx**
- Added fallback for possibly undefined `item.id` in 4 map operations
- Pattern: `key={item.id || index}` and `{item.id?.substring(0, 16) || 'N/A'}`

**app/api/restaurant/orders/route.ts**
- Changed `import_id` to `import_case_id` (schema consistency)

**app/api/restaurant/orders/[id]/route.ts**
- Changed `import_id` to `import_case_id` (3 occurrences)
- Added type annotations for implicit `any`
- Fixed Supabase join array handling for `delivery_location`

**app/api/ior/orders/[id]/create-import/route.ts**
- Changed `order.import_id` to `order.import_case_id`

**app/api/ior/orders/[id]/route.ts**
- Changed `order.import_id` to `order.import_case_id`
- Added type annotations for `importCase` and `documents`

**app/api/admin/pilot/overview/route.ts**
- Changed `order.import_id` to `order.import_case_id` in timing calculation

**app/components/match/MatchPanel.tsx**
- Fixed prop structure: changed from passing separate props to passing full `result` object

**app/match-demo/page.tsx**
- Fixed variable naming: `producerSku` → `producer_sku`, etc.

**app/offers/[id]/page.tsx**
- Added `MatchStatus` import from correct module
- Fixed `checked_at` field requirement
- Mapped database fields to `OfferLineItem` structure correctly
- Fixed `onRemove` handler to not pass undefined

**lib/compliance/ddl-service.ts**
- Added placeholder address fields for importer (table doesn't have address fields)

**lib/import-document-service.ts**
- Convert `null` to `undefined` for `address_line2`

**lib/match-service.ts**
- Type assertion for `textFallback` when name exists

**lib/matching/product-matcher-v2.ts**
- Handle Supabase join arrays for `master_products` and `product_families`
- Fixed type filtering without type predicates

**lib/matching/product-matcher.ts**
- Handle Supabase join arrays for `master_products` and `product_families`

**scripts/acceptance-audit-log.ts**
- Execute subquery first to get array of IDs for `.in()` filter

**scripts/acceptance-family-logic.ts**
- Replace `.catch()` with try-catch blocks (query builders don't have `.catch()`)

**scripts/ddl-acceptance-documents.ts**
- Add `!!` for boolean coercion in assert calls

**scripts/ddl-acceptance-run.ts**
- Add `!!` for boolean coercion in assert calls

**scripts/ddl-acceptance-security.ts**
- Add `!!` for boolean coercion in `.every()` result

**scripts/test-matching-rules.ts**
- Add `!!` for boolean coercion in assert call

### 3. Documentation

#### `docs/DEPLOY_VERCEL.md` - NEW FILE
**Purpose:** Comprehensive deployment guide
**Sections:**
- Prerequisites checklist
- Local build verification
- Environment variables (minimal set)
- Vercel project configuration
- DNS setup for winefeed.se
- Post-deployment verification
- Troubleshooting common issues
- Security checklist
- Monitoring and maintenance

## Verification Commands

### 1. Verify Node Version
```bash
node -v
# Expected: v20.x.x (if using .nvmrc)
```

### 2. Verify Dependencies Installed
```bash
npm ci
# Should complete without errors
```

### 3. Verify Build Succeeds
```bash
npm run build
```

**Expected Output:**
```
✓ Compiled successfully
Linting and checking validity of types ...
✓ Generating static pages (34/34)
```

**Expected Warnings (Non-blocking):**
- `⚠️ GS1_API_KEY not configured` - OK if not using GS1
- `[WineSearcher] API key not configured` - OK if not using Wine-Searcher
- Multiple "Dynamic server usage" errors - OK, expected for API routes

### 4. Verify No TypeScript Errors
```bash
npx tsc --noEmit
# Should complete without errors
```

### 5. Verify Environment Variables
```bash
# Check .env.example exists and is comprehensive
cat .env.example

# Verify required variables are documented
grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_APP_URL)" .env.example
```

### 6. Verify Vercel Configuration
```bash
# Check vercel.json exists
cat vercel.json

# Check .nvmrc exists
cat .nvmrc
# Expected: 20

# Check package.json engines
grep -A2 '"engines"' package.json
# Expected: "node": ">=20 <21"
```

## Vercel UI Checklist

Before deploying to Vercel, ensure these settings are configured:

### General Settings
- [ ] Framework Preset: **Next.js**
- [ ] Node.js Version: **20.x**
- [ ] Build Command: `npm run build` (auto-detected)
- [ ] Install Command: `npm ci` (from vercel.json)
- [ ] Output Directory: `.next` (auto-detected)

### Environment Variables (Production)

**Required:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://xxxxx.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOi...` (public)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOi...` (mark as Sensitive)
- [ ] `NEXT_PUBLIC_APP_URL` = `https://winefeed.se`

**Optional (Recommended for Production):**
- [ ] `EMAIL_NOTIFICATIONS_ENABLED` = `true`
- [ ] `RESEND_API_KEY` = `re_...` (mark as Sensitive)
- [ ] `EMAIL_FROM` = `noreply@winefeed.se`

**Optional (Features):**
- [ ] `ANTHROPIC_API_KEY` = `sk-ant-api03-...` (mark as Sensitive)
- [ ] `WINESEARCHER_API_KEY` = `...` (mark as Sensitive)
- [ ] `WINESEARCHER_CACHE_TTL_DAYS` = `7`
- [ ] `GS1_API_KEY` = `...` (mark as Sensitive)
- [ ] `GS1_API_URL` = `https://api.gs1.org/v1`

### Domains
- [ ] Add domain: `winefeed.se`
- [ ] Add domain: `www.winefeed.se`
- [ ] Wait for SSL certificate to be issued (✅ status)

### DNS Configuration (at DNS Provider)

**A Record (Root Domain):**
- Type: `A`
- Name: `@` (or blank)
- Value: `76.76.21.21`
- TTL: `3600`

**CNAME Record (WWW):**
- Type: `CNAME`
- Name: `www`
- Value: `cname.vercel-dns.com`
- TTL: `3600`

## Testing After Deployment

### 1. Test Domain Resolution
```bash
# Test root domain
curl -I https://winefeed.se/
# Expected: HTTP/2 200

# Test www subdomain
curl -I https://www.winefeed.se/
# Expected: HTTP/2 200 or 308 redirect to root

# Verify SSL
curl -v https://winefeed.se/ 2>&1 | grep "SSL certificate verify"
# Expected: "SSL certificate verify ok"
```

### 2. Test API Endpoints
```bash
# Test environment debug endpoint (if it exists)
curl https://winefeed.se/api/debug/env

# Test a public API endpoint
curl https://winefeed.se/api/requests
# Expected: Auth error or data (depending on endpoint)
```

### 3. Test Application Flow
- [ ] Visit https://winefeed.se/
- [ ] Login/signup works
- [ ] Supabase connection works (data loads)
- [ ] Email notifications work (if enabled)

## Rollback Plan

If deployment fails:

1. **Revert to previous deployment** in Vercel Dashboard → Deployments → Select previous → Promote to Production
2. **Check logs** in Vercel Dashboard → Logs to identify the issue
3. **Fix locally** and redeploy
4. **DNS changes** take time to propagate, so domain issues may require waiting 15-30 minutes

## Summary of Key Changes

### Problem Solved
- **Node version:** Vercel was using Node 24.x, now forced to Node 20 LTS
- **Build failures:** Resend API key missing at build time, now uses lazy initialization
- **TypeScript errors:** 20+ files had strict mode issues, all fixed
- **Environment variables:** Now clearly documented with required vs optional

### Build Status
- ✅ TypeScript compilation succeeds
- ✅ Build completes successfully
- ✅ No blocking errors
- ⚠️ Expected warnings for missing optional API keys (non-blocking)

### Deployment Ready
- ✅ Node 20 configured via package.json + .nvmrc
- ✅ vercel.json created
- ✅ .env.example comprehensive
- ✅ Deployment guide created
- ✅ All build errors fixed

---

**Prepared by:** Claude Code
**Date:** 2026-01-16
**Node Version:** 20 LTS
**Next.js Version:** 14.2.21
