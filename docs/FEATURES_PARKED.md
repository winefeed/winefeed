# Parked Features Index

> Features that are scaffolded, tested, and ready to enable — but OFF by default.

**Kill Switch Principle:** All features use environment variables. To disable in emergency:
1. Set flag to `false` in Vercel Environment Variables
2. Redeploy (or wait for next deploy)
3. Already-created records remain in DB but UI hides them

---

## 1. MOQ Helper

**Purpose:** Help consumers fill up their order to meet importer's minimum order quantity (MOQ) AFTER their request has been accepted.

**NOT a cart** — this is RFQ fill-up, no checkout, no payment.

### Flags
```
FEATURE_MOQ_HELPER=false
NEXT_PUBLIC_FEATURE_MOQ_HELPER=false
```

### Migration
```
supabase/migrations/20260207_moq_helper.sql
```

**Creates:**
- `access_request_items` table (items added to RFQ)
- `moq_helper_events` table (analytics/audit)
- `importers.moq_bottles` column
- `importers.moq_note` column
- DB triggers for ACCEPTED-gate and same-importer constraint

### Files
| Type | Path |
|------|------|
| Types | `lib/moq-helper-types.ts` |
| Service | `lib/moq-helper-service.ts` |
| API (GET) | `app/api/access/requests/[id]/moq/route.ts` |
| API (POST/DELETE) | `app/api/access/requests/[id]/moq/add/route.ts` |
| UI | `components/access/MOQHelperBanner.tsx` |
| Policy | `docs/MOQ_HELPER_POLICY.md` |

### Activation Steps
```bash
# 1. Run migration
psql $DATABASE_URL -f supabase/migrations/20260207_moq_helper.sql
# Or via Supabase Dashboard → SQL Editor

# 2. Set MOQ for at least one importer
UPDATE importers SET moq_bottles = 6 WHERE id = 'IMPORTER_UUID';

# 3. Enable flags in Vercel
FEATURE_MOQ_HELPER=true
NEXT_PUBLIC_FEATURE_MOQ_HELPER=true

# 4. Deploy
```

### Smoke Tests

**When flag is OFF:**
```bash
curl -X GET https://yourapp.vercel.app/api/access/requests/ANY_ID/moq
# Expected: 404 {"error": "MOQ Helper feature is not enabled"}
```

**When flag is ON, request NOT accepted:**
```bash
curl -X GET https://yourapp.vercel.app/api/access/requests/PENDING_REQUEST_ID/moq \
  -H "Cookie: access_admin_token=VALID_TOKEN"
# Expected: 404 {"error": "MOQ helper not available for this request"}
```

**When flag is ON, request IS accepted, importer has MOQ:**
```bash
# GET status + suggestions
curl -X GET https://yourapp.vercel.app/api/access/requests/ACCEPTED_REQUEST_ID/moq \
  -H "Cookie: access_admin_token=VALID_TOKEN"
# Expected: 200 {"status": {"moq_bottles": 6, "current_bottles": 2, "deficit": 4, ...}, "suggestions": [...]}

# POST add item
curl -X POST https://yourapp.vercel.app/api/access/requests/ACCEPTED_REQUEST_ID/moq/add \
  -H "Cookie: access_admin_token=VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lot_id": "VALID_LOT_UUID", "quantity": 2}'
# Expected: 201 {"item": {"id": "...", "added_reason": "MOQ_HELPER", ...}}
```

### Rollback
1. Set `FEATURE_MOQ_HELPER=false` in Vercel
2. Redeploy (or env change triggers redeploy)
3. **Data:** `access_request_items` records remain but are hidden from UI
4. **Optional cleanup:** `DELETE FROM access_request_items WHERE added_reason = 'MOQ_HELPER'`

### Risks
- Low risk: Only affects post-acceptance flow
- No impact on existing request creation or importer response
- Triggers only apply to new `access_request_items` table

---

## 2. Producer Readiness Packs

**Purpose:** Help producers deliver required materials (tech sheets, price lists, data packs) AFTER IOR has accepted their request.

**NOT pay-for-priority** — this is a service, not a way to buy access.

### Flags
```
FEATURE_PRODUCER_READINESS_PACKS=false
NEXT_PUBLIC_FEATURE_PRODUCER_READINESS_PACKS=false
```

### Migration
```
supabase/migrations/20260206_readiness_packs.sql
```

**Creates:**
- `readiness_packs` table
- `readiness_pack_events` table (audit)
- DB trigger for ACCEPTED-gate

### Files
| Type | Path |
|------|------|
| Types | `lib/readiness-pack-types.ts` |
| Service | `lib/readiness-pack-service.ts` |
| API (List/Create) | `app/api/admin/readiness-packs/route.ts` |
| API (Get/Update) | `app/api/admin/readiness-packs/[id]/route.ts` |
| UI | `app/access/admin/requests/components/ReadinessPackButton.tsx` |
| Policy | `docs/READINESS_PACKS_POLICY.md` |

### Activation Steps
```bash
# 1. Run migration
psql $DATABASE_URL -f supabase/migrations/20260206_readiness_packs.sql
# Or via Supabase Dashboard → SQL Editor

# 2. Enable flags in Vercel
FEATURE_PRODUCER_READINESS_PACKS=true
NEXT_PUBLIC_FEATURE_PRODUCER_READINESS_PACKS=true

# 3. Deploy
```

### Smoke Tests

**When flag is OFF:**
```bash
curl -X GET https://yourapp.vercel.app/api/admin/readiness-packs
# Expected: 404 {"error": "Readiness packs feature is not enabled"}

curl -X POST https://yourapp.vercel.app/api/admin/readiness-packs \
  -H "Content-Type: application/json" \
  -d '{"access_request_id": "ANY_ID", "scope": {}, "payer": "IOR"}'
# Expected: 404 {"error": "Readiness packs feature is not enabled"}
```

**When flag is ON, request NOT accepted:**
```bash
curl -X POST https://yourapp.vercel.app/api/admin/readiness-packs \
  -H "Cookie: access_admin_token=VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"access_request_id": "PENDING_REQUEST_ID", "scope": {"product_sheet": true}, "payer": "IOR"}'
# Expected: 403 {"error": "Policy violation", "code": "NOT_ACCEPTED"}
```

**When flag is ON, request IS accepted:**
```bash
# Create pack
curl -X POST https://yourapp.vercel.app/api/admin/readiness-packs \
  -H "Cookie: access_admin_token=VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"access_request_id": "ACCEPTED_REQUEST_ID", "scope": {"product_sheet": true, "price_list": true}, "payer": "IOR"}'
# Expected: 201 {"pack": {"id": "...", "status": "DRAFT", ...}}

# List packs
curl -X GET https://yourapp.vercel.app/api/admin/readiness-packs \
  -H "Cookie: access_admin_token=VALID_TOKEN"
# Expected: 200 {"packs": [...], "total": N}
```

### Rollback
1. Set `FEATURE_PRODUCER_READINESS_PACKS=false` in Vercel
2. Redeploy
3. **Data:** `readiness_packs` records remain but UI button disappears
4. **Optional cleanup:** `DELETE FROM readiness_packs` (cascade deletes events)

### Risks
- Low risk: Only affects admin UI for accepted requests
- No impact on consumer-facing flows
- No impact on importer response flows

---

## Quick Reference

| Feature | Flag | Migration Date | Safe to Enable? |
|---------|------|----------------|-----------------|
| MOQ Helper | `FEATURE_MOQ_HELPER` | 2026-02-07 | Yes - new tables only |
| Readiness Packs | `FEATURE_PRODUCER_READINESS_PACKS` | 2026-02-06 | Yes - new tables only |

---

## Emergency Contacts

If something goes wrong after enabling:
1. **First:** Disable flag in Vercel → triggers redeploy
2. **If Vercel is down:** Rollback to previous commit in Vercel dashboard
3. **If DB is the problem:** Check Supabase logs, disable trigger if needed

---

*Last updated: 2026-02-07*
