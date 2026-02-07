# Producer Readiness Packs - Policy & Misuse Prevention

> **Feature Flag:** `FEATURE_PRODUCER_READINESS_PACKS=false` (disabled by default)

## What This Feature Is

Readiness Packs are an **optional service** to help producers deliver required materials (product sheets, pricing, data packs, etc.) to reduce IOR operational friction and increase ACCEPTED→OFFER conversion.

## What This Feature Is NOT

- ❌ NOT a way to "pay for priority"
- ❌ NOT a way to "buy access" to the platform
- ❌ NOT a factor in which requests get accepted
- ❌ NOT available before IOR acceptance

---

## Misuse Prevention Checklist

### 1. Timing Gate
- [ ] Packs can ONLY be created when `access_request.status` is in accepted state (`besvarad`, `meddelad`, `slutford`)
- [ ] DB trigger enforces this at database level
- [ ] Server-side validation double-checks before insert
- [ ] UI button only renders for accepted requests

### 2. Access Control
- [ ] Only IOR/admin can create packs (not producers)
- [ ] RLS policies restrict access to creator/admin
- [ ] No producer self-serve (future: producer portal with view-only)

### 3. Payment Isolation
- [ ] `payer` field is for the readiness SERVICE, not access
- [ ] `price_cents` is for service fee, never "priority fee"
- [ ] No Stripe integration in MVP (manual billing if needed)
- [ ] Clear separation from request acceptance flow

### 4. UI/UX Safeguards
- [ ] Button label: "Skapa Readiness Pack" (not "Priority Pack")
- [ ] Modal includes policy notice: "Detta påverkar inte vilka förfrågningar som accepteras"
- [ ] No pack UI in pre-accepted request states
- [ ] Status displayed as service status, not priority level

### 5. Audit Trail
- [ ] All pack operations logged to `readiness_pack_events`
- [ ] Actor ID and name recorded for every event
- [ ] Timestamps for all status changes
- [ ] Payload captures before/after values

### 6. Feature Flag
- [ ] `FEATURE_PRODUCER_READINESS_PACKS=false` by default
- [ ] Explicit opt-in required to enable
- [ ] Feature check at API, service, and UI levels

---

## Enforcement Layers

| Layer | Enforcement | Location |
|-------|-------------|----------|
| **Database** | Trigger blocks INSERT if status not accepted | `trg_check_accepted_before_pack` |
| **Database** | RLS restricts to creator/admin | `readiness_packs` RLS policies |
| **Server** | Status validation before create | `readiness-pack-service.ts` |
| **Server** | Feature flag check | All API routes |
| **UI** | Button hidden if not accepted | `ReadinessPackButton.tsx` |
| **UI** | Policy notice in modal | Create pack modal |
| **Audit** | All events logged | `readiness_pack_events` table |

---

## Acceptable Use Cases

✅ Producer needs help preparing a tech sheet → IOR creates pack post-acceptance
✅ IOR wants standardized data format → Pack scope includes "data_pack"
✅ Producer needs Swedish translations → Pack scope includes "translations"
✅ IOR charges service fee for readiness help → `price_cents` set, `payer='PRODUCER'`

## NOT Acceptable Use Cases

❌ Producer offers to pay for "faster acceptance" → REJECT
❌ Creating pack for request still in "ny" or "vidareskickad" → BLOCKED BY SYSTEM
❌ Displaying pack status as "priority level" → DO NOT IMPLEMENT
❌ Sorting/filtering requests by pack payment status → DO NOT IMPLEMENT

---

## Future Considerations

When enabling producer payment:
1. Payment must be for the readiness SERVICE only
2. Payment UI must be clearly separate from acceptance flow
3. No "paid requests get faster review" messaging
4. Consider "Readiness Service Fee" terminology

---

## Code Locations

| File | Purpose |
|------|---------|
| `supabase/migrations/20260206_readiness_packs.sql` | Schema, RLS, trigger |
| `lib/readiness-pack-types.ts` | Types, Zod schemas, constants |
| `lib/readiness-pack-service.ts` | Business logic, validation |
| `app/api/admin/readiness-packs/route.ts` | List & Create API |
| `app/api/admin/readiness-packs/[id]/route.ts` | Get & Update API |
| `app/access/admin/requests/components/ReadinessPackButton.tsx` | UI stub |

---

## Enabling the Feature

1. Run the migration: `supabase db push` or apply manually
2. Set environment variable: `FEATURE_PRODUCER_READINESS_PACKS=true`
3. Set client-side flag: `NEXT_PUBLIC_FEATURE_PRODUCER_READINESS_PACKS=true`
4. Deploy
5. Test with an accepted request
