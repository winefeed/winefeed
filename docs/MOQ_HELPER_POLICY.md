# MOQ Helper - Policy & Guardrail Checklist

> **Feature Flag:** `FEATURE_MOQ_HELPER=false` (disabled by default)

## What This Feature Is

MOQ Helper is a **fill-up suggestion tool** that helps consumers reach an importer's minimum order quantity (MOQ) AFTER their request has been ACCEPTED.

## What This Feature Is NOT

- ❌ NOT a shopping cart
- ❌ NOT a checkout flow
- ❌ NOT a payment system
- ❌ NOT available before acceptance
- ❌ NOT a way to bypass importer approval

---

## Core Principles

1. **Post-Acceptance Only**: The helper only appears after an importer has accepted a request
2. **Same Importer**: All suggestions come from the same importer as the original request
3. **No Commerce**: No totals, no checkout, no payment integration
4. **Optional**: Consumers can dismiss the banner and ignore suggestions
5. **Transparent**: Indicative prices shown for context only, clearly marked as approximate

---

## Guardrail Checklist

### 1. Timing Gate
- [ ] Helper ONLY available when `access_request.status` is in accepted state (`besvarad`, `meddelad`, `slutford`)
- [ ] DB trigger `trg_check_request_accepted_for_item` enforces this at database level
- [ ] Server-side validation in `moq-helper-service.ts` double-checks before allowing additions
- [ ] UI component only renders for accepted requests

### 2. Same-Importer Constraint
- [ ] DB trigger `trg_check_item_same_importer` blocks cross-importer additions
- [ ] Server-side validation verifies importer match before insert
- [ ] Suggestions only query lots from the same importer

### 3. No Cart/Commerce
- [ ] No "cart" terminology in code or UI
- [ ] No "total" or "subtotal" displayed anywhere
- [ ] No "checkout" or "pay" buttons
- [ ] No payment integration
- [ ] Price displayed as "ca X kr/fl" (indicative only)
- [ ] Clear messaging: "Fyll upp till importörens minimum"

### 4. Quantity Limits
- [ ] Max 24 bottles per item (DB constraint + server validation)
- [ ] Max 8 suggestions shown
- [ ] Reasonable caps to prevent abuse

### 5. Access Control
- [ ] Only request owner (consumer) can add items
- [ ] Only admins can edit importer MOQ settings
- [ ] RLS policies enforce row-level security

### 6. Audit Trail
- [ ] All interactions logged to `moq_helper_events`
- [ ] Event types: BANNER_SHOWN, SUGGESTIONS_SHOWN, ITEM_ADDED, ITEM_REMOVED, DISMISSED
- [ ] Payload includes relevant context for analytics

### 7. Feature Flag
- [ ] `FEATURE_MOQ_HELPER=false` by default
- [ ] `NEXT_PUBLIC_FEATURE_MOQ_HELPER=false` for client-side
- [ ] Feature check at API, service, and UI levels

---

## Enforcement Layers

| Layer | Enforcement | Location |
|-------|-------------|----------|
| **Database** | Trigger blocks INSERT if status not accepted | `trg_check_request_accepted_for_item` |
| **Database** | Trigger blocks INSERT if different importer | `trg_check_item_same_importer` |
| **Database** | Constraint limits quantity to 1-24 | `access_request_items.quantity` CHECK |
| **Server** | Status validation before add | `moq-helper-service.ts` |
| **Server** | Importer match validation | `moq-helper-service.ts` |
| **Server** | Feature flag check | All API routes |
| **UI** | Banner hidden if not accepted | `MOQHelperBanner.tsx` |
| **UI** | No cart/checkout UI | Component design |
| **Audit** | All events logged | `moq_helper_events` table |

---

## Acceptable Use Cases

✅ Consumer's request accepted → banner shows deficit and suggestions
✅ Consumer adds 2 more bottles from same importer to reach MOQ
✅ Consumer dismisses banner (not interested in adding more)
✅ Consumer removes an added item before finalizing

## NOT Acceptable Use Cases

❌ Showing suggestions for pending/rejected requests → BLOCKED BY SYSTEM
❌ Adding items from different importer → BLOCKED BY SYSTEM
❌ Displaying order totals or checkout button → NOT IMPLEMENTED
❌ Processing payment through MOQ helper → NOT IMPLEMENTED
❌ Sorting/prioritizing by payment status → NOT IMPLEMENTED

---

## Future Considerations

If expanding MOQ helper:
1. Case-based MOQ (6 cases vs 6 bottles) - add `moq_cases`, `moq_unit` to importers
2. Product-level MOQ override - already supported via `access_lots.min_quantity`
3. Importer-specific suggestion rules - extend suggestion algorithm
4. Bundle discounts - would require new discount model (NOT for v1)

Any expansion must maintain:
- No cart/checkout paradigm
- Post-acceptance timing gate
- Same-importer constraint
- Audit logging

---

## Code Locations

| File | Purpose |
|------|---------|
| `supabase/migrations/20260207_moq_helper.sql` | Schema, RLS, triggers |
| `lib/moq-helper-types.ts` | Types, Zod schemas, constants |
| `lib/moq-helper-service.ts` | Business logic, validation |
| `app/api/access/requests/[id]/moq/route.ts` | GET status + POST log events |
| `app/api/access/requests/[id]/moq/add/route.ts` | POST add + DELETE remove items |
| `components/access/MOQHelperBanner.tsx` | UI component |

---

## Enabling the Feature

1. Run the migration: `supabase db push` or apply manually
2. Set MOQ for importers: `UPDATE importers SET moq_bottles = 6 WHERE id = '...'`
3. Set environment variable: `FEATURE_MOQ_HELPER=true`
4. Set client-side flag: `NEXT_PUBLIC_FEATURE_MOQ_HELPER=true`
5. Deploy
6. Test with an accepted request from an importer with MOQ set

---

## Testing Checklist

Before enabling:

- [ ] Create test request, get it accepted
- [ ] Verify banner appears with correct MOQ/current/deficit
- [ ] Verify suggestions are from same importer only
- [ ] Add an item, verify it appears in added list
- [ ] Remove an item, verify it's removed
- [ ] Dismiss banner, verify it stays dismissed
- [ ] Check `moq_helper_events` table has logged events
- [ ] Try to add item for non-accepted request → should fail
- [ ] Try to add item from different importer → should fail
- [ ] Verify no "cart" or "checkout" language anywhere
