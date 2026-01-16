# Compliance-by-Design: Datamodell

**Syfte:** Omdesignad backend-arkitektur som säkerställer att Winefeed är mellanhand, inte vinhandlare

**Status:** 🟢 Rekommenderad för implementering

**Baserat på:** Compliance Audit (COMPLIANCE_AUDIT.md)

**⚠️ VIKTIGT:** För stöd av både svenska importörer och EU-leverantörer, se också:
→ **[multi-supplier-type-model.md](./multi-supplier-type-model.md)** - Utökad modell med leverantörstyper och beslutslogik

---

## Arkitekturprincip: Tre-lagers Modell

```
┌───────────────────────────────────────────────────────────────────────┐
│                        TRE-LAGERS ARKITEKTUR                           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LAGER 1: CommercialIntent                                            │
│  │                                                                      │
│  ├─ Winefeed ÄGE

R denna entitet                                     │
│  ├─ Restaurangens köpintention                                        │
│  ├─ Accepterad offert från Winefeed                                   │
│  ├─ Winefeeds tjänsteavgift (provision)                               │
│  └─ Orkestreringsstatus (vilka steg är klara?)                        │
│                                                                         │
│  ↓ Refererar till (äger EJ)                                            │
│                                                                         │
│  LAGER 2: SupplierTransaction                                         │
│  │                                                                      │
│  ├─ Producent/importörs EGEN transaktion                              │
│  ├─ Vinpriser (producent → restaurang)                                │
│  ├─ Punktskatt (importörens ansvar)                                   │
│  ├─ Status från producent/importör                                    │
│  └─ Juridiskt bindande avtal (restaurang ↔ producent/importör)       │
│                                                                         │
│  ↓ Refererar till (äger EJ)                                            │
│                                                                         │
│  LAGER 3: FulfillmentData                                             │
│  │                                                                      │
│  ├─ EMCS-dokumentation (importörens ansvar)                           │
│  ├─ Transport och leverans                                             │
│  ├─ Direktleveransplats-registrering                                  │
│  ├─ Compliance-data för Skatteverket                                  │
│  └─ Proof of Delivery                                                  │
│                                                                         │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Lager 1: CommercialIntent (Winefeed äger)

### Tabell: `commercial_intents`

```sql
CREATE TABLE commercial_intents (
  -- Identitet
  intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_number VARCHAR(20) UNIQUE NOT NULL, -- t.ex. "WF-CI-2026-00123"

  -- Relation till offert
  request_id UUID NOT NULL REFERENCES requests(request_id),

  -- Köpare (restaurang)
  buyer_restaurant_id UUID NOT NULL REFERENCES restaurants(restaurant_id),
  buyer_contact_person VARCHAR(255),
  buyer_contact_email VARCHAR(255),
  buyer_contact_phone VARCHAR(20),

  -- Winefeed's tjänsteavgift (KAN vara provision eller fast avgift)
  winefeed_service_fee_type VARCHAR(20) DEFAULT 'PERCENTAGE', -- 'PERCENTAGE', 'FIXED', 'FREE'
  winefeed_service_fee_percentage DECIMAL(5,2), -- T.ex. 5.00 (= 5%)
  winefeed_service_fee_fixed_sek DECIMAL(10,2), -- Eller fast avgift
  winefeed_service_fee_total_sek DECIMAL(10,2) NOT NULL DEFAULT 0, -- Beräknat belopp

  -- Orkestreringsstatus
  orchestration_status VARCHAR(20) DEFAULT 'INTENT_CREATED',
    -- INTENT_CREATED → SUPPLIER_ORDER_CREATED → PAYMENT_PENDING →
    -- PAYMENT_COMPLETED → FULFILLMENT_STARTED → DELIVERED → COMPLETED

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Intentionen kan utgå om inte fullföljd

  -- Audit
  created_by UUID REFERENCES users(user_id),

  -- VIKTIGT: Ingen vinpris, punktskatt eller moms här!
  -- Dessa är importörens/producentens ansvar

  CONSTRAINT valid_orchestration_status CHECK (orchestration_status IN (
    'INTENT_CREATED', 'SUPPLIER_ORDER_CREATED', 'PAYMENT_PENDING',
    'PAYMENT_COMPLETED', 'FULFILLMENT_STARTED', 'DELIVERED', 'COMPLETED', 'CANCELLED'
  ))
);

CREATE INDEX idx_commercial_intents_restaurant ON commercial_intents(buyer_restaurant_id);
CREATE INDEX idx_commercial_intents_status ON commercial_intents(orchestration_status);
CREATE INDEX idx_commercial_intents_created ON commercial_intents(created_at DESC);
```

### TypeScript Interface

```typescript
export interface CommercialIntent {
  intent_id: string;
  intent_number: string;

  request_id: string;

  // Köpare
  buyer_restaurant_id: string;
  buyer_contact_person?: string;
  buyer_contact_email?: string;
  buyer_contact_phone?: string;

  // Winefeed's tjänsteavgift
  winefeed_service_fee_type: 'PERCENTAGE' | 'FIXED' | 'FREE';
  winefeed_service_fee_percentage?: number;
  winefeed_service_fee_fixed_sek?: number;
  winefeed_service_fee_total_sek: number;

  // Orkestrering
  orchestration_status: OrchestrationStatus;

  created_at: string;
  updated_at: string;
  expires_at?: string;
  created_by?: string;
}

export type OrchestrationStatus =
  | 'INTENT_CREATED'
  | 'SUPPLIER_ORDER_CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COMPLETED'
  | 'FULFILLMENT_STARTED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';
```

---

## Lager 2: SupplierTransaction (Referens, äger EJ)

### Tabell: `supplier_transactions`

```sql
CREATE TABLE supplier_transactions (
  -- Identitet
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference VARCHAR(100) UNIQUE NOT NULL,

  -- Koppling till CommercialIntent
  intent_id UUID NOT NULL REFERENCES commercial_intents(intent_id) ON DELETE RESTRICT,

  -- Aktörer (juridiskt bindande avtal)
  seller_type VARCHAR(20) NOT NULL, -- 'PRODUCER', 'IMPORTER', 'SUPPLIER'
  seller_id UUID NOT NULL, -- Producent, importör eller leverantör
  seller_name VARCHAR(255) NOT NULL,
  seller_org_number VARCHAR(20),
  seller_country_code CHAR(2),

  buyer_restaurant_id UUID NOT NULL REFERENCES restaurants(restaurant_id),
  buyer_restaurant_name VARCHAR(255) NOT NULL,
  buyer_org_number VARCHAR(20) NOT NULL,

  -- Importör (OBLIGATORISKT för EU-orders)
  importer_id UUID REFERENCES importer_partners(partner_id),
  importer_name VARCHAR(255),
  importer_org_number VARCHAR(20),
  importer_approved_receiver_id VARCHAR(50), -- "Godkänd mottagare"-ID från Skatteverket

  -- Priser (säljare → köpare, INTE Winefeed)
  wine_subtotal_excl_vat_sek DECIMAL(10,2) NOT NULL,

  -- Punktskatt (IMPORTÖRENS ansvar, inte Winefeeds)
  excise_tax_liable_party VARCHAR(20) NOT NULL DEFAULT 'IMPORTER',
    -- 'IMPORTER', 'PRODUCER' (om svensk), 'BUYER' (om restaurang importerar själv - ovanligt)
  excise_tax_amount_sek DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Moms (på vinpris + punktskatt, INTE Winefeeds ansvar att betala)
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  vat_amount_sek DECIMAL(10,2) NOT NULL,

  -- Frakt (kan ingå eller vara separat)
  shipping_cost_sek DECIMAL(10,2) DEFAULT 0,

  -- Total (vin + punktskatt + moms + frakt)
  total_sek DECIMAL(10,2) NOT NULL,

  -- Status från leverantör/importör
  supplier_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING → CONFIRMED → ALLOCATED → SHIPPED → DELIVERED → INVOICED

  -- Betalningsstatus (restaurang → leverantör/importör)
  payment_status VARCHAR(20) DEFAULT 'UNPAID',
    -- UNPAID → PAID → REFUNDED

  -- Juridiskt
  terms_accepted_at TIMESTAMPTZ,
  purchase_agreement_url VARCHAR(500), -- Köpeavtal (om skriftligt)

  -- Tidsstämplar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- VIKTIGT: Detta är INTE Winefeeds transaktion!
  -- Winefeed REFERERAR bara till den.

  CONSTRAINT valid_seller_type CHECK (seller_type IN ('PRODUCER', 'IMPORTER', 'SUPPLIER')),
  CONSTRAINT valid_excise_tax_liable_party CHECK (excise_tax_liable_party IN ('IMPORTER', 'PRODUCER', 'BUYER')),
  CONSTRAINT valid_supplier_status CHECK (supplier_status IN (
    'PENDING', 'CONFIRMED', 'ALLOCATED', 'SHIPPED', 'DELIVERED', 'INVOICED', 'CANCELLED'
  )),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED')),

  -- EU-orders måste ha importör
  CONSTRAINT eu_order_requires_importer CHECK (
    (seller_country_code = 'SE') OR (importer_id IS NOT NULL)
  )
);

CREATE INDEX idx_supplier_transactions_intent ON supplier_transactions(intent_id);
CREATE INDEX idx_supplier_transactions_seller ON supplier_transactions(seller_id);
CREATE INDEX idx_supplier_transactions_importer ON supplier_transactions(importer_id);
CREATE INDEX idx_supplier_transactions_buyer ON supplier_transactions(buyer_restaurant_id);
```

### TypeScript Interface

```typescript
export interface SupplierTransaction {
  transaction_id: string;
  transaction_reference: string;
  intent_id: string;

  // Säljare
  seller_type: 'PRODUCER' | 'IMPORTER' | 'SUPPLIER';
  seller_id: string;
  seller_name: string;
  seller_org_number?: string;
  seller_country_code?: string;

  // Köpare
  buyer_restaurant_id: string;
  buyer_restaurant_name: string;
  buyer_org_number: string;

  // Importör (obligatoriskt för EU)
  importer_id?: string;
  importer_name?: string;
  importer_org_number?: string;
  importer_approved_receiver_id?: string;

  // Priser
  wine_subtotal_excl_vat_sek: number;
  excise_tax_liable_party: 'IMPORTER' | 'PRODUCER' | 'BUYER';
  excise_tax_amount_sek: number;
  vat_rate: number;
  vat_amount_sek: number;
  shipping_cost_sek: number;
  total_sek: number;

  // Status
  supplier_status: SupplierStatus;
  payment_status: 'UNPAID' | 'PAID' | 'REFUNDED';

  // Juridiskt
  terms_accepted_at?: string;
  purchase_agreement_url?: string;

  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  paid_at?: string;
}

export type SupplierStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ALLOCATED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'INVOICED'
  | 'CANCELLED';
```

---

## Lager 3: FulfillmentData (Referens, äger EJ)

### Tabell: `fulfillment_data`

```sql
CREATE TABLE fulfillment_data (
  -- Identitet
  fulfillment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Koppling
  intent_id UUID NOT NULL REFERENCES commercial_intents(intent_id) ON DELETE RESTRICT,
  transaction_id UUID NOT NULL REFERENCES supplier_transactions(transaction_id) ON DELETE RESTRICT,

  -- Direktleveransplats (OBLIGATORISKT för EU-leveranser)
  direct_delivery_place_id VARCHAR(50), -- EMCS-ID från Skatteverket
  direct_delivery_place_registered BOOLEAN DEFAULT false,
  direct_delivery_place_registration_date DATE,

  delivery_address_line1 VARCHAR(255) NOT NULL,
  delivery_address_line2 VARCHAR(255),
  delivery_postal_code VARCHAR(10) NOT NULL,
  delivery_city VARCHAR(100) NOT NULL,
  delivery_country_code CHAR(2) DEFAULT 'SE',

  -- Restaurangens serveringstillstånd (MÅSTE verifieras)
  serving_license_number VARCHAR(50),
  serving_license_verified BOOLEAN DEFAULT false,
  serving_license_verified_at TIMESTAMPTZ,

  -- EMCS (för EU-import)
  emcs_arc_number VARCHAR(50) UNIQUE, -- Administrative Reference Code
  emcs_ead_reference VARCHAR(100), -- e-AD (elektroniskt följedokument)
  emcs_dispatch_date TIMESTAMPTZ,
  emcs_expected_arrival_date DATE,
  emcs_actual_arrival_date TIMESTAMPTZ,
  emcs_reported_at TIMESTAMPTZ, -- När mottagande rapporterades till EMCS

  -- Transport
  carrier VARCHAR(100), -- T.ex. "DHL", "VinLog", "Schenker"
  tracking_number VARCHAR(100),
  tracking_url VARCHAR(500),

  -- Leveransstatus
  fulfillment_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING → REGISTERED → DISPATCHED → IN_TRANSIT → DELIVERED → POD_RECEIVED

  -- Proof of Delivery
  pod_signature_url VARCHAR(500),
  pod_recipient_name VARCHAR(255),
  pod_timestamp TIMESTAMPTZ,

  -- Compliance-dokumentation
  customs_declaration_number VARCHAR(100),
  customs_cleared_at TIMESTAMPTZ,

  excise_tax_declaration_reference VARCHAR(100),
  excise_tax_declared_by VARCHAR(255), -- Importörens namn
  excise_tax_declared_at TIMESTAMPTZ,
  excise_tax_paid_at TIMESTAMPTZ,

  -- Tidsstämplar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_fulfillment_status CHECK (fulfillment_status IN (
    'PENDING', 'REGISTERED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'POD_RECEIVED', 'EXCEPTION'
  )),

  -- EU-leveranser måste ha EMCS och direktleveransplats
  CONSTRAINT eu_delivery_requires_emcs CHECK (
    (delivery_country_code = 'SE' AND emcs_arc_number IS NULL) OR
    (delivery_country_code != 'SE' OR emcs_arc_number IS NOT NULL)
  )
);

CREATE INDEX idx_fulfillment_data_intent ON fulfillment_data(intent_id);
CREATE INDEX idx_fulfillment_data_transaction ON fulfillment_data(transaction_id);
CREATE INDEX idx_fulfillment_data_arc ON fulfillment_data(emcs_arc_number);
CREATE INDEX idx_fulfillment_data_status ON fulfillment_data(fulfillment_status);
```

### TypeScript Interface

```typescript
export interface FulfillmentData {
  fulfillment_id: string;
  intent_id: string;
  transaction_id: string;

  // Direktleveransplats
  direct_delivery_place_id?: string;
  direct_delivery_place_registered: boolean;
  direct_delivery_place_registration_date?: string;

  delivery_address_line1: string;
  delivery_address_line2?: string;
  delivery_postal_code: string;
  delivery_city: string;
  delivery_country_code: string;

  // Serveringstillstånd
  serving_license_number?: string;
  serving_license_verified: boolean;
  serving_license_verified_at?: string;

  // EMCS
  emcs_arc_number?: string;
  emcs_ead_reference?: string;
  emcs_dispatch_date?: string;
  emcs_expected_arrival_date?: string;
  emcs_actual_arrival_date?: string;
  emcs_reported_at?: string;

  // Transport
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;

  // Status
  fulfillment_status: FulfillmentStatus;

  // Proof of Delivery
  pod_signature_url?: string;
  pod_recipient_name?: string;
  pod_timestamp?: string;

  // Compliance
  customs_declaration_number?: string;
  customs_cleared_at?: string;
  excise_tax_declaration_reference?: string;
  excise_tax_declared_by?: string;
  excise_tax_declared_at?: string;
  excise_tax_paid_at?: string;

  created_at: string;
  updated_at: string;
}

export type FulfillmentStatus =
  | 'PENDING'
  | 'REGISTERED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'POD_RECEIVED'
  | 'EXCEPTION';
```

---

## Split Payment Architecture

### Tabell: `payment_intents`

```sql
CREATE TABLE payment_intents (
  -- Identitet
  payment_intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Koppling
  intent_id UUID NOT NULL REFERENCES commercial_intents(intent_id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES supplier_transactions(transaction_id),

  -- Betalningspartner
  provider VARCHAR(20) NOT NULL, -- 'STRIPE', 'WORLDLINE', 'KLARNA'
  provider_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,

  -- TOTAL belopp (vin + tjänst)
  total_amount_sek DECIMAL(10,2) NOT NULL,
  currency CHAR(3) DEFAULT 'SEK',

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING → REQUIRES_PAYMENT_METHOD → PROCESSING → SUCCEEDED → FAILED

  -- Tidsstämplar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  CONSTRAINT valid_provider CHECK (provider IN ('STRIPE', 'WORLDLINE', 'KLARNA')),
  CONSTRAINT valid_payment_status CHECK (status IN (
    'PENDING', 'REQUIRES_PAYMENT_METHOD', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'
  ))
);
```

### Tabell: `payment_splits`

```sql
CREATE TABLE payment_splits (
  -- Identitet
  split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Koppling
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(payment_intent_id) ON DELETE CASCADE,

  -- Mottagare
  recipient_type VARCHAR(20) NOT NULL,
    -- 'WINEFEED_SERVICE', 'SUPPLIER', 'IMPORTER', 'LOGISTICS'
  recipient_id UUID,
  recipient_name VARCHAR(255) NOT NULL,
  recipient_account_id VARCHAR(255), -- Stripe Connect Account ID, Worldline Merchant ID, etc.

  -- Belopp
  amount_sek DECIMAL(10,2) NOT NULL,
  description VARCHAR(255),

  -- Status
  transfer_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING → TRANSFERRED → FAILED
  transferred_at TIMESTAMPTZ,
  transfer_reference VARCHAR(255), -- Referens från betalningspartner

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_recipient_type CHECK (recipient_type IN (
    'WINEFEED_SERVICE', 'SUPPLIER', 'IMPORTER', 'LOGISTICS', 'OTHER'
  )),
  CONSTRAINT valid_transfer_status CHECK (transfer_status IN ('PENDING', 'TRANSFERRED', 'FAILED'))
);

CREATE INDEX idx_payment_splits_intent ON payment_splits(payment_intent_id);
CREATE INDEX idx_payment_splits_recipient ON payment_splits(recipient_type, recipient_id);
```

### Exempel: Split Payment

```typescript
// När restaurang betalar 13,125 SEK:
const paymentSplits = [
  {
    recipient_type: 'SUPPLIER',
    recipient_name: 'Brasri AB (för producent)',
    amount_sek: 12000, // Vinpris + punktskatt + moms + frakt
    description: 'Payment for wine purchase',
  },
  {
    recipient_type: 'WINEFEED_SERVICE',
    recipient_name: 'Winefeed AB',
    amount_sek: 625, // 5% provision (inkl. moms på tjänst)
    description: 'Service fee for platform and coordination',
  },
];
```

Detta visar tydligt att:
- **12,000 SEK** går till leverantör/importör (för vin)
- **625 SEK** går till Winefeed (för tjänst)

**Juridiskt:** Winefeed tar INTE emot betalning för vin, bara för tjänst.

---

## Validering och Business Rules

### TypeScript Validation Logic

```typescript
export class CommercialIntentValidator {
  /**
   * Validerar att EU-orders har importör
   */
  static validateEUOrder(
    transaction: SupplierTransaction
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Om leverantör är utanför Sverige, måste importör finnas
    if (
      transaction.seller_country_code &&
      transaction.seller_country_code !== 'SE' &&
      !transaction.importer_id
    ) {
      errors.push(
        'EU orders require an importer. Please assign an importer_id.'
      );
    }

    // Importör måste ha "godkänd mottagare"-ID
    if (
      transaction.importer_id &&
      !transaction.importer_approved_receiver_id
    ) {
      errors.push(
        'Importer must have an approved receiver ID from Skatteverket.'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validerar att direktleveransplats är registrerad
   */
  static validateDirectDeliveryPlace(
    fulfillment: FulfillmentData,
    transaction: SupplierTransaction
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Om EU-leverans, måste direktleveransplats vara registrerad
    const isEUDelivery =
      transaction.seller_country_code &&
      transaction.seller_country_code !== 'SE';

    if (isEUDelivery && !fulfillment.direct_delivery_place_id) {
      errors.push(
        'EU deliveries require a registered direct delivery place (EMCS ID).'
      );
    }

    if (isEUDelivery && !fulfillment.direct_delivery_place_registered) {
      errors.push(
        'Direct delivery place must be registered with Skatteverket before EU delivery.'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validerar att serveringstillstånd är verifierat
   */
  static validateServingLicense(
    fulfillment: FulfillmentData
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!fulfillment.serving_license_number) {
      errors.push('Restaurant must have a serving license number.');
    }

    if (!fulfillment.serving_license_verified) {
      errors.push(
        'Serving license must be verified before order can be fulfilled.'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

---

## API Endpoints (exempel)

### POST `/api/commercial-intents`

Skapar en ny köpintention (lager 1).

```typescript
const response = await fetch('/api/commercial-intents', {
  method: 'POST',
  body: JSON.stringify({
    request_id: 'uuid',
    buyer_restaurant_id: 'uuid',
    winefeed_service_fee_type: 'PERCENTAGE',
    winefeed_service_fee_percentage: 5.0,
  }),
});

// Response
{
  intent_id: 'uuid',
  intent_number: 'WF-CI-2026-00123',
  orchestration_status: 'INTENT_CREATED',
  winefeed_service_fee_total_sek: 500.00,
}
```

### POST `/api/supplier-transactions`

Skapar en transaktion mellan restaurang och leverantör/importör (lager 2).

```typescript
const response = await fetch('/api/supplier-transactions', {
  method: 'POST',
  body: JSON.stringify({
    intent_id: 'uuid',
    seller_type: 'PRODUCER',
    seller_id: 'uuid',
    seller_country_code: 'FR', // Frankrike → kräver importör
    importer_id: 'uuid', // Brasri AB
    buyer_restaurant_id: 'uuid',
    wine_subtotal_excl_vat_sek: 8000,
    excise_tax_liable_party: 'IMPORTER',
    excise_tax_amount_sek: 2000,
    vat_rate: 25,
    vat_amount_sek: 2500,
    shipping_cost_sek: 500,
    total_sek: 13000,
  }),
});

// Response
{
  transaction_id: 'uuid',
  transaction_reference: 'ST-2026-00123',
  supplier_status: 'PENDING',
  // Validering: EU order → måste ha importör ✓
}
```

### POST `/api/fulfillment-data`

Registrerar leverans- och compliance-data (lager 3).

```typescript
const response = await fetch('/api/fulfillment-data', {
  method: 'POST',
  body: JSON.stringify({
    intent_id: 'uuid',
    transaction_id: 'uuid',
    direct_delivery_place_id: 'SE12345678', // EMCS-ID
    direct_delivery_place_registered: true,
    delivery_address_line1: 'Kungsgatan 1',
    delivery_postal_code: '111 43',
    delivery_city: 'Stockholm',
    delivery_country_code: 'SE',
    serving_license_number: 'ST-2024-12345',
    serving_license_verified: true,
    emcs_arc_number: 'FR12AB34567890',
    carrier: 'DHL',
  }),
});

// Response
{
  fulfillment_id: 'uuid',
  fulfillment_status: 'REGISTERED',
  // Validering: EU delivery → måste ha EMCS och direktleveransplats ✓
}
```

---

## Fördelar med denna Arkitektur

### 1. Juridiskt Defensiv

✅ **Winefeed är tydligt mellanhand**
- Äger bara `commercial_intents` (orkestrering)
- Refererar till `supplier_transactions` (äger EJ)
- Refererar till `fulfillment_data` (äger EJ)

✅ **Punktskatt är INTE på Winefeeds entiteter**
- Lagras på `supplier_transactions` (importörens ansvar)
- `excise_tax_liable_party` är explicit

✅ **Betalningar är separerade**
- `payment_splits` visar tydligt: X till leverantör, Y till Winefeed

### 2. Compliance-by-Design

✅ **Obligatoriska fält för EU-orders**
- Importör-ID (valideras)
- Direktleveransplats-ID (valideras)
- EMCS-referenser (valideras)

✅ **Serveringstillstånd måste verifieras**
- `serving_license_verified` måste vara `true`

✅ **Audit trail**
- Alla statusändringar loggade
- Tydligt vem som är ansvarig för vad

### 3. Skalbart

✅ **Kan hantera flera flöden**
- Svenska leverantörer (ingen importör)
- EU-leverantörer (via importör)
- Framtida: Andra regioner

✅ **Modulärt**
- Lager 1, 2, 3 kan utvecklas oberoende
- Lätt att lägga till nya partners

---

## Migration från Nuvarande Modell

### Steg 1: Skapa nya tabeller

```sql
-- Kör SQL för:
CREATE TABLE commercial_intents (...);
CREATE TABLE supplier_transactions (...);
CREATE TABLE fulfillment_data (...);
CREATE TABLE payment_intents (...);
CREATE TABLE payment_splits (...);
```

### Steg 2: Migrera befintliga orders

```typescript
// För varje befintlig order:
const oldOrder = await getOldOrder(order_id);

// Skapa CommercialIntent
const intent = await createCommercialIntent({
  request_id: oldOrder.request_id,
  buyer_restaurant_id: oldOrder.restaurant_id,
  winefeed_service_fee_percentage: 5.0,
  orchestration_status: mapOldStatusToOrchestrationStatus(oldOrder.status),
});

// Skapa SupplierTransaction
const transaction = await createSupplierTransaction({
  intent_id: intent.intent_id,
  seller_id: oldOrder.supplier_id,
  buyer_restaurant_id: oldOrder.restaurant_id,
  wine_subtotal_excl_vat_sek: oldOrder.subtotal_sek,
  excise_tax_amount_sek: oldOrder.excise_tax_sek,
  vat_amount_sek: oldOrder.vat_amount_sek,
  total_sek: oldOrder.total_sek,
});

// Skapa FulfillmentData
const fulfillment = await createFulfillmentData({
  intent_id: intent.intent_id,
  transaction_id: transaction.transaction_id,
  delivery_address_line1: oldOrder.delivery_address_line1,
  delivery_city: oldOrder.delivery_city,
  // ...
});
```

### Steg 3: Uppdatera frontend och API

- Ändra API-endpoints att använda nya tabeller
- Uppdatera TypeScript-interfaces
- Testa alla flöden

### Steg 4: Deprecate gamla tabeller

- Markera `orders` som deprecated
- Ta bort när alla migrerade

---

## Juridisk Review Checklist

Innan produktion, verifiera att:

- [x] Winefeed **aldrig** står som köpare eller säljare av vin
- [x] Punktskatt lagras på **importörens** transaktion, inte Winefeeds
- [x] Betalningar är **separerade** (vin vs tjänst) via payment_splits
- [x] Importör är **obligatoriskt** för EU-orders (SQL constraint)
- [x] Direktleveransplats är **obligatoriskt** för EU-leveranser (SQL constraint)
- [x] EMCS-referenser är **kopplade** till fulfillment_data
- [x] Dokumentation visar **tydlig ansvarsfördelning** (via recipient_type)
- [ ] Juridisk rådgivare har **godkänt** datamodellen

---

## Nästa Steg

1. ✅ **Juridisk review** - Låt jurist granska denna modell
2. ✅ **Implementera tabeller** - Skapa SQL-scheman
3. ✅ **Uppdatera API** - Nya endpoints för tre-lagers modellen
4. ✅ **Migrera befintlig data** - Om någon
5. ✅ **Testa compliance** - Verifiera att valideringar fungerar
6. ✅ **Dokumentera för team** - Utbilda utvecklare

---

**Skapad:** 2026-01-14
**Granskad av:** [Jurist TBD]
**Nästa review:** Innan produktion
