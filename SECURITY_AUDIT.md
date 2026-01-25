# Winefeed Security Audit Report

**Date:** 2026-01-24
**Auditor:** Claude (automated security review)

---

## Executive Summary

Security audit of API endpoints and middleware. Found several issues ranging from **critical** to **medium** severity. Most issues are explicitly marked as "MVP" temporary measures in code comments.

---

## CRITICAL Issues

### 1. Admin Review Queue - No Authorization Check
**File:** `app/api/admin/review-queue/route.ts`
**Lines:** 15-169

**Issue:** The endpoint has NO authentication or authorization checks. Any authenticated user can access the admin product match review queue.

**Impact:** Non-admin users can view all pending product matches, supplier data, and pricing information.

**Recommendation:** Add admin role check similar to `/api/admin/invites/route.ts`:
```typescript
const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
const isAdmin = await adminService.isAdmin(actor);
if (!isAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### 2. Quote-Requests Offers GET - Access Control Disabled
**File:** `app/api/quote-requests/[id]/offers/route.ts`
**Lines:** 368-370

**Issue:** The GET endpoint explicitly has access control commented out with a note "For MVP, we'll comment this out since we don't have auth yet".

```typescript
// NEW: ACCESS CONTROL - For MVP, we'll comment this out since we don't have auth yet
// In production, you would check: if (restaurantId !== quoteRequest.restaurant_id) return 403
// For now, we allow access to demonstrate the API structure
```

**Impact:** Anyone can view any restaurant's offers by knowing the quote request ID.

**Recommendation:** Implement the commented-out access control check.

---

### 3. Public Page Routes in Middleware
**File:** `middleware.ts`
**Lines:** 33-38

**Issue:** Admin, dashboard, and orders pages are explicitly marked as public:
```typescript
'/admin',            // MVP: Allow admin pages without auth
'/dashboard',        // MVP: Allow dashboard without auth
'/orders',           // MVP: Allow orders without auth
```

**Impact:** These routes are accessible without authentication. While pages may have their own auth checks, this bypasses the middleware security layer.

**Recommendation:** Remove these from publicPaths once proper authentication is implemented on all pages.

---

## HIGH Severity Issues

### 4. Debug Environment Endpoint Exposed
**File:** `app/api/debug/env/route.ts`
**Lines:** 1-9

**Issue:** Endpoint reveals whether API keys are configured and their lengths. No authentication required.

**Impact:** Information disclosure that helps attackers understand the system configuration.

**Recommendation:** Remove this endpoint in production or add admin-only access.

---

### 5. Offer Creation - Supplier ID Not Verified Against Session
**File:** `app/api/quote-requests/[id]/offers/route.ts`
**Lines:** 30-68

**Issue:** The POST endpoint accepts `supplierId` from request body but doesn't verify that the authenticated user IS that supplier. It only verifies that the supplier exists and is active.

**Impact:** A malicious user could potentially create offers on behalf of another supplier.

**Recommendation:** Verify the supplierId matches the authenticated user's supplier:
```typescript
const actor = await actorService.resolveActor({ user_id, tenant_id });
if (actor.supplier_id !== supplierId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## MEDIUM Severity Issues

### 6. Service Role Key Usage Pattern
**Multiple files**

**Issue:** Many API routes use `SUPABASE_SERVICE_ROLE_KEY` which bypasses all Row Level Security (RLS) policies. This is intentional for server-side operations but requires careful manual access control.

**Impact:** If any API endpoint forgets to check authorization, data from all tenants could be exposed.

**Current mitigations:** Most endpoints do filter by `tenant_id` in queries.

**Recommendation:** Consider using user-scoped tokens where possible. Document the security model.

---

### 7. Hardcoded Tenant ID
**File:** `middleware.ts`
**Lines:** 146-147

**Issue:** Single-tenant MVP uses hardcoded tenant ID:
```typescript
const tenantId = '00000000-0000-0000-0000-000000000001';
```

**Impact:** When multi-tenancy is added, this could lead to cross-tenant data access if not properly updated.

**Recommendation:** Document this as a known limitation. Add a TODO for multi-tenant implementation.

---

## LOW Severity Issues

### 8. Verbose Error Messages
**Multiple files**

**Issue:** Some endpoints return detailed error information including stack traces in production.

**Impact:** Information disclosure to attackers.

**Recommendation:** Use generic error messages in production, log details server-side.

---

## Positive Security Patterns Found

1. **IOR Orders endpoint** (`/api/ior/orders/[id]/route.ts`):
   - Properly checks `x-tenant-id` and `x-user-id` headers
   - Uses `actorService` to verify IOR role
   - Verifies order belongs to the importer
   - Good example to follow

2. **Admin Invites endpoint** (`/api/admin/invites/route.ts`):
   - Checks auth headers
   - Verifies admin role via `adminService.isAdmin()`
   - Proper error messages

3. **Offer Service** (`lib/offer-service.ts`):
   - Consistent tenant isolation in all queries
   - Immutability after acceptance
   - Audit trail via `offer_events`
   - Security validation on enrichment data

4. **Actor Service** (`lib/actor-service.ts`):
   - Clean role resolution
   - Tenant isolation
   - No sensitive data exposure

---

## Recommendations Summary

### Immediate Actions (Pre-production):
1. Add admin check to `/api/admin/review-queue`
2. Implement access control for quote-request offers GET
3. Remove or protect `/api/debug/env`
4. Remove admin/dashboard/orders from middleware publicPaths

### Before Production Launch:
1. Audit all API endpoints for proper authorization
2. Implement supplier ID verification in offer creation
3. Review error message verbosity
4. Add rate limiting to sensitive endpoints
5. Implement proper multi-tenant support

---

*This report was generated as part of a security review. All issues should be verified by a human security engineer before taking action.*
