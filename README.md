# Winefeed

**Winefeed** är en B2B-plattform som kopplar samman restauranger med vinleverantörer och hanterar hela flödet från förfrågan till leverans, inklusive EU-importkomplians (IOR).

## Översikt

Winefeed är en Next.js-applikation byggd för att förenkla vinprocurement för restauranger i Sverige. Plattformen hanterar:

- 🍷 **Request-to-Offer Flow** - Restauranger gör förfrågningar, leverantörer svarar med offerter
- 📦 **Order Management** - Från offert-accept till leverans med fullständig tracking
- 🛃 **IOR Compliance** - EU-importhantering med Direct Delivery Locations (DDL) och dokumentgenerering
- 📊 **Pilot Admin Console** - Operativ övervakning med KPI-metrics och alerts
- 📧 **Email Notifications** - Automatiska notifikationer för alla händelser
- 🔍 **Product Matching** - Automatisk matchning mot GS1 master data

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Testing:** Vitest
- **Email:** Resend
- **AI:** Claude (Anthropic) för ranking och motivering
- **External APIs:** Wine-Searcher för prisjämförelse

## Projektstruktur

```
winefeed/
├── app/                      # Next.js app router
│   ├── api/                  # API routes
│   │   ├── admin/           # Admin endpoints (pilot console, invites)
│   │   ├── imports/         # Import case management
│   │   ├── ior/orders/      # IOR order tracking
│   │   ├── offers/          # Offer management
│   │   ├── requests/        # Request handling
│   │   └── suppliers/       # Supplier endpoints
│   ├── admin/pilot/         # Pilot Admin Console UI
│   ├── dashboard/           # Restaurant dashboard
│   ├── imports/             # Import case UI
│   ├── ior/orders/          # IOR order UI
│   └── offers/              # Offer UI
├── lib/                     # Shared libraries
│   ├── compliance/          # DDL & shipment validation
│   ├── matching/            # Product matching logic
│   ├── wine-searcher/       # Wine-Searcher integration
│   ├── email-service.ts     # Email handling (Resend)
│   ├── import-service.ts    # Import case business logic
│   ├── offer-service.ts     # Offer business logic
│   └── order-service.ts     # Order business logic
├── docs/                    # Documentation
│   ├── IOR_COMPLIANCE_FLOW.md
│   ├── PILOT_ADMIN.md
│   ├── RESTAURANT_ORDER_TRACKING.md
│   └── compliance/          # Compliance documentation
├── scripts/                 # Smoke tests & seed scripts
│   ├── mvp-*.sh            # Smoke tests for MVP flows
│   ├── pilot-admin-smoke.sh
│   └── pilot-seed.sh       # Seed test data
└── supabase/
    └── migrations/          # Database migrations (32 migrations)
```

## Kom igång

### Förutsättningar

- Node.js 18+
- npm eller bun
- Supabase-konto (för databas)
- Resend-konto (för email)
- Anthropic API-nyckel (för AI-features)

### Installation

```bash
# Klona repository
git clone https://github.com/winefeed/winefeed.git
cd winefeed

# Installera beroenden
npm install

# Kopiera miljövariabler
cp .env.example .env.local

# Redigera .env.local med dina API-nycklar
```

### Miljövariabler

Skapa en `.env.local` fil med:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@winefeed.se

# AI (Anthropic Claude)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Wine-Searcher (optional)
WINE_SEARCHER_API_KEY=your_wine_searcher_api_key

# Admin Access (dev only)
ADMIN_MODE=true
```

### Kör applikationen

```bash
# Development server
npm run dev

# Open browser
open http://localhost:3000
```

### Kör migrationer

```bash
# Applicera alla Supabase-migrationer
npx supabase db push
```

### Seed testdata

```bash
# Skapa pilot testdata (restauranger, suppliers, requests)
bash scripts/pilot-seed.sh
```

## Huvudflöden

### 1. Request → Offer → Order Flow

```
Restaurant → Create Request
          ↓
Supplier  → Create Offer
          ↓
Restaurant → Accept Offer
          ↓
System    → Create Order
          ↓
IOR       → Process Import Case
          ↓
System    → Auto-confirm Order (when import approved)
          ↓
Supplier  → Ship Order
```

### 2. IOR Compliance Flow (EU Import)

```
Order Created (EU supplier)
          ↓
Create Import Case
          ↓
Register Direct Delivery Location (DDL)
          ↓
Submit DDL → Status: SUBMITTED
          ↓
IOR Approve DDL → Status: APPROVED
          ↓
Generate SKV 5369 Document
          ↓
Submit Import → Status: SUBMITTED
          ↓
IOR Approve Import → Status: APPROVED
          ↓
Auto-confirm Order (ORDER_STATUS_UPDATED email)
          ↓
Validate Shipment (ship-ready gate)
          ↓
Ship Order
```

## Pilot Admin Console

Övervakningsverktyg för pilotfasen:

**URL:** http://localhost:3000/admin/pilot

**Features:**
- 📊 **Pilot KPI** - Conversion funnel + timing metrics (30 dagar)
- ⚠️ **Operational Alerts** - EU orders utan import case, stuck orders, email failures
- 📋 **Recent Activity** - Requests, offers, events
- 🔍 **Email Debugging** - Verifiera MAIL_SENT events med action hints

**Access:** Sätt `ADMIN_MODE=true` i `.env.local`

## Testing

### Smoke Tests

Kör alla MVP smoke tests:

```bash
# Request → Offer → Accept flow
bash scripts/mvp-request-offer-accept-smoke.sh

# EU Order + IOR flow
bash scripts/mvp-eu-order-ior-smoke.sh

# Restaurant order tracking
bash scripts/mvp-restaurant-order-tracking-smoke.sh

# Pilot Admin Console
bash scripts/pilot-admin-smoke.sh

# Offer loop (full cycle)
bash scripts/mvp-offer-loop-smoke.sh
```

### Acceptance Tests

Kör DDL acceptance suite:

```bash
bash scripts/run-acceptance-suite.sh
```

### Unit Tests

```bash
# Kör alla Vitest-tester
npm test

# Watch mode
npm test -- --watch
```

## Dokumentation

Utförlig dokumentation finns i `/docs`:

- **[IOR_COMPLIANCE_FLOW.md](docs/IOR_COMPLIANCE_FLOW.md)** - EU-import compliance med auto-confirmation
- **[PILOT_ADMIN.md](docs/PILOT_ADMIN.md)** - Pilot Admin Console guide med KPI-metrics
- **[RESTAURANT_ORDER_TRACKING.md](docs/RESTAURANT_ORDER_TRACKING.md)** - Order tracking för restauranger
- **[EMAIL_NOTIFICATIONS.md](docs/EMAIL_NOTIFICATIONS.md)** - Email notification system
- **[MATCHING_STRATEGY.md](docs/MATCHING_STRATEGY.md)** - Product matching algoritm
- **[SUPPLIER_ONBOARDING.md](docs/SUPPLIER_ONBOARDING.md)** - Supplier onboarding flow

### Compliance Documentation

- **[compliance/eu-import-direct-delivery.md](docs/compliance/eu-import-direct-delivery.md)** - Direct Delivery Locations
- **[compliance/COMPLIANCE_AUDIT.md](docs/compliance/COMPLIANCE_AUDIT.md)** - Compliance audit trail

## Senaste Features

### ✅ Pilot KPI Metrics (2026-01-16)

Conversion funnel + timing metrics för pilot-övervakning:

**Counts:**
- Requests → Offers → Sent → Accepted → Orders → Imports → Approved → Shipped

**Timings:**
- Request → Offer Created (median + p90)
- Offer Created → Accepted
- Accept → Order Created
- Order Created → Import Approved

**Location:** `/admin/pilot` → "📈 Pilot KPI"

### ✅ Auto-Confirmation (2026-01-16)

Orders bekräftas automatiskt när import case blir APPROVED:

**Flow:**
```
Import Case → APPROVED
     ↓
Find linked orders
     ↓
Update status → CONFIRMED
     ↓
Log STATUS_AUTO_UPDATED event
     ↓
Send ORDER_STATUS_UPDATED email (fail-safe)
```

**Benefits:**
- Minskar manuell handpåläggning
- Snabbare orderprocessning
- Full audit trail

### ✅ Email Failure Action Hints (2026-01-16)

Operativa åtgärdstips för misslyckade emails:

**Features:**
- Klickbara failure-kort
- Template-specifika action hints
- Direkt navigation till entity (order/offer)

**Action Hints:**
- `ORDER_STATUS_UPDATED` → Kolla Resend/leveransstatus, mottagarlista
- `OFFER_CREATED` → Kolla request_id, restaurangmottagare
- `OFFER_ACCEPTED` → Kolla supplier-mottagare, Resend status

## API Endpoints

### Requests
- `POST /api/requests` - Create request
- `GET /api/requests/[id]` - Get request details

### Offers
- `POST /api/offers` - Create offer
- `GET /api/offers/[id]` - Get offer details
- `POST /api/offers/[id]/accept` - Accept offer

### Orders (IOR)
- `GET /api/ior/orders` - List orders
- `GET /api/ior/orders/[id]` - Get order details
- `POST /api/ior/orders/[id]/status` - Update order status
- `POST /api/ior/orders/[id]/create-import` - Create import case

### Import Cases
- `POST /api/imports` - Create import case
- `GET /api/imports/[id]` - Get import details
- `POST /api/imports/[id]/status` - Update import status (triggers auto-confirmation)
- `POST /api/imports/[id]/documents/5369` - Generate SKV 5369 document

### Admin
- `GET /api/admin/pilot/overview` - Pilot admin dashboard data (KPI + alerts)

## Säkerhet

- **Tenant Isolation:** Alla queries filtreras på `tenant_id`
- **RLS Policies:** Row-level security på alla tabeller
- **No Sensitive Data in Logs:** Emails maskeras (m***@example.com)
- **Service Role Key:** Används endast server-side
- **Email Masking:** I UI och logs

## Bidra

1. Forka repository
2. Skapa feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push till branch (`git push origin feature/amazing-feature`)
5. Öppna Pull Request

## Licens

Proprietär - Winefeed AB

## Kontakt

- **Email:** hej@winefeed.se
- **GitHub:** [@winefeed](https://github.com/winefeed)

## Acknowledgments

- **Test Importer AB** - Pilot partner för IOR compliance testing
- **Vaucelle** - Test supplier data
- **Anthropic** - Claude AI för ranking och motivering
- **Supabase** - Database och auth
- **Resend** - Email delivery

---

**Built with ❤️ for Swedish wine professionals**
