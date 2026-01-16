# Datamodeller: Order Flow

**Syfte:** Detaljerad datamodellering för orderhantering från offertacceptans till leverans

---

## Entitetsrelationsdiagram (ERD)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Request    │────────>│    Order     │<────────│  OrderItem   │
│  (Offert)    │ 1:1     │              │ 1:N     │              │
└──────────────┘         └──────────────┘         └──────────────┘
                                 │                        │
                                 │ 1:1                    │
                                 ↓                        │
                         ┌──────────────┐                │
                         │   Payment    │                │
                         │              │                │
                         └──────────────┘                │
                                 │                        │
                                 │ 1:1                    │
                                 ↓                        │
                         ┌──────────────┐                │
                         │   Shipment   │                │
                         │              │                │
                         └──────────────┘                │
                                 │                        │
                                 │ 1:N                    │
                                 ↓                        ↓
                         ┌──────────────┐         ┌──────────────┐
                         │  ShipmentLog │         │     Wine     │
                         │              │         │              │
                         └──────────────┘         └──────────────┘
```

---

## 1. Order

Huvudentitet som representerar en restaurangs köpintention baserad på accepterat offertförslag.

### Tabell: `orders`

```sql
CREATE TABLE orders (
  -- Identitet
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) UNIQUE NOT NULL, -- t.ex. "WF-2026-00123"

  -- Relationer
  request_id UUID NOT NULL REFERENCES requests(request_id),
  restaurant_id UUID NOT NULL REFERENCES restaurants(restaurant_id),
  supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),

  -- Status och tidsstämplar
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING → CONFIRMED → PAID → PREPARING → SHIPPED → DELIVERED → COMPLETED
    -- Eller REJECTED → CANCELLED

  -- Priser och skatter
  subtotal_sek DECIMAL(10,2) NOT NULL, -- Summa exkl. skatter
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 25.00, -- Momssats (%)
  vat_amount_sek DECIMAL(10,2) NOT NULL, -- Momsbelopp
  excise_tax_sek DECIMAL(10,2) DEFAULT 0, -- Punktskatt (alkoholskatt)
  shipping_cost_sek DECIMAL(10,2) DEFAULT 0, -- Fraktkostnad
  total_sek DECIMAL(10,2) NOT NULL, -- Total inkl. allt

  -- Leveransinfo
  delivery_address_line1 VARCHAR(255) NOT NULL,
  delivery_address_line2 VARCHAR(255),
  delivery_postal_code VARCHAR(10) NOT NULL,
  delivery_city VARCHAR(100) NOT NULL,
  delivery_country_code CHAR(2) DEFAULT 'SE',

  -- Kontaktinfo
  contact_person VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),

  -- Tidsestimat
  estimated_delivery_date DATE,
  confirmed_delivery_date DATE,
  actual_delivery_date DATE,

  -- Metadata
  notes TEXT, -- Fria anteckningar från restaurang
  internal_notes TEXT, -- Interna anteckningar (ej synliga för restaurang)

  -- Tidsstämplar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES users(user_id),
  updated_by UUID REFERENCES users(user_id),

  -- Index
  CONSTRAINT valid_status CHECK (status IN (
    'PENDING', 'CONFIRMED', 'PAID', 'PREPARING',
    'SHIPPED', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED'
  ))
);

-- Indexes
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_supplier ON orders(supplier_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

### TypeScript Interface

```typescript
export interface Order {
  // Identitet
  order_id: string;
  order_number: string;

  // Relationer
  request_id: string;
  restaurant_id: string;
  supplier_id: string;

  // Status
  status: OrderStatus;

  // Priser och skatter
  subtotal_sek: number;
  vat_rate: number;
  vat_amount_sek: number;
  excise_tax_sek: number;
  shipping_cost_sek: number;
  total_sek: number;

  // Leveransinfo
  delivery_address_line1: string;
  delivery_address_line2?: string;
  delivery_postal_code: string;
  delivery_city: string;
  delivery_country_code: string;

  // Kontaktinfo
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;

  // Tidsestimat
  estimated_delivery_date?: string;
  confirmed_delivery_date?: string;
  actual_delivery_date?: string;

  // Metadata
  notes?: string;
  internal_notes?: string;

  // Tidsstämplar
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PAID'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';
```

---

## 2. OrderItem

Representerar varje enskild vin i en order.

### Tabell: `order_items`

```sql
CREATE TABLE order_items (
  -- Identitet
  order_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationer
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  wine_id UUID NOT NULL REFERENCES wines(wine_id),

  -- Produktinfo (snapshot vid ordertid)
  wine_name VARCHAR(255) NOT NULL,
  producer VARCHAR(255) NOT NULL,
  vintage INT,
  country VARCHAR(100),
  region VARCHAR(100),

  -- Pris och kvantitet
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_sek DECIMAL(10,2) NOT NULL,
  line_total_sek DECIMAL(10,2) NOT NULL, -- quantity × unit_price_sek

  -- Alkoholdata (för skatteberäkning)
  alcohol_percentage DECIMAL(4,2),
  bottle_size_ml INT DEFAULT 750,

  -- Status per rad
  status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING → CONFIRMED → ALLOCATED → SHIPPED → DELIVERED
    -- Eller CANCELLED → REFUNDED

  -- Tidsstämplar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_item_status CHECK (status IN (
    'PENDING', 'CONFIRMED', 'ALLOCATED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'
  ))
);

-- Indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_wine ON order_items(wine_id);
```

### TypeScript Interface

```typescript
export interface OrderItem {
  order_item_id: string;
  order_id: string;
  wine_id: string;

  // Produktinfo (snapshot)
  wine_name: string;
  producer: string;
  vintage?: number;
  country?: string;
  region?: string;

  // Pris och kvantitet
  quantity: number;
  unit_price_sek: number;
  line_total_sek: number;

  // Alkoholdata
  alcohol_percentage?: number;
  bottle_size_ml: number;

  // Status
  status: OrderItemStatus;

  // Tidsstämplar
  created_at: string;
  updated_at: string;
}

export type OrderItemStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ALLOCATED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';
```

---

## 3. OrderStatusLog

Spårar alla statusändringar för en order (audit trail).

### Tabell: `order_status_log`

```sql
CREATE TABLE order_status_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  -- Status
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,

  -- Metadata
  changed_by UUID REFERENCES users(user_id),
  change_reason TEXT,

  -- Tidsstämpel
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_order_status_log_order ON order_status_log(order_id);
CREATE INDEX idx_order_status_log_changed_at ON order_status_log(changed_at DESC);
```

### TypeScript Interface

```typescript
export interface OrderStatusLog {
  log_id: string;
  order_id: string;
  previous_status?: OrderStatus;
  new_status: OrderStatus;
  changed_by?: string;
  change_reason?: string;
  changed_at: string;
}
```

---

## 4. SupplierOrderConfirmation

Representerar leverantörens svar på en orderförfrågan.

### Tabell: `supplier_order_confirmations`

```sql
CREATE TABLE supplier_order_confirmations (
  confirmation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  -- Leverantörens svar
  confirmed BOOLEAN NOT NULL,
  confirmation_method VARCHAR(20) DEFAULT 'API', -- API, EMAIL, MANUAL

  -- Priser och tillgänglighet
  confirmed_price_sek DECIMAL(10,2), -- Kan avvika från förfrågan
  confirmed_quantity INT,
  available_quantity INT, -- Om mindre än begärt

  -- Tidslinje
  estimated_preparation_days INT,
  estimated_delivery_date DATE,

  -- Meddelande från leverantör
  supplier_message TEXT,

  -- Metadata
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_by UUID REFERENCES users(user_id),

  -- External reference
  supplier_order_reference VARCHAR(100) -- Leverantörens egna ordernummer
);

-- Index
CREATE INDEX idx_supplier_confirmations_order ON supplier_order_confirmations(order_id);
```

### TypeScript Interface

```typescript
export interface SupplierOrderConfirmation {
  confirmation_id: string;
  order_id: string;

  // Svar
  confirmed: boolean;
  confirmation_method: 'API' | 'EMAIL' | 'MANUAL';

  // Priser och tillgänglighet
  confirmed_price_sek?: number;
  confirmed_quantity?: number;
  available_quantity?: number;

  // Tidslinje
  estimated_preparation_days?: number;
  estimated_delivery_date?: string;

  // Meddelande
  supplier_message?: string;

  // Metadata
  confirmed_at: string;
  confirmed_by?: string;
  supplier_order_reference?: string;
}
```

---

## 5. OrderCalculation

Detaljerad breakdown av skatteberäkningar för en order.

### Tabell: `order_calculations`

```sql
CREATE TABLE order_calculations (
  calculation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  -- Grundbelopp
  subtotal_excl_vat_sek DECIMAL(10,2) NOT NULL,

  -- Moms
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  vat_amount_sek DECIMAL(10,2) NOT NULL,

  -- Punktskatt (alkoholskatt)
  excise_tax_per_liter_sek DECIMAL(10,2), -- Skattesats per liter ren alkohol
  total_alcohol_liters DECIMAL(10,4), -- Totalt antal liter ren alkohol i ordern
  excise_tax_total_sek DECIMAL(10,2),

  -- Fraktkostnad
  shipping_cost_excl_vat_sek DECIMAL(10,2),
  shipping_vat_amount_sek DECIMAL(10,2),
  shipping_cost_incl_vat_sek DECIMAL(10,2),

  -- Totalsumma
  total_sek DECIMAL(10,2) NOT NULL,

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculation_method VARCHAR(50) DEFAULT 'AUTO', -- AUTO, MANUAL
  notes TEXT
);

-- Index
CREATE INDEX idx_order_calculations_order ON order_calculations(order_id);
```

### TypeScript Interface

```typescript
export interface OrderCalculation {
  calculation_id: string;
  order_id: string;

  // Grundbelopp
  subtotal_excl_vat_sek: number;

  // Moms
  vat_rate: number;
  vat_amount_sek: number;

  // Punktskatt
  excise_tax_per_liter_sek?: number;
  total_alcohol_liters?: number;
  excise_tax_total_sek?: number;

  // Frakt
  shipping_cost_excl_vat_sek?: number;
  shipping_vat_amount_sek?: number;
  shipping_cost_incl_vat_sek?: number;

  // Total
  total_sek: number;

  // Metadata
  calculated_at: string;
  calculation_method: 'AUTO' | 'MANUAL';
  notes?: string;
}
```

---

## Affärslogik: Order Status Flow

```
PENDING
  ↓ (leverantör bekräftar)
CONFIRMED
  ↓ (betalning genomförd)
PAID
  ↓ (leverantör förbereder)
PREPARING
  ↓ (order skickas)
SHIPPED
  ↓ (leverans mottas)
DELIVERED
  ↓ (order arkiveras)
COMPLETED

Alternative paths:
PENDING → REJECTED (leverantör nekar)
ANY → CANCELLED (restaurang eller Winefeed avbryter)
```

### Status Transition Rules

```typescript
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: []
};

export function canTransitionTo(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}
```

---

## API Endpoints (exempel)

### POST `/api/orders`
Skapar en ny order från accepterad offert.

**Request:**
```json
{
  "request_id": "uuid",
  "selected_wine_ids": ["uuid1", "uuid2"],
  "delivery_address": {
    "line1": "Kungsgatan 1",
    "postal_code": "111 43",
    "city": "Stockholm",
    "country_code": "SE"
  },
  "contact": {
    "person": "Anna Svensson",
    "phone": "+46701234567",
    "email": "anna@restaurant.se"
  },
  "notes": "Leverera till bakre entrén"
}
```

**Response:**
```json
{
  "order_id": "uuid",
  "order_number": "WF-2026-00123",
  "status": "PENDING",
  "total_sek": 15750.00,
  "estimated_delivery_date": "2026-02-01"
}
```

### GET `/api/orders/:order_id`
Hämtar orderdetaljer.

### PATCH `/api/orders/:order_id/status`
Uppdaterar orderstatus (används internt och av leverantör-webhooks).

### GET `/api/orders/:order_id/timeline`
Hämtar full statushistorik.

---

## Nästa steg

Se relaterade dokument:
- `payment-flow.md` - Betalningshantering
- `logistics-flow.md` - Frakt och leverans
- `tax-calculations.md` - Detaljerad skattelogik

---

**Skapad:** 2026-01-14
**Senast uppdaterad:** 2026-01-14
