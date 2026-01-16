# Pilot Admin Console

## Översikt

Pilot Admin Console är ett debugging-verktyg för att övervaka pilot-flöden (requests → offers → events) utan att behöva gå direkt till databasen.

### Features

- **Real-time Overview** - Se recent requests, offers, och events
- **Pilot Ops Alerts** - Operativa varningar för EU orders, import cases, stuck orders, email failures
- **Email Debugging** - Verifiera att emails skickades (MAIL_SENT events)
- **Status Tracking** - Följ offer status workflow (DRAFT → SENT → ACCEPTED)
- **Quick Links** - Klicka för att se detaljer i huvudapplikationen
- **Email Masking** - Skyddar känsliga email-adresser med maskering

### Use Cases

- **Pilot Debugging** - "Skapades offerten?", "Accepterades den?", "Skickades mailet?"
- **Flow Verification** - Följ hela request → offer → accept → email-flödet
- **Event Audit** - Se alla events för troubleshooting
- **Quick Sanity Check** - Snabb översikt utan SQL queries

---

## Setup

### 1. Enable Admin Mode

Lägg till i `.env.local`:

```bash
# Enable admin access (dev mode)
ADMIN_MODE=true
```

**Security Note:**
- `ADMIN_MODE=true` ger admin-åtkomst utan autentisering (endast för dev)
- För production: Implementera riktig admin-roll via middleware och x-user-role header

### 2. Restart Dev Server

```bash
npm run dev
```

### 3. Access Console

Öppna i browser:
```
http://localhost:3000/admin/pilot
```

---

## API Endpoint

### GET /api/admin/pilot/overview

**Purpose:** Fetch recent requests, offers, and events for admin monitoring

**Headers:**
```
x-tenant-id: <tenant-uuid>
```

**Response:**
```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "recent_requests": [
    {
      "id": "abc123...",
      "fritext": "Rödviner till jul",
      "restaurant_name": "Restaurang AB",
      "restaurant_email": "r***@example.com",
      "created_at": "2025-01-16T10:00:00Z"
    }
  ],
  "recent_offers": [
    {
      "id": "def456...",
      "title": "Julvinpaket",
      "status": "ACCEPTED",
      "restaurant_name": "Restaurang AB",
      "supplier_name": "Vinleverantör",
      "request_id": "abc123...",
      "accepted_at": "2025-01-16T11:00:00Z",
      "created_at": "2025-01-16T10:30:00Z"
    }
  ],
  "recent_events": [
    {
      "id": "ghi789...",
      "offer_id": "def456...",
      "event_type": "MAIL_SENT",
      "payload": {
        "type": "OFFER_ACCEPTED",
        "to": "s***@example.com",
        "success": true
      },
      "created_at": "2025-01-16T11:00:05Z"
    }
  ],
  "alerts": {
    "eu_orders_without_import_case": {
      "count": 2,
      "items": [
        {
          "id": "order-uuid-1",
          "created_at": "2025-01-15T10:00:00Z"
        }
      ]
    },
    "import_cases_missing_ddl_or_not_approved": {
      "count": 1,
      "items": [
        {
          "id": "import-uuid-1",
          "created_at": "2025-01-14T09:00:00Z",
          "ddl_status": "PENDING"
        }
      ]
    },
    "approved_import_cases_missing_5369": {
      "count": 0,
      "items": []
    },
    "orders_stuck_over_3_days": {
      "count": 1,
      "items": [
        {
          "id": "order-uuid-2",
          "status": "IN_FULFILLMENT",
          "updated_at": "2025-01-10T08:00:00Z"
        }
      ]
    },
    "email_failures_last_24h": {
      "count": 0,
      "items": []
    }
  },
  "timestamp": "2025-01-16T12:00:00Z"
}
```

**Limits:**
- `recent_requests`: Max 20
- `recent_offers`: Max 20
- `recent_events`: Max 50

**Security:**
- Emails are masked: `m***@domain.com`
- No price data included
- Tenant-scoped (only current tenant)
- Admin-only access required

**Status Codes:**
- `200` - Success
- `401` - Missing tenant context
- `403` - Unauthorized (admin access required)
- `500` - Internal server error

---

## Pilot Ops Alerts

Pilot Ops Alerts är en operativ övervakningsfunktion som visar varningar för potentiella problem i pilotdriften. Visas högst upp på admin-sidan som färgkodade kort.

### Alert Types

#### 1. EU Orders Without Import Case 🔴

**Vad det betyder:**
EU-orders som saknar länkad import case (compliance-flow inte startad).

**Varför det är viktigt:**
EU orders kräver import case för compliance. Om order saknar import case kan leverans blockeras.

**Action:**
- Verifiera att auto-create import case fungerar
- Manuellt skapa import case om behövs
- Kontakta IOR för att initiera compliance-flow

**Exempel:**
```json
{
  "count": 2,
  "items": [
    {
      "id": "order-uuid-1",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

#### 2. Import Cases Missing DDL or Not Approved 🟠

**Vad det betyder:**
Import cases som saknar Direct Delivery Location (DDL) eller har DDL som inte är approved.

**Varför det är viktigt:**
DDL måste vara approved innan 5369-dokumentation kan genereras. Utan approved DDL kan importen inte registreras.

**Action:**
- Verifiera att DDL skapats för import case
- Följ upp DDL approval-status
- Kontakta Tullverket om DDL är pending länge

**DDL Status Values:**
- `MISSING` - Ingen DDL kopplad
- `PENDING` - DDL väntar på approval
- `REJECTED` - DDL rejected (kräver rättelse)
- `APPROVED` - OK ✅

**Exempel:**
```json
{
  "count": 1,
  "items": [
    {
      "id": "import-uuid-1",
      "created_at": "2025-01-14T09:00:00Z",
      "ddl_status": "PENDING"
    }
  ]
}
```

#### 3. Approved Import Cases Missing 5369 🟡

**Vad det betyder:**
Import cases med status APPROVED men saknar 5369-dokument.

**Varför det är viktigt:**
5369-dokument är obligatoriska för EU imports. Om de saknas trots att importen är approved, indikerar det ett problem i dokumentgeneringsflödet.

**Action:**
- Verifiera att 5369-generator körts
- Manuellt trigga 5369-generering om behövs
- Kontrollera logs för dokumentgeneringsfel

**Exempel:**
```json
{
  "count": 0,
  "items": []
}
```

#### 4. Orders Stuck Over 3 Days 🟣

**Vad det betyder:**
Orders som inte uppdaterats på över 3 dagar och inte är i terminal status (DELIVERED/CANCELLED).

**Varför det är viktigt:**
Indikerar stuck orders som kan kräva manuell intervention. Normalt sett bör orders uppdateras regelbundet när de går genom fulfillment-flödet.

**Terminal Status (OK):**
- `DELIVERED` - Order levererad (normal slutstatus)
- `CANCELLED` - Order cancelled (normal slutstatus)

**Non-Terminal Status (ska uppdateras):**
- `CONFIRMED` - Bekräftad men ingen progress
- `IN_FULFILLMENT` - Pågående leverans
- `SHIPPED` - Skickad men ej levererad

**Action:**
- Kontrollera orderstatus manuellt
- Följ upp med supplier/IOR
- Uppdatera status om manuellt steg krävs

**Exempel:**
```json
{
  "count": 1,
  "items": [
    {
      "id": "order-uuid-2",
      "status": "IN_FULFILLMENT",
      "updated_at": "2025-01-10T08:00:00Z"
    }
  ]
}
```

#### 5. Email Failures Last 24h 💗

**Vad det betyder:**
Email-händelser (MAIL_SENT events) som misslyckades under senaste 24 timmarna från **både offer- och order-notifikationer**.

**Inkluderar failures från:**
- **Offer notifications** (`offer_events`):
  - `OFFER_CREATED` - När leverantör skapar offert
  - `OFFER_ACCEPTED` - När restaurang accepterar offert
- **Order notifications** (`order_events`):
  - `ORDER_STATUS_UPDATED` - När IOR uppdaterar orderstatus (CONFIRMED → IN_FULFILLMENT → SHIPPED → DELIVERED)

**Varför det är viktigt:**
Indikerar problem med email-notifications. Kunder kanske inte får viktiga meddelanden om offerter och orderstatus-uppdateringar.

**Action:**
- Kontrollera Resend API status
- Verifiera email-adresser är korrekta
- Kontrollera RESEND_API_KEY är valid
- Följ upp manuellt med affected customers

**Operational Workflow:**

1. **Click on failure card** → Navigerar till entity-vy (/offers/[id] eller /ior/orders/[id])
2. **Read action hint** → Följ specifika åtgärdstips för failure-typ
3. **Investigate error** → Kolla Resend dashboard, DB queries, logs
4. **Fix root cause** → Korrigera email-adresser, domän, API-nycklar, etc.
5. **Manual follow-up** → Kontakta affected customer om nödvändigt

**Template-specific actions:**
- `OFFER_CREATED`: Kontakta restaurang manuellt med offertinformation
- `OFFER_ACCEPTED`: Kontakta leverantör manuellt om accepterad offert
- `ORDER_STATUS_UPDATED`: Kontakta restaurang om statusändring (särskilt viktigt för SHIPPED/DELIVERED)

**Vanliga Orsaker:**
- Invalid email address
- Resend API rate limit
- Resend API credentials fel
- Email domain not verified
- No active restaurant_users (for ORDER_STATUS_UPDATED)

**Exempel (unified format with action_hint):**
```json
{
  "count": 2,
  "items": [
    {
      "source": "order_events",
      "event_id": "event-uuid-1",
      "created_at": "2025-01-16T10:30:00Z",
      "template": "ORDER_STATUS_UPDATED",
      "to_masked": "r***@example.com",
      "success": false,
      "error": "Invalid email address",
      "entity": {
        "order_id": "order-uuid-1"
      },
      "action_hint": "Kolla Resend/leveransstatus, mottagarlista (restaurant_users), samt domänverifiering."
    },
    {
      "source": "offer_events",
      "event_id": "event-uuid-2",
      "created_at": "2025-01-16T09:15:00Z",
      "template": "OFFER_CREATED",
      "to_masked": "s***@example.com",
      "success": false,
      "error": "Rate limit exceeded",
      "entity": {
        "offer_id": "offer-uuid-1"
      },
      "action_hint": "Kolla att request_id finns, samt restaurangmottagare (restaurant_users) och EMAIL_FROM."
    }
  ]
}
```

**Action Hints (Åtgärdstips):**

Varje failure-item innehåller ett `action_hint` fält med specifika åtgärdstips baserat på template:

| Template | Action Hint |
|----------|-------------|
| `ORDER_STATUS_UPDATED` | Kolla Resend/leveransstatus, mottagarlista (restaurant_users), samt domänverifiering. |
| `OFFER_CREATED` | Kolla att request_id finns, samt restaurangmottagare (restaurant_users) och EMAIL_FROM. |
| `OFFER_ACCEPTED` | Kolla supplier-mottagare (supplier_users), Resend status och domänverifiering. |
| Default | Kolla Resend logs och senaste MAIL_SENT events. |

**UI Display:**
- **Fully clickable card**: Click anywhere on failure item to navigate to related entity
- **Source badge**: 📦 Order (purple) or 📄 Offer (blue)
- **Template type**: Displayed prominently for context
- **Entity link**:
  - Order failures → `/ior/orders/[order_id]` (IOR admin view)
  - Offer failures → `/offers/[offer_id]` (offer detail view)
- **Masked email**: `r***@example.com` format for security
- **Error message**: Displayed with ❌ icon if present
- **Action hint**: Shown in blue box with 💡 icon at bottom of card
- **Timestamp**: Swedish format at bottom
- **Hover effect**: Card highlights on hover if clickable

### Alert UI

Alerts visas som cards i ett grid (3 kolumner):

```
⚠️ Pilot Ops Alerts

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ EU Orders       │ │ Import Cases    │ │ Approved Imports│
│ Missing Import  │ │ Missing DDL     │ │ Missing 5369    │
│                 │ │                 │ │                 │
│        [2] 🔴   │ │        [1] 🟠   │ │        [0] 🟢   │
│        ▶        │ │        ▶        │ │        ▶        │
└─────────────────┘ └─────────────────┘ └─────────────────┘

┌─────────────────┐ ┌─────────────────┐
│ Stuck Orders    │ │ Email Failures  │
│ No Update > 3d  │ │ Last 24 Hours   │
│                 │ │                 │
│        [1] 🟣   │ │        [0] 🟢   │
│        ▶        │ │        ▶        │
└─────────────────┘ └─────────────────┘
```

**Features:**
- **Count Badge** - Visar antal items (färgkodad: röd/orange/yellow/purple/pink om > 0, grön om 0)
- **Expandable** - Klicka för att visa lista med items
- **Border Color** - Visuell indikation av alert-typ
- **Scrollable List** - Max height 48 (scrollable om fler items)

**Interaction:**
1. Klicka på card för att expandera
2. Se lista med affected items (top 10)
3. Klicka igen för att collapse

### Alert Query Logic

#### EU Orders Without Import Case

```sql
SELECT id, created_at, seller_supplier_id
FROM orders
WHERE tenant_id = ?
  AND import_id IS NULL
  AND seller_supplier_id IN (
    SELECT id FROM suppliers WHERE type IN ('EU_PRODUCER', 'EU_IMPORTER')
  )
ORDER BY created_at DESC
LIMIT 10;
```

#### Import Cases Missing DDL

```sql
SELECT i.id, i.created_at, i.delivery_location_id, ddl.status
FROM imports i
LEFT JOIN direct_delivery_locations ddl ON i.delivery_location_id = ddl.id
WHERE i.tenant_id = ?
  AND (i.delivery_location_id IS NULL OR ddl.status != 'APPROVED')
ORDER BY i.created_at DESC
LIMIT 10;
```

#### Approved Imports Missing 5369

```sql
SELECT i.id, i.created_at
FROM imports i
WHERE i.tenant_id = ?
  AND i.status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM import_documents
    WHERE import_id = i.id AND document_type = '5369'
  )
ORDER BY i.created_at DESC
LIMIT 10;
```

#### Orders Stuck Over 3 Days

```sql
SELECT id, created_at, updated_at, status
FROM orders
WHERE tenant_id = ?
  AND status NOT IN ('DELIVERED', 'CANCELLED')
  AND updated_at < (NOW() - INTERVAL '3 days')
ORDER BY updated_at ASC
LIMIT 10;
```

#### Email Failures Last 24h

**Queries both offer_events and order_events, then merges and sorts:**

```sql
-- Offer email failures
SELECT
  'offer_events' AS source,
  id AS event_id,
  created_at,
  payload->>'type' AS template,
  payload->>'to' AS to_masked,
  FALSE AS success,
  payload->>'error' AS error,
  offer_id
FROM offer_events
WHERE tenant_id = ?
  AND event_type = 'MAIL_SENT'
  AND created_at >= (NOW() - INTERVAL '24 hours')
  AND (payload->>'success')::boolean = FALSE

UNION ALL

-- Order email failures
SELECT
  'order_events' AS source,
  id AS event_id,
  created_at,
  metadata->>'template' AS template,
  metadata->>'to_masked' AS to_masked,
  FALSE AS success,
  metadata->>'error' AS error,
  order_id
FROM order_events
WHERE tenant_id = ?
  AND event_type = 'MAIL_SENT'
  AND created_at >= (NOW() - INTERVAL '24 hours')
  AND (metadata->>'success')::boolean = FALSE

ORDER BY created_at DESC
LIMIT 10;
```

**Note:** Offer events use `payload` field, order events use `metadata` field. Implementation normalizes both to unified format.

### Security

**Email Masking:**
Email addresses in failures are masked using same `maskEmail()` function:
```typescript
// Before: user@example.com
// After:  u***@example.com
```

**No Sensitive Data:**
- ❌ No prices exposed
- ❌ No full email addresses
- ✅ Only IDs, timestamps, status flags

**Tenant Isolation:**
All queries filtered by `tenant_id` - users only see alerts for their tenant.

---

## Pilot KPI

### Overview

Pilot KPI metrics ger kvantitativ insikt i pilotens flöde och tidsled för att mäta effektivitet och identifiera flaskhalsar.

**Timeframe:** Last 30 days (tenant-scoped)

### Metrics Structure

API response innehåller `pilot_metrics` med två huvudkategorier:

```json
{
  "pilot_metrics": {
    "counts": {
      "requests_created": 45,
      "offers_created": 38,
      "offers_sent": 35,
      "offers_accepted": 28,
      "orders_created": 26,
      "imports_created": 22,
      "imports_approved": 20,
      "orders_shipped": 18
    },
    "timings": {
      "request_to_offer_created": {
        "median_hours": 2.5,
        "p90_hours": 8.3,
        "sample_size": 38
      },
      "offer_created_to_accepted": {
        "median_hours": 24.0,
        "p90_hours": 72.5,
        "sample_size": 28
      },
      "accept_to_order_created": {
        "median_hours": 1.2,
        "p90_hours": 3.8,
        "sample_size": 26
      },
      "order_created_to_import_approved": {
        "median_hours": 48.0,
        "p90_hours": 120.0,
        "sample_size": 20
      }
    }
  }
}
```

### Counts (Conversion Funnel)

**Funnel Flow:**
```
Requests → Offers Created → Offers Sent → Accepted →
Orders → Imports → Approved → Shipped
```

| Metric | Description | SQL Query |
|--------|-------------|-----------|
| `requests_created` | Total requests skapade (senaste 30d) | `SELECT COUNT(*) FROM requests WHERE tenant_id = ? AND created_at >= ?` |
| `offers_created` | Total offers skapade | `SELECT COUNT(*) FROM offers WHERE tenant_id = ? AND created_at >= ?` |
| `offers_sent` | Offers med status=SENT | `SELECT COUNT(*) FROM offers WHERE tenant_id = ? AND status = 'SENT' AND created_at >= ?` |
| `offers_accepted` | Offers med status=ACCEPTED | `SELECT COUNT(*) FROM offers WHERE tenant_id = ? AND status = 'ACCEPTED' AND created_at >= ?` |
| `orders_created` | Total orders skapade | `SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND created_at >= ?` |
| `imports_created` | Total import cases skapade | `SELECT COUNT(*) FROM imports WHERE tenant_id = ? AND created_at >= ?` |
| `imports_approved` | Import cases med status=APPROVED | `SELECT COUNT(*) FROM imports WHERE tenant_id = ? AND status = 'APPROVED' AND created_at >= ?` |
| `orders_shipped` | Orders med status=SHIPPED | `SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND status = 'SHIPPED' AND created_at >= ?` |

**Interpretation:**

- **High Drop-off (Requests → Offers Created):** Suppliers inte svarar → behöver fler suppliers eller påminnelser
- **High Drop-off (Offers Sent → Accepted):** Restaurants accepterar inte → offerterna är inte relevanta
- **High Drop-off (Accepted → Orders):** Problem i order creation flow → tekniskt fel eller process issue
- **High Drop-off (Orders → Imports Approved):** IOR-flaskhals → compliance tar lång tid

### Timings (Lead Time Metrics)

**Median vs P90:**
- **Median (50th percentile):** Typical case - hälften av operationerna tar längre tid, hälften kortare
- **P90 (90th percentile):** Worst-case scenario - 90% av operationerna tar kortare tid, 10% längre

| Metric | Description | Calculation |
|--------|-------------|-------------|
| `request_to_offer_created` | Tid från request till första offer skapas | `offer.created_at - request.created_at` |
| `offer_created_to_accepted` | Tid från offer skapas till accepteras | `offer.accepted_at - offer.created_at` |
| `accept_to_order_created` | Tid från offer accepteras till order skapas | `order.created_at - offer.accepted_at` |
| `order_created_to_import_approved` | Tid från order skapas till import godkänns | `import_status_event(APPROVED).created_at - order.created_at` |

**INSUFFICIENT DATA:**

Om `sample_size < 5`, returneras:
```json
{
  "median_hours": null,
  "p90_hours": null,
  "sample_size": 3
}
```

UI visar: `INSUFFICIENT DATA (n=3)`

**Thresholds & Actions:**

| Timing | Good (Median) | Warning (Median) | Critical (Median) | Action if Critical |
|--------|---------------|------------------|-------------------|-------------------|
| Request → Offer | < 4h | 4-24h | > 24h | Kontakta suppliers, påminn via email |
| Offer → Accept | < 24h | 24-72h | > 72h | Följ upp med restaurant, kolla om offer är relevant |
| Accept → Order | < 2h | 2-8h | > 8h | Teknisk bugg? Kolla order creation flow |
| Order → Import Approved | < 48h | 48-120h | > 120h | IOR-flaskhals, kolla compliance process |

### Performance Optimization

**Index-Friendly Queries:**

All count queries använder index på `(tenant_id, created_at)` eller `(tenant_id, status, created_at)`:

```sql
-- Optimized count query (uses index)
SELECT COUNT(*) FROM offers
WHERE tenant_id = ? AND status = 'SENT' AND created_at >= ?;
```

**Timing Calculation Strategy:**

1. Fetch minimal data with tenant_id + date filters (index-friendly)
2. Join in application layer (JavaScript)
3. Calculate percentiles client-side

This avoids heavy SQL aggregations and complex joins at DB level.

### UI Display

**Funnel Cards:**
```
┌────────────────────────────────────────────────────┐
│ 📈 Pilot KPI (Last 30 days, tenant-scoped)        │
├────────────────────────────────────────────────────┤
│ Conversion Funnel:                                 │
│  [45]     [38]      [35]     [28]     [26]   ...   │
│ Requests→Offers→Sent→Accepted→Orders→...           │
└────────────────────────────────────────────────────┘
```

**Timing Metrics:**
```
┌─────────────────────────────────────────────┐
│ Request → Offer Created                     │
│  Median: 2.5h  |  P90: 8.3h  |  Sample: 38  │
└─────────────────────────────────────────────┘
```

### Operational Playbook

**1. Large Funnel Drop → Identify Bottleneck**

Example:
- Requests: 100
- Offers Created: 95 (✅ Good conversion)
- Offers Sent: 92 (✅ Good)
- **Offers Accepted: 20** (❌ 78% drop!)
- Orders Created: 18

**Root Cause:** Restaurants not accepting offers

**Actions:**
1. Sample 10 rejected/unsent offers
2. Check if pricing is too high
3. Review offer templates (kanske för generiska?)
4. A/B test different offer formats

**2. High P90 Timing → Process Bottleneck**

Example:
- Order → Import Approved:
  - Median: 48h (✅ OK)
  - **P90: 240h** (❌ 10 days!)

**Root Cause:** 10% of imports stuck i compliance

**Actions:**
1. Identify stuck import cases (via Alerts)
2. Check if missing DDL or 5369 docs
3. Automate reminders for IOR when import > 120h

**3. Insufficient Data → Need More Volume**

Example:
- All timings show: `INSUFFICIENT DATA (n=2)`

**Root Cause:** Pilot has low transaction volume

**Actions:**
1. Wait for more data (need n≥5 for statistics)
2. Focus on funnel counts instead of timings
3. Manually review the 2 samples for qualitative insights

### Example API Response

```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "pilot_metrics": {
    "counts": {
      "requests_created": 45,
      "offers_created": 38,
      "offers_sent": 35,
      "offers_accepted": 28,
      "orders_created": 26,
      "imports_created": 22,
      "imports_approved": 20,
      "orders_shipped": 18
    },
    "timings": {
      "request_to_offer_created": {
        "median_hours": 2.5,
        "p90_hours": 8.3,
        "sample_size": 38
      },
      "offer_created_to_accepted": {
        "median_hours": 24.0,
        "p90_hours": 72.5,
        "sample_size": 28
      },
      "accept_to_order_created": {
        "median_hours": 1.2,
        "p90_hours": 3.8,
        "sample_size": 26
      },
      "order_created_to_import_approved": {
        "median_hours": 48.0,
        "p90_hours": 120.0,
        "sample_size": 20
      }
    }
  },
  "alerts": { ... },
  "recent_requests": [ ... ],
  "timestamp": "2025-01-16T12:00:00Z"
}
```

### Security

**No Sensitive Data:**
- ❌ No prices
- ❌ No emails
- ❌ No personal data
- ✅ Only counts, timestamps, and aggregated timings

**Tenant Isolation:**
All queries filtered by `tenant_id` - metrics are scoped to single tenant only.

---

## UI Components

### Layout

```
┌─────────────────────────────────────────┐
│  🔧 Pilot Admin Console                 │
│  Monitor pilot flows: requests → offers │
│                        [🔄 Refresh] [←] │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ [📋 Requests] [📄 Offers] [🔔 Events]  │
├─────────────────────────────────────────┤
│                                         │
│  [Tab content with tables]              │
│                                         │
└─────────────────────────────────────────┘
```

### Tabs

#### 1. Requests Tab

Shows recent requests from restaurants:

| Kolumn | Beskrivning |
|--------|-------------|
| ID | Request UUID (first 8 chars) |
| Fritext | Request description (truncated) |
| Restaurant | Restaurant name |
| Email | Masked email (r***@domain.com) |
| Created | Timestamp |
| Actions | "View →" link to `/dashboard/requests/[id]` |

#### 2. Offers Tab

Shows recent offers from suppliers:

| Kolumn | Beskrivning |
|--------|-------------|
| ID | Offer UUID (first 8 chars) |
| Title | Offer title |
| Status | DRAFT / SENT / ACCEPTED / REJECTED (colored badge) |
| Restaurant | Restaurant name |
| Supplier | Supplier name |
| Created | Timestamp |
| Actions | "View →" link to `/offers/[id]` |

**Status Colors:**
- DRAFT: Gray
- SENT: Yellow
- ACCEPTED: Green
- REJECTED: Red

#### 3. Events Tab

Shows recent offer events (including MAIL_SENT):

| Kolumn | Beskrivning |
|--------|-------------|
| Event Type | CREATED / UPDATED / ACCEPTED / MAIL_SENT etc. (colored badge) |
| Offer ID | Clickable link to offer |
| Details | Event-specific payload (email, success status, etc.) |
| Created | Timestamp |

**MAIL_SENT Events:**

Shows detailed email information:
```
Type: OFFER_CREATED
To: r***@example.com
Success: ✓ Yes
```

Or if failed:
```
Type: OFFER_ACCEPTED
To: s***@example.com
Success: ✗ No
Error: Error occurred
```

**Event Type Colors:**
- CREATED: Blue
- UPDATED: Yellow
- ACCEPTED: Green
- REJECTED: Red
- MAIL_SENT: Purple

---

## Testing

### Smoke Test

Run automated smoke test:

```bash
bash scripts/pilot-admin-smoke.sh
```

**What it tests:**
1. API returns HTTP 200
2. Response contains required arrays (recent_requests, recent_offers, recent_events)
3. Email addresses are masked in MAIL_SENT events
4. Alerts object exists with all 5 required keys
5. Each alert has count and items array
6. Data structure is valid JSON

**Expected output:**
```
════════════════════════════════════════
Pilot Admin Console - Smoke Test
════════════════════════════════════════

Test 1: GET /api/admin/pilot/overview
─────────────────────────────────────────
✓ PASS - HTTP 200 OK

Response structure:
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "requests_count": 5,
  "offers_count": 3,
  "events_count": 12,
  "timestamp": "2025-01-16T12:00:00.000Z"
}

Test 2: Verify Email Masking in Events
─────────────────────────────────────────
Found 2 MAIL_SENT events
Sample email address: r***@example.com
✓ PASS - Email address is masked

Test 3: Verify Pilot Ops Alerts
─────────────────────────────────────────
✓ PASS - alerts object exists
  ✓ eu_orders_without_import_case: count=2, items=2
  ✓ import_cases_missing_ddl_or_not_approved: count=1, items=1
  ✓ approved_import_cases_missing_5369: count=0, items=0
  ✓ orders_stuck_over_3_days: count=1, items=1
  ✓ email_failures_last_24h: count=0, items=0
✓ PASS - All 5 alert keys present with count and items

Alerts summary:
{
  "eu_orders_without_import": 2,
  "import_missing_ddl": 1,
  "approved_missing_5369": 0,
  "stuck_orders": 1,
  "email_failures": 0
}

════════════════════════════════════════
Test Summary
════════════════════════════════════════
Passed: 5
Failed: 0

✅ ALL TESTS PASSED

Admin console is ready to use:
  → http://localhost:3000/admin/pilot
```

### Manual Testing

#### Test 1: Verify Requests Appear

1. Create a request via API or UI
2. Refresh admin console
3. Check "Requests" tab
4. Verify request appears with correct restaurant name

#### Test 2: Verify Offers Appear

1. Create an offer via API
2. Refresh admin console
3. Check "Offers" tab
4. Verify offer appears with status DRAFT
5. Accept offer via API
6. Refresh admin console
7. Verify status changed to ACCEPTED

#### Test 3: Verify Email Events

1. Enable emails: `EMAIL_NOTIFICATIONS_ENABLED=true`
2. Create offer linked to request
3. Refresh admin console
4. Check "Events" tab
5. Verify MAIL_SENT event exists with:
   - Type: OFFER_CREATED
   - To: masked email (r***@domain.com)
   - Success: true/false

#### Test 4: Verify Links Work

1. Click "View →" on a request
2. Verify redirect to `/dashboard/requests/[id]`
3. Click offer ID in events tab
4. Verify redirect to `/offers/[id]`

---

## Security

### Admin Access Control

**Dev Mode:**
```bash
ADMIN_MODE=true  # Anyone can access admin console
```

**Production Mode:**
```bash
ADMIN_MODE=false  # Requires x-user-role: admin header
```

**Future Enhancement:**
- Implement middleware to set `x-user-role` based on auth.users role
- Add RLS policy for admin_users table
- Require authentication for /admin/* routes

### Email Masking

All email addresses are masked before sending to frontend:

**Implementation:**
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '***';
  return `${maskedLocal}@${domain}`;
}
```

**Examples:**
- `markus@example.com` → `m***@example.com`
- `supplier@winefeed.se` → `s***@winefeed.se`

### No Sensitive Data

**What's Excluded:**
- ❌ Full email addresses
- ❌ Price data (offered_unit_price_ore)
- ❌ Payment information
- ❌ Personal identification numbers
- ❌ API keys or secrets

**What's Included:**
- ✅ Entity IDs (UUIDs)
- ✅ Names (restaurant, supplier, wine)
- ✅ Titles and descriptions
- ✅ Timestamps
- ✅ Status flags
- ✅ Event types

### Tenant Isolation

All queries are tenant-scoped:

```typescript
.eq('tenant_id', tenantId)
```

**Guarantee:** Users can only see data from their own tenant

---

## Troubleshooting

### Error: "Unauthorized: Admin access required"

**Symptom:**
```
Access Denied
Unauthorized: Admin access required. Set ADMIN_MODE=true in .env.local
```

**Cause:** `ADMIN_MODE` is not set to `true` in `.env.local`

**Fix:**
1. Add to `.env.local`:
   ```bash
   ADMIN_MODE=true
   ```
2. Restart dev server:
   ```bash
   npm run dev
   ```
3. Refresh browser

---

### Error: "Missing tenant context"

**Symptom:**
```
HTTP 401
{ "error": "Missing tenant context" }
```

**Cause:** `x-tenant-id` header not set (should be automatic from middleware)

**Fix (if middleware not working):**
1. Check middleware is configured in `middleware.ts`
2. Verify tenant_id is in session/JWT
3. Temporarily hardcode in fetch:
   ```typescript
   headers: {
     'x-tenant-id': '00000000-0000-0000-0000-000000000001'
   }
   ```

---

### No Requests/Offers/Events Showing

**Symptom:** All tabs show "Inga [X] ännu" (No [X] yet)

**Possible Causes:**

1. **Empty Database**
   - Create test data via API or smoke tests
   - Run request-offer-accept smoke test:
     ```bash
     bash scripts/mvp-request-offer-accept-smoke.sh
     ```

2. **Wrong Tenant ID**
   - Verify tenant_id in header matches database records
   - Check `SELECT * FROM requests WHERE tenant_id = 'YOUR_TENANT_ID';`

3. **API Error**
   - Check browser console for errors
   - Check server logs for Supabase errors
   - Verify SUPABASE_SERVICE_ROLE_KEY is set

---

### MAIL_SENT Events Not Showing

**Symptom:** Events tab shows other events but no MAIL_SENT

**Cause:** Emails are not enabled or no emails sent yet

**Fix:**
1. Enable emails:
   ```bash
   EMAIL_NOTIFICATIONS_ENABLED=true
   RESEND_API_KEY=re_your_key
   ```
2. Create offer linked to request (triggers OFFER_CREATED email)
3. Accept offer (triggers OFFER_ACCEPTED email)
4. Check Events tab for purple "MAIL_SENT" badges

**Dev Mode:**
Even with `EMAIL_NOTIFICATIONS_ENABLED=false`, MAIL_SENT events are logged with `success: true`

---

### Refresh Button Not Working

**Symptom:** Click "🔄 Refresh" but data doesn't update

**Cause:** Browser caching or API error

**Fix:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Click refresh button
4. Check if API request was made
5. If 200 OK, check response data
6. If error, check error message
7. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## Production Deployment

### Before Going to Production

- [ ] Remove or restrict `ADMIN_MODE=true` (dev only)
- [ ] Implement proper admin authentication
- [ ] Add middleware to check user role
- [ ] Add RLS policies for admin access
- [ ] Audit log admin console access
- [ ] Consider adding rate limiting
- [ ] Review email masking logic
- [ ] Test with production data (sanitized)

### Environment Variables

**Required:**
```bash
# Admin access control
ADMIN_MODE=false  # Production: Require role-based auth
```

**Optional (for enhanced security):**
```bash
# Admin role verification
ADMIN_ROLE_ENABLED=true
ADMIN_ALLOWED_EMAILS=admin@winefeed.se,ops@winefeed.se
```

### Middleware Example (Future)

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin/* routes
  if (pathname.startsWith('/admin')) {
    const session = await getSession(request);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.redirect('/unauthorized');
    }

    // Set x-user-role header for API
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-role', session.user.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
}
```

---

## Roadmap

### Phase 1 (Current - MVP)
- ✅ Basic admin console with requests/offers/events
- ✅ Email masking
- ✅ MAIL_SENT event tracking
- ✅ Simple ADMIN_MODE flag

### Phase 2 (Future)
- [ ] Real-time updates (WebSocket or polling)
- [ ] Advanced filtering (by status, date range, restaurant)
- [ ] Export to CSV
- [ ] Event timeline visualization
- [ ] Search functionality

### Phase 3 (Future)
- [ ] Role-based access control (admin, ops, support)
- [ ] Audit log of admin actions
- [ ] Alerts for failed emails or stuck offers
- [ ] Dashboard analytics (metrics, charts)
- [ ] Multi-tenant admin view (super-admin)

---

## FAQ

### Q: Can I access this in production?

**A:** Yes, but you need to implement proper authentication. Set `ADMIN_MODE=false` and add middleware to check user role.

### Q: Why are emails masked?

**A:** To prevent accidental exposure of personal data (GDPR compliance) and follow security best practices.

### Q: Can I see full email addresses?

**A:** Not in the UI for security reasons. Use direct DB access if needed (with proper authorization).

### Q: Why is there a limit on items shown?

**A:** To keep the UI performant. Limits are:
- Requests: 20
- Offers: 20
- Events: 50

For full history, query the database directly or implement pagination.

### Q: Can I filter or search?

**A:** Not in MVP. This is planned for Phase 2. Current workaround: Use browser Ctrl+F to search page.

### Q: What if I need older data?

**A:** Current version shows most recent items. For historical data:
1. Query database directly
2. Wait for pagination feature (Phase 2)
3. Export data via SQL query

### Q: How do I know if an email actually arrived?

**A:** The console shows if email was *sent* (via Resend API). To verify *delivery*:
1. Check Resend dashboard
2. Ask recipient to confirm
3. Implement delivery webhooks (future)

---

## Support

**Files:**
- API: `/app/api/admin/pilot/overview/route.ts`
- UI: `/app/admin/pilot/page.tsx`
- Smoke Test: `/scripts/pilot-admin-smoke.sh`

**Related Docs:**
- [Email Notifications](./EMAIL_NOTIFICATIONS.md)
- [Offer Service](../lib/offer-service.ts)
- [Pilot Loop 1.0 Spec](./PILOT_LOOP.md) (if exists)

**Questions:** Contact dev team or open GitHub issue.
