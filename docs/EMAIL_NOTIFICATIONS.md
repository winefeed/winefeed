# Email Notifications - Pilot Loop 1.0

## Översikt

Email-notifieringssystemet för Winefeed Pilot Loop 1.0 skickar transaktionella mejl vid tre kritiska events:

- **Event A: Offert skapad** - När en leverantör skapar en offert på en restaurangs förfrågan
- **Event B: Offert accepterad** - När en restaurang accepterar en leverantörs offert
- **Event C: Orderstatus uppdaterad** - När IOR uppdaterar orderns fulfillment-status (CONFIRMED → IN_FULFILLMENT → SHIPPED → DELIVERED)

### Arkitektur

```
API Route → Email Service → Resend API → SMTP → Mottagare
              ↓
         Event Logger → offer_events (audit trail for offers)
                     → order_events (audit trail for orders)
```

### Säkerhet

- **NO PRICE DATA** - Inga priser skickas i mejl (säkerhetspolicy)
- **Tenant isolation** - Email-mottagare verifieras via tenant_id
- **Fail-safe** - Mejlfel blockerar inte API-requests
- **Audit trail** - Alla mejlförsök loggas i `offer_events` tabell

---

## Setup

### 1. Skapa Resend-konto

1. Gå till [resend.com](https://resend.com)
2. Skapa konto (gratis tier: 100 mejl/dag)
3. Verifiera domän (eller använd Resends test-domän för dev)
4. Generera API-nyckel: **Settings → API Keys → Create API Key**

### 2. Konfigurera environment variables

Lägg till i `.env.local`:

```bash
# Email Notifications
EMAIL_NOTIFICATIONS_ENABLED=false           # true = skickar mejl, false = console.log
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx     # Din Resend API-nyckel
EMAIL_FROM=noreply@winefeed.se              # Avsändar-email (måste matcha verifierad domän)
NEXT_PUBLIC_APP_URL=http://localhost:3000   # För deep links i mejl
```

### 3. Konfigurera kontakt-emails i databas

Systemet hämtar mottagare från:

**För OFFER_CREATED (till restaurang):**
- Kolumn: `restaurants.contact_email`

**För OFFER_ACCEPTED (till leverantör):**
- Kolumn: `suppliers.kontakt_email`

**För ORDER_STATUS_UPDATED (till restaurang):**
- **Primary:** `restaurant_users` (all active users linked to restaurant, emails from `auth.users`)
- **Fallback:** `restaurants.contact_email` (if no active users exist)

Exempel SQL för att sätta test-emails:

```sql
-- Uppdatera restaurang contact_email (fallback för ORDER_STATUS_UPDATED)
UPDATE restaurants
SET contact_email = 'restaurant@example.com'
WHERE id = 'YOUR_RESTAURANT_ID';

-- Uppdatera leverantör kontakt_email
UPDATE suppliers
SET kontakt_email = 'supplier@example.com'
WHERE id = 'YOUR_SUPPLIER_ID';

-- För ORDER_STATUS_UPDATED: Skapa restaurant_users (recommended)
-- Users skapas automatiskt vid invite, ingen manuell konfiguration behövs
-- För att verifiera befintliga users:
SELECT ru.id, au.email, ru.is_active
FROM restaurant_users ru
JOIN auth.users au ON ru.id = au.id
WHERE ru.restaurant_id = 'YOUR_RESTAURANT_ID';
```

---

## Environment Variables

### EMAIL_NOTIFICATIONS_ENABLED

**Typ:** `boolean`
**Default:** `false`
**Värden:** `true` | `false`

**Beteende:**
- `false` - Dev mode: Loggar mejl till console istället för att skicka
- `true` - Production mode: Skickar mejl via Resend

**Exempel:**
```bash
# Development (ingen Resend API-nyckel behövs)
EMAIL_NOTIFICATIONS_ENABLED=false

# Production (kräver RESEND_API_KEY)
EMAIL_NOTIFICATIONS_ENABLED=true
```

### RESEND_API_KEY

**Typ:** `string`
**Default:** ingen
**Krävs:** Endast när `EMAIL_NOTIFICATIONS_ENABLED=true`

Hämta från: [resend.com/api-keys](https://resend.com/api-keys)

**Format:** `re_` följt av random string

**Exempel:**
```bash
RESEND_API_KEY=re_123abc456def789ghi
```

### EMAIL_FROM

**Typ:** `string`
**Default:** `noreply@winefeed.se`
**Krävs:** Nej (fallback till default)

**Krav:**
- Måste matcha verifierad domän i Resend
- För dev: Använd Resends test-domän (`onboarding@resend.dev`)
- För prod: Använd verifierad domän (`noreply@winefeed.se`)

**Exempel:**
```bash
# Development
EMAIL_FROM=onboarding@resend.dev

# Production
EMAIL_FROM=noreply@winefeed.se
```

### NEXT_PUBLIC_APP_URL

**Typ:** `string`
**Default:** `http://localhost:3000`
**Krävs:** Nej (fallback till default)

Bas-URL för deep links i mejl (t.ex. "Visa offert" knappar).

**Exempel:**
```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Staging
NEXT_PUBLIC_APP_URL=https://staging.winefeed.se

# Production
NEXT_PUBLIC_APP_URL=https://winefeed.se
```

---

## Email Templates

### OFFER_CREATED (till restaurang)

**Subject:** `📬 Ny offert på din förfrågan`

**Triggers när:**
- POST /api/offers anropas
- OCH `request_id` finns i body

**Mottagare:** `restaurants.contact_email`

**Content:**
- Restaurangnamn
- Förfrågans titel (`requests.fritext`)
- Leverantörens namn
- Offertens titel
- Antal rader (line items)
- Deep links:
  - `/dashboard/requests/[requestId]` (visa alla offerter för förfrågan)
  - `/offers/[offerId]` (visa offerten direkt)

**Exempel:**
```
Hej Restaurang AB,

Du har fått en ny offert från Vinleverantör Sverige på din förfrågan:

Förfrågan: Rödviner till jul
Offert: Julvinpaket 2025
Antal rader: 5 rader

[Visa offert]
```

**Inga priser visas** (säkerhetspolicy)

### OFFER_ACCEPTED (till leverantör)

**Subject:** `✅ Offert accepterad!`

**Triggers när:**
- POST /api/offers/[id]/accept anropas
- OCH offer har `supplier_id`

**Mottagare:** `suppliers.kontakt_email`

**Content:**
- Leverantörens namn
- Restaurangens namn
- Offertens titel
- Accepteringstidpunkt (svensk lokalisering)
- Deep links:
  - `/offers/[offerId]` (visa accepterad offert)
  - `/dashboard/requests/[requestId]` (om request finns)

**Exempel:**
```
Hej Vinleverantör Sverige,

Restaurang AB har accepterat din offert!

Offert: Julvinpaket 2025
Restaurang: Restaurang AB
Accepterad: 15 januari 2025 14:30

Offerten är nu låst och du kan inte längre redigera den.

[Visa accepterad offert]
```

**Inga priser visas** (säkerhetspolicy)

### ORDER_STATUS_UPDATED (till restaurang)

**Subject:** `[icon] Din order har uppdaterats: [Status]`

**Triggers när:**
- POST /api/ior/orders/[id]/status anropas
- OCH status uppdateras framgångsrikt

**Recipients:**
- **Primary:** All active `restaurant_users` linked to the order's restaurant (emails fetched from `auth.users`)
- **Fallback:** `restaurants.contact_email` if no active users found
- **Strategy:** `getRestaurantRecipients()` in `lib/email-service.ts`
  - Queries `restaurant_users` table for all active users
  - Fetches email from `auth.users` via `supabase.auth.admin.getUserById()`
  - Validates and deduplicates emails (case-insensitive)
  - Falls back to `contact_email` if no users exist
- **Audit Trail:** One `MAIL_SENT` event logged per recipient in `order_events` table
- **Example:** Restaurant with 3 active users generates 3 emails + 3 MAIL_SENT events per status update

**Content:**
- Restaurangnamn
- Order ID (truncated)
- Ny status (svensk översättning + ikon)
- Status-specifika meddelanden:
  - `IN_FULFILLMENT`: "Din order bearbetas nu för leverans"
  - `SHIPPED`: "Din order är nu på väg!"
  - `DELIVERED`: "Leveransen är slutförd! Vänligen verifiera att du mottagit varorna"
  - `CANCELLED`: "Ordern har avbrutits. Kontakta leverantören om du har frågor"
- Deep link: `/orders/[orderId]`

**Status Labels:**
- `CONFIRMED` → `✓ Bekräftad` (blå)
- `IN_FULFILLMENT` → `📦 I leverans` (orange)
- `SHIPPED` → `🚚 Skickad` (lila)
- `DELIVERED` → `✅ Levererad` (grön)
- `CANCELLED` → `❌ Avbruten` (röd)

**Exempel (SHIPPED):**
```
🚚 Din order har uppdaterats: Skickad

Hej Restaurang AB,

Din order har uppdaterats till ny status:

Order ID: abc123...
Ny status: 🚚 Skickad

Din order är nu på väg! Du kommer få ett nytt meddelande när leveransen är slutförd.

[Visa order]
```

**Fail-Safe Implementation:**
- Email-fel blockerar INTE status-uppdatering
- Om mejl misslyckas: Console log + event loggas med `success: false`
- Status-uppdatering lyckas oavsett email-status

**Audit Trail:**
- Loggas till `order_events` tabell
- Event type: `MAIL_SENT`
- Metadata: `{ template: "ORDER_STATUS_UPDATED", to_masked: "r***@example.com", success: true/false, error?: "..." }`

**Inga priser visas** (säkerhetspolicy)

---

## Testing

### Dev Mode (EMAIL_NOTIFICATIONS_ENABLED=false)

**Setup:**
```bash
# .env.local
EMAIL_NOTIFICATIONS_ENABLED=false
# RESEND_API_KEY behövs EJ
```

**Beteende:**
- Mejl skickas INTE via Resend
- Istället loggas mejl till console:
  ```
  📧 [EMAIL DISABLED] Would send email:
     To: restaurant@example.com
     Subject: 📬 Ny offert på din förfrågan
     Body: Hej Restaurang AB...
  ```
- MAIL_SENT events skapas fortfarande i `offer_events` med `success: true`

**Verifiera:**
1. Kör smoke test:
   ```bash
   bash scripts/mvp-request-offer-accept-smoke.sh
   ```

2. Kontrollera console output för email logs

3. Smoke test visar:
   ```
   Test 4B: Verify Email Event (OFFER_CREATED)
   ⚠ SKIP - No email event found (EMAIL_NOTIFICATIONS_ENABLED likely false)
   This is expected in dev mode with emails disabled
   ```

### Production Mode (EMAIL_NOTIFICATIONS_ENABLED=true)

**Setup:**
```bash
# .env.local
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=re_your_actual_key
EMAIL_FROM=onboarding@resend.dev  # eller verifierad domän
```

**Beteende:**
- Mejl skickas via Resend API
- MAIL_SENT events loggas med verkligt resultat:
  - `success: true` om mejl skickades
  - `success: false` om mejl misslyckades (med error message)

**Verifiera:**
1. Sätt test-emails i databas:
   ```sql
   UPDATE restaurants SET contact_email = 'dinemail@example.com' WHERE id = 'test-restaurant-id';
   UPDATE suppliers SET kontakt_email = 'dinemail@example.com' WHERE id = 'test-supplier-id';
   ```

2. Kör smoke test:
   ```bash
   bash scripts/mvp-request-offer-accept-smoke.sh
   ```

3. Kontrollera:
   - Console visar: `✅ Email sent to dinemail@example.com: 📬 Ny offert på din förfrågan`
   - Mejl kommer till inbox
   - Smoke test visar: `✓ PASS - Email event logged (success=true)`

4. Kontrollera Resend dashboard för delivery status

### Manuell Testing via API

**Test OFFER_CREATED:**
```bash
# 1. Skapa offer med request_id
curl -X POST http://localhost:3000/api/offers \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "restaurant_id": "YOUR_RESTAURANT_ID",
    "request_id": "YOUR_REQUEST_ID",
    "supplier_id": "YOUR_SUPPLIER_ID",
    "lines": [{"line_no": 1, "name": "Test Wine"}]
  }'

# 2. Kontrollera console/inbox för mejl

# 3. Verifiera event loggades
curl http://localhost:3000/api/offers/OFFER_ID \
  -H "x-tenant-id: YOUR_TENANT_ID" | jq '.events[] | select(.event_type == "MAIL_SENT")'
```

**Test OFFER_ACCEPTED:**
```bash
# 1. Acceptera offer
curl -X POST http://localhost:3000/api/offers/OFFER_ID/accept \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "x-user-id: YOUR_USER_ID"

# 2. Kontrollera console/inbox för mejl

# 3. Verifiera event loggades
curl http://localhost:3000/api/offers/OFFER_ID \
  -H "x-tenant-id: YOUR_TENANT_ID" | jq '.events[] | select(.payload.type == "OFFER_ACCEPTED")'
```

---

## Troubleshooting

### Mejl skickas inte (production mode)

**Symptom:** Console visar varning, inget mejl i inbox

**Möjliga orsaker:**

1. **RESEND_API_KEY saknas eller felaktig**
   ```
   ⚠️  RESEND_API_KEY not configured, skipping email
   ```
   **Fix:** Kontrollera att RESEND_API_KEY är satt i .env.local

2. **EMAIL_FROM matchar inte verifierad domän**
   ```
   ❌ Failed to send email: Domain not verified
   ```
   **Fix:** Använd `onboarding@resend.dev` för test, eller verifiera domän i Resend

3. **Mottagare saknas i databas**
   ```
   ⚠️  No email found for restaurant abc-123
   ```
   **Fix:** Sätt `contact_email` på restaurants/suppliers tabell

4. **Resend rate limit**
   ```
   ❌ Failed to send email: Rate limit exceeded
   ```
   **Fix:** Gratis tier = 100 mejl/dag. Uppgradera plan eller vänta till nästa dag.

### MAIL_SENT events syns inte i smoke test

**Symptom:** Test 4B/6B visar "SKIP"

**Diagnos:**
- Detta är **förväntat** när `EMAIL_NOTIFICATIONS_ENABLED=false`
- Events loggas fortfarande, men syns inte i test output

**Fix (om du vill testa events):**
1. Sätt `EMAIL_NOTIFICATIONS_ENABLED=true`
2. Kör smoke test igen
3. Test 4B/6B ska visa "PASS"

### Deep links fungerar inte i mejl

**Symptom:** Klick på "Visa offert" ger 404 eller fel URL

**Diagnos:**
- `NEXT_PUBLIC_APP_URL` är felaktigt satt

**Fix:**
```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Production (ingen trailing slash!)
NEXT_PUBLIC_APP_URL=https://winefeed.se
```

### Svenska tecken (åäö) visas konstigt

**Symptom:** "Ny offert på din förfrågan" blir "Ny offert p� din f�rfr�gan"

**Diagnos:**
- Email client saknar UTF-8 support (osannolikt för moderna clients)

**Fix:**
- Email templates har redan `<meta charset="UTF-8">`
- Kontrollera att Resend skickar med rätt content-type header
- Text-versionen ska fallback till plain text UTF-8

---

## Event Logging

Alla mejlförsök loggas i event-tabeller:

### Offer Events (`offer_events`)

Loggar OFFER_CREATED och OFFER_ACCEPTED emails.

**Schema:**
```typescript
{
  event_type: 'MAIL_SENT',
  payload: {
    type: 'OFFER_CREATED' | 'OFFER_ACCEPTED',
    to: 'recipient@example.com',
    success: true | false,
    error?: 'Error message if failed'
  }
}
```

**Query för att se offer email events:**
```sql
SELECT
  oe.created_at,
  oe.event_type,
  oe.payload->>'type' as email_type,
  oe.payload->>'to' as recipient,
  oe.payload->>'success' as success,
  oe.payload->>'error' as error
FROM offer_events oe
WHERE oe.event_type = 'MAIL_SENT'
ORDER BY oe.created_at DESC
LIMIT 10;
```

### Order Events (`order_events`)

Loggar ORDER_STATUS_UPDATED emails (one event per recipient).

**Schema:**
```typescript
{
  event_type: 'MAIL_SENT',
  actor_user_id: null,
  actor_name: 'System',
  metadata: {
    template: 'ORDER_STATUS_UPDATED',
    to_masked: 'm***@example.com',  // Masked for security
    success: true | false,
    error?: 'Error message if failed'
  }
}
```

**Query för att se order email events:**
```sql
SELECT
  oe.created_at,
  oe.event_type,
  oe.order_id,
  oe.metadata->>'template' as email_template,
  oe.metadata->>'to_masked' as masked_recipient,
  oe.metadata->>'success' as success,
  oe.metadata->>'error' as error
FROM order_events oe
WHERE oe.event_type = 'MAIL_SENT'
ORDER BY oe.created_at DESC
LIMIT 10;
```

**Count emails sent per order:**
```sql
SELECT
  oe.order_id,
  COUNT(*) as emails_sent,
  COUNT(*) FILTER (WHERE (oe.metadata->>'success')::boolean = true) as successful,
  COUNT(*) FILTER (WHERE (oe.metadata->>'success')::boolean = false) as failed
FROM order_events oe
WHERE oe.event_type = 'MAIL_SENT'
GROUP BY oe.order_id;
```

**Användningsfall:**
- Debugging: Hitta misslyckade mejlförsök
- Audit: Verifiera att mejl skickades till alla recipients
- Analytics: Räkna mejl per tenant/offer/order
- Multi-recipient tracking: Count unique recipients per order

---

## Security & Privacy

### NO PRICE DATA Policy

**Policy:** Inga priser får skickas i mejl

**Implementering:**
- Email templates inkluderar ENDAST:
  - Namn (restaurang, leverantör, vin)
  - Metadata (antal rader, timestamps)
  - Deep links till app
- `offered_unit_price_ore` skickas ALDRIG i mejl

**Varför:**
- Mejl kan läcka (forwarding, BCC, hacks)
- Priser är känslig affärsdata
- Följer säkerhetspolicy från Wine-Searcher integration

### Tenant Isolation

**Implementering:**
```typescript
// email-service.ts: getRestaurantEmail()
if (restaurant.tenant_id !== tenantId) {
  console.warn(`⚠️  Restaurant belongs to different tenant`);
  return null;
}
```

**Garanti:** Mejl kan aldrig skickas till mottagare i annan tenant

### Fail-safe Pattern

**Implementering:**
```typescript
try {
  const emailResult = await sendEmail({...});
  // Log event
  await logEmailEvent(...);
} catch (emailError) {
  console.error('Error sending email:', emailError);
  // Don't throw - email is not critical
}
```

**Garanti:** Email-fel blockerar aldrig API-requests (offer creation/acceptance)

---

## Production Checklist

Innan deploy till production:

- [ ] Resend-konto skapat
- [ ] Domän verifierad i Resend (t.ex. winefeed.se)
- [ ] RESEND_API_KEY genererad och testad
- [ ] EMAIL_NOTIFICATIONS_ENABLED=true i production .env
- [ ] EMAIL_FROM satt till verifierad domän (noreply@winefeed.se)
- [ ] NEXT_PUBLIC_APP_URL satt till production URL (https://winefeed.se)
- [ ] restaurants.contact_email ifylld för alla aktiva restauranger
- [ ] suppliers.kontakt_email ifylld för alla aktiva leverantörer
- [ ] Smoke test kört och godkänd (alla PASS)
- [ ] Test-mejl skickat och mottagit i production
- [ ] Resend webhook konfigurerad (optional, för delivery tracking)
- [ ] Email templates granskade av produktägare (svenska, branding)

---

## Support

**Email templates:** `/lib/email-templates.ts`
**Email service:** `/lib/email-service.ts`
**Trigger logic:**
- `/app/api/offers/route.ts` (OFFER_CREATED)
- `/app/api/offers/[id]/accept/route.ts` (OFFER_ACCEPTED)

**External docs:**
- Resend API: https://resend.com/docs
- Resend Node SDK: https://github.com/resendlabs/resend-node

**Questions:** Se Pilot Loop 1.0 dokumentation eller kontakta dev team.
