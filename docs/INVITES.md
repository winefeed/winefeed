# User Invites - Pilot Onboarding 1.0

## Overview

The invite system enables admin users to onboard restaurant and supplier users via email invitations. Users receive a secure link, create their account, and are automatically linked to the correct organization.

### Features

- **Admin-Controlled Onboarding** - Admin invites users via /admin/invites UI
- **Secure Tokens** - SHA-256 hashed tokens (never stored in plaintext)
- **Email Notifications** - Swedish invite emails via Resend
- **Simple Accept Flow** - One-click invite acceptance + account creation
- **Role-Based Linking** - Automatic linking to restaurant_users or supplier_users
- **Single Use** - Tokens can only be used once
- **Expiry** - Invites expire after 7 days

### User Flow

```
Admin creates invite → Email sent → User clicks link → User creates account → User linked to organization → Redirect to login
```

---

## Database Schema

### invites table

```sql
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Recipient info
  email TEXT NOT NULL,
  role invite_role NOT NULL, -- 'RESTAURANT' | 'SUPPLIER'

  -- Entity references (role-dependent)
  restaurant_id UUID NULL REFERENCES restaurants(id),
  supplier_id UUID NULL REFERENCES suppliers(id),

  -- Token security
  token_hash TEXT NOT NULL UNIQUE,

  -- Lifecycle
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ NULL,
  used_by_user_id UUID NULL,

  -- Audit
  created_by_user_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_restaurant_invite CHECK (
    (role = 'RESTAURANT' AND restaurant_id IS NOT NULL) OR
    (role = 'SUPPLIER' AND supplier_id IS NOT NULL)
  )
);
```

**Key Points:**
- `token_hash` stores SHA-256 hash (NOT plaintext token)
- `expires_at` defaults to 7 days from creation
- `used_at` NULL = pending, NOT NULL = already used
- Role-based constraints ensure correct entity linkage

### restaurant_users table

```sql
CREATE TABLE restaurant_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Junction table for multi-user restaurant access

### supplier_users table

Already exists from supplier onboarding migration.

---

## API Endpoints

### POST /api/admin/invites

**Purpose:** Create invite and send email

**Auth:** Admin-only (ADMIN_MODE=true or x-user-role=admin)

**Headers:**
```
Content-Type: application/json
x-tenant-id: <tenant-uuid>
x-user-id: <user-uuid> (optional)
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "RESTAURANT",  // or "SUPPLIER"
  "restaurant_id": "uuid",  // required if role=RESTAURANT
  "supplier_id": "uuid"     // required if role=SUPPLIER
}
```

**Response (201):**
```json
{
  "message": "Invite created successfully",
  "invite_id": "uuid",
  "email": "user@example.com",
  "role": "RESTAURANT",
  "expires_at": "2026-01-25T12:00:00Z"
}
```

**Error Responses:**
- `400` - Missing/invalid fields
- `403` - Unauthorized (admin access required)
- `500` - Internal server error

**Side Effects:**
- Creates invite record in DB
- Sends email with invite link
- Logs email event (fail-safe)

### GET /api/admin/invites

**Purpose:** List recent invites for admin UI

**Auth:** Admin-only

**Headers:**
```
x-tenant-id: <tenant-uuid>
```

**Response (200):**
```json
{
  "invites": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "role": "RESTAURANT",
      "entity_name": "Restaurang AB",
      "status": "pending",  // "pending" | "used" | "expired"
      "expires_at": "2026-01-25T12:00:00Z",
      "used_at": null,
      "created_at": "2026-01-18T12:00:00Z"
    }
  ],
  "count": 1
}
```

### GET /api/invites/verify

**Purpose:** Verify invite token and return metadata

**Auth:** None (token is the auth)

**Query Params:**
```
token=<64-char-hex-string>
```

**Response (200) - Valid:**
```json
{
  "is_valid": true,
  "email": "u***@example.com",  // Masked
  "role": "RESTAURANT",
  "entity_name": "Restaurang AB",
  "expires_at": "2026-01-25T12:00:00Z"
}
```

**Response (400) - Invalid:**
```json
{
  "is_valid": false,
  "error": "Invite has already been used"
  // or "Invite has expired"
  // or "Invalid invite token"
}
```

**Security:**
- Email is masked (u***@domain.com)
- No sensitive data exposed
- Token-based authentication

### POST /api/invites/accept

**Purpose:** Accept invite and create user account

**Auth:** None (token is the auth)

**Request Body:**
```json
{
  "token": "<64-char-hex-string>",
  "password": "SecurePassword123!",
  "name": "User Name"  // Optional
}
```

**Response (200):**
```json
{
  "message": "Invite accepted successfully",
  "user_id": "uuid",
  "email": "user@example.com",
  "role": "RESTAURANT"
}
```

**Error Responses:**
- `400` - Invalid token / Missing fields / Weak password
- `409` - Invite already used
- `410` - Invite expired
- `500` - Internal server error

**Side Effects:**
- Creates auth.users entry
- Links to restaurant_users or supplier_users
- Marks invite as used (used_at = NOW())
- Sets user_metadata with user_type

---

## UI Pages

### /admin/invites

**Purpose:** Admin interface for managing invites

**Features:**
- Create invite form (email + role + entity dropdown)
- List recent invites with status badges
- Auto-refresh
- Status indicators (pending/used/expired)

**Access:** Admin-only (requires ADMIN_MODE=true)

**URL:** `http://localhost:3000/admin/invites`

**Form Fields:**
- **Email** - Recipient email address
- **Roll** - RESTAURANT or SUPPLIER
- **Entity** - Dropdown of restaurants or suppliers (dynamic based on role)

**Invites List Columns:**
- Email
- Roll (with icon: 🍽️ or 🚚)
- Organisation (restaurant or supplier name)
- Status (colored badge)
- Skapad (created timestamp)
- Används (used timestamp or —)

### /invite

**Purpose:** Accept invite and create account

**Features:**
- Automatic token verification
- Show invite details (masked email, role, organization)
- Account creation form (name, password, confirm password)
- Error handling (expired, used, invalid tokens)
- Redirect to login after acceptance

**Access:** Public (requires valid token in URL)

**URL:** `http://localhost:3000/invite?token=<token>`

**Form Fields:**
- **Ditt namn** (optional) - User's full name
- **Lösenord** (required) - Min 8 characters
- **Bekräfta lösenord** (required) - Must match password

**Flow:**
1. Extract token from URL
2. Verify token (show loading spinner)
3. If invalid: Show error + "Gå till login" button
4. If valid: Show invite details + form
5. On submit: Accept invite → Redirect to /login?email=...&invited=true

---

## Email Template

### Subject

```
🍽️ Välkommen till Winefeed - Din inbjudan
```

(Icon changes based on role: 🍽️ for restaurant, 🚚 for supplier)

### Content

Swedish HTML + text email with:
- Winefeed branding (purple gradient header)
- Role-specific messaging
- Organization name
- Masked email display
- CTA button: "Acceptera inbjudan"
- Expiry notice (7 days)
- Security notice (single-use link)

### Example Text Version

```
Välkommen till Winefeed!

Hej,

Du har blivit inbjuden att gå med i Winefeed som restaurang för Restaurang AB.

Email: user@example.com
Roll: Restaurang
Organisation: Restaurang AB

Acceptera inbjudan genom att klicka på länken nedan:
https://winefeed.se/invite?token=abc123...

VIKTIGT: Denna inbjudan är giltig till 25 januari 2026 14:30.
Länken fungerar endast en gång.

---
Winefeed - Din B2B-marknadsplats för vin

Om du inte förväntade dig detta mejl, ignorera det bara.
```

---

## Security

### Token Generation

**Algorithm:** Secure random 32 bytes → hex string (64 chars)

```typescript
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

**Storage:** SHA-256 hash only

```typescript
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

**Verification:** Constant-time comparison

```typescript
function verifyToken(token: string, hash: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(hashToken(token)),
    Buffer.from(hash)
  );
}
```

### Token Lifecycle

1. **Generation** - Admin creates invite → token generated
2. **Email** - Plaintext token sent via email link
3. **Storage** - Only SHA-256 hash stored in DB
4. **Verification** - User clicks link → hash computed and compared
5. **Single Use** - After acceptance, `used_at` set → token invalid

### Email Masking

**Frontend Display:**
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '***';
  return `${maskedLocal}@${domain}`;
}
```

**Examples:**
- `user@example.com` → `u***@example.com`
- `admin@winefeed.se` → `a***@winefeed.se`

### Admin Access Control

**Dev Mode:**
```bash
ADMIN_MODE=true  # Anyone can access admin endpoints
```

**Production Mode:**
```bash
ADMIN_MODE=false  # Requires x-user-role: admin header
```

**Future Enhancement:**
- Implement middleware to verify JWT claims
- Add admin role to auth.users metadata
- Create admin_users table with granular permissions

### Password Requirements

- Minimum 8 characters
- Supabase default validation (no additional requirements in MVP)
- Can be enhanced with strength requirements later

### Expiry

- Default: 7 days from creation
- Configurable via `expires_at` timestamp
- Checked on verification and acceptance
- Expired invites cannot be used

---

## Testing

### Smoke Test

Run automated smoke test:

```bash
bash scripts/pilot-invite-smoke.sh
```

**Tests:**
1. Create restaurant invite (POST /api/admin/invites)
2. Create supplier invite
3. Verify invite token (GET /api/invites/verify) - with mock token
4. List invites (GET /api/admin/invites)
5. Accept invite (POST /api/invites/accept) - with mock token

**Expected Output:**
```
════════════════════════════════════════
Pilot Invite Onboarding - Smoke Test
════════════════════════════════════════

Test 1: Create Restaurant Invite
✓ PASS - Invite created (HTTP 201)

Test 2: Create Supplier Invite
✓ PASS - Supplier invite created (HTTP 201)

Test 3: Verify Invite Token
✓ PASS - Invalid token correctly rejected (HTTP 400)

Test 4: List Recent Invites
✓ PASS - Invites list retrieved (HTTP 200)

Test 5: Accept Invite (Mock Test)
✓ PASS - Invalid token correctly rejected (HTTP 400)

════════════════════════════════════════
✅ ALL TESTS PASSED
```

**Note:** Smoke test uses mock tokens for endpoint validation. For full end-to-end testing, use actual tokens from DB/email logs.

### Manual E2E Testing

#### 1. Create Invite (Admin)

1. Access: `http://localhost:3000/admin/invites`
2. Fill form:
   - Email: `test@example.com`
   - Roll: RESTAURANT
   - Entity: Select a restaurant
3. Click "Skicka inbjudan"
4. Verify success message
5. Check console logs for email content (if EMAIL_NOTIFICATIONS_ENABLED=false)

#### 2. Verify Email Sent

**Dev Mode (emails disabled):**
```bash
# Check server console for:
📧 [EMAIL DISABLED] Would send email:
   To: test@example.com
   Subject: 🍽️ Välkommen till Winefeed - Din inbjudan
   Body: Hej, Du har blivit inbjuden...
```

**Production Mode (emails enabled):**
- Check recipient inbox
- Verify email content matches template
- Extract invite link

#### 3. Extract Token

**From Email:**
```
https://winefeed.se/invite?token=abc123def456...
                                 ^^^^^^^^ 64-char hex string
```

**From Database (if needed):**
```sql
SELECT id, token_hash, email, created_at, expires_at
FROM invites
WHERE email = 'test@example.com'
ORDER BY created_at DESC
LIMIT 1;
```

**Regenerate plaintext token (NOT POSSIBLE - only hash stored)**

#### 4. Accept Invite (User)

1. Open invite link: `http://localhost:3000/invite?token=<token>`
2. Verify invite details displayed:
   - Masked email (t***@example.com)
   - Role (Restaurang)
   - Organization name
3. Fill form:
   - Name: "Test User"
   - Password: "TestPassword123!"
   - Confirm: "TestPassword123!"
4. Click "Acceptera inbjudan"
5. Verify redirect to `/login?email=test@example.com&invited=true`

#### 5. Verify User Created

**Check auth.users:**
```sql
SELECT id, email, email_confirmed_at, raw_user_meta_data
FROM auth.users
WHERE email = 'test@example.com';
```

**Check restaurant_users (if restaurant invite):**
```sql
SELECT id, restaurant_id, role, is_active
FROM restaurant_users
WHERE id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

**Check supplier_users (if supplier invite):**
```sql
SELECT id, supplier_id, role, is_active
FROM supplier_users
WHERE id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

#### 6. Verify Invite Marked Used

```sql
SELECT id, email, used_at, used_by_user_id
FROM invites
WHERE email = 'test@example.com'
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- `used_at` is NOT NULL
- `used_by_user_id` matches created user ID

#### 7. Verify Subsequent Invite Rejected

1. Try accessing invite link again
2. Expect error: "Invite has already been used"
3. Verify HTTP 400 response

---

## Troubleshooting

### Error: "Unauthorized: Admin access required"

**Symptom:** Cannot create invites from /admin/invites

**Cause:** ADMIN_MODE not enabled

**Fix:**
```bash
# Add to .env.local
ADMIN_MODE=true

# Restart dev server
npm run dev
```

---

### Error: "Invalid reference: restaurant or supplier not found"

**Symptom:** Invite creation fails with HTTP 400

**Cause:** restaurant_id or supplier_id doesn't exist

**Fix:**
1. Verify entity exists:
   ```sql
   SELECT id, name FROM restaurants WHERE tenant_id = 'YOUR_TENANT_ID';
   SELECT id, namn FROM suppliers;
   ```
2. Use valid ID from query results
3. If no entities exist, create test data first

---

### Error: "Invite has already been used"

**Symptom:** Cannot accept invite

**Cause:** Token was already used

**Fix:**
1. Check invite status:
   ```sql
   SELECT used_at, used_by_user_id FROM invites WHERE email = 'user@example.com';
   ```
2. If `used_at` is NOT NULL, invite is already used
3. Admin needs to create new invite

---

### Error: "Invite has expired"

**Symptom:** Cannot accept invite

**Cause:** Token expired (> 7 days old)

**Fix:**
1. Check expiry:
   ```sql
   SELECT expires_at, NOW() FROM invites WHERE email = 'user@example.com';
   ```
2. If `expires_at < NOW()`, invite is expired
3. Admin needs to create new invite

---

### No Invites Showing in Admin UI

**Symptom:** /admin/invites shows empty list

**Possible Causes:**

1. **Wrong Tenant ID**
   - Verify tenant_id in requests matches DB records
   - Check: `SELECT COUNT(*) FROM invites WHERE tenant_id = 'YOUR_TENANT_ID';`

2. **No Invites Created**
   - Create test invite via API or UI

3. **API Error**
   - Check browser console for errors
   - Check server logs for Supabase errors

---

### Invites Dropdown Empty

**Symptom:** Restaurant or Supplier dropdown shows "Välj..." but no options

**Cause:** No restaurants/suppliers in database

**Fix:**
1. Create test restaurant:
   ```sql
   INSERT INTO restaurants (id, name, tenant_id, contact_email)
   VALUES (gen_random_uuid(), 'Test Restaurant', 'TENANT_ID', 'test@example.com');
   ```

2. Create test supplier:
   ```sql
   INSERT INTO suppliers (id, namn, kontakt_email)
   VALUES (gen_random_uuid(), 'Test Supplier', 'supplier@example.com');
   ```

---

### Email Not Sent

**Symptom:** Console shows "⚠️ Failed to send invite email"

**Cause:** EMAIL_NOTIFICATIONS_ENABLED=false or missing RESEND_API_KEY

**Expected Behavior (Dev Mode):**
- EMAIL_NOTIFICATIONS_ENABLED=false → Emails logged to console (not sent)
- This is NORMAL for local development

**To Enable Real Emails:**
```bash
# Add to .env.local
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=re_your_actual_key
```

---

### Token Extraction from Console

**Symptom:** Need to test invite flow but don't have plaintext token

**Solution (Dev Mode):**
1. Create invite via /admin/invites
2. Check server console output:
   ```
   📧 [EMAIL DISABLED] Would send email:
      To: user@example.com
      Body: https://winefeed.se/invite?token=abc123def456...
   ```
3. Copy token from logged URL
4. Open `/invite?token=<token>`

**Note:** In production, tokens are only in emails (never logged)

---

## Production Checklist

Before deploying to production:

- [ ] Remove or restrict ADMIN_MODE (set to false)
- [ ] Implement proper admin role verification via middleware
- [ ] Enable EMAIL_NOTIFICATIONS_ENABLED=true
- [ ] Configure RESEND_API_KEY
- [ ] Set EMAIL_FROM to verified domain
- [ ] Set NEXT_PUBLIC_APP_URL to production URL
- [ ] Test invite flow end-to-end
- [ ] Verify email delivery
- [ ] Verify RLS policies enforced
- [ ] Set up monitoring for invite acceptance rate
- [ ] Configure rate limiting (max invites per day per tenant)
- [ ] Audit token generation entropy
- [ ] Test expired invite handling
- [ ] Test duplicate invite handling (same email)
- [ ] Document admin user creation process

---

## Rate Limiting (Future)

**Current:** No rate limiting implemented (MVP)

**Recommended:**
- Max 10 invites per day per tenant
- Max 3 invites per email per month
- Implement via Redis or in-memory cache

**Example Implementation:**
```typescript
// lib/invite-rate-limiter.ts
class InviteRateLimiter {
  async checkLimit(tenantId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const key = `invites:${tenantId}:${today}`;

    const count = await redis.get(key);
    if (count && parseInt(count) >= 10) {
      return false;  // Limit exceeded
    }

    await redis.incr(key);
    await redis.expire(key, 86400);  // 24 hours
    return true;
  }
}
```

---

## FAQ

### Q: Can I resend an invite?

**A:** Not in MVP. Workaround: Create new invite with same email (previous invite will remain unused).

**Future:** Add "Resend" button in admin UI that creates new invite and invalidates old one.

---

### Q: Can users have multiple roles?

**A:** No. Each invite is for ONE role (RESTAURANT or SUPPLIER) linked to ONE entity.

**Future:** Implement multi-organization users via junction tables.

---

### Q: What happens if user already has account?

**A:** If email already exists in auth.users:
- Invite acceptance links existing user to new organization
- User doesn't need to create new account
- Password field is ignored

**Note:** This requires testing the Supabase auth.admin.createUser behavior with existing emails.

---

### Q: Can I customize invite expiry?

**A:** Currently fixed at 7 days (database default).

**Future:** Add `expires_in_days` parameter to POST /api/admin/invites.

---

### Q: How do I bulk invite users?

**A:** Not supported in MVP.

**Workaround:** Create invites one-by-one via API or UI.

**Future:** Add CSV upload feature for bulk invites.

---

### Q: Can I revoke an invite?

**A:** Not directly in MVP.

**Workaround:** Delete invite from database:
```sql
DELETE FROM invites WHERE id = 'invite-uuid';
```

**Future:** Add "Revoke" button in admin UI.

---

## Related Documentation

- [Email Notifications](./EMAIL_NOTIFICATIONS.md) - Email service setup
- [Pilot Admin Console](./PILOT_ADMIN.md) - Admin monitoring tools
- [Supplier Onboarding](./SUPPLIER_ONBOARDING.md) - Supplier catalog management

---

## Support

**Files:**
- Migrations: `/supabase/migrations/20260118_create_invites_table.sql`
- Service: `/lib/invite-service.ts`
- API: `/app/api/admin/invites/route.ts`, `/app/api/invites/*/route.ts`
- UI: `/app/admin/invites/page.tsx`, `/app/invite/page.tsx`
- Email: `/lib/email-templates.ts` (userInviteEmail)
- Test: `/scripts/pilot-invite-smoke.sh`

**Questions:** Contact dev team or open GitHub issue.
