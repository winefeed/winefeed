# Logistikintegrationer

**Syfte:** Specificera logistikpartners, API-integrationer och spårningslösningar

---

## Översikt

Winefeed behöver:
1. **Automatisk fraktbokning** när order betalas
2. **Real-time spårning** från leverantör till restaurang
3. **Specialhantering för alkohol** (temperatur, försäkring)
4. **Notifikationer** vid leveransmilstolpar

---

## Logistikpartners

### 1. DHL Freight (Sverige)

**Fördelar:**
- Stor täckning i Sverige och Norden
- B2B-fokus med företagsleveranser
- Bra API med spårning
- Specialtjänster för ömtåliga varor

**API-typ:** REST API
**Dokumentation:** https://developer.dhl.com/

#### Funktioner:
- Freight booking API (boka frakt)
- Tracking API (spåra sändningar)
- Webhooks för status updates
- Proof of delivery (POD)

#### Kostnader:
- Baserat på vikt, volym och sträcka
- Ca 200-500 kr per leverans inom Sverige (beroende på mängd)
- Försäkring: +1-2% av varuvärde

#### Exempel: Boka frakt

```typescript
interface DHLFreightBooking {
  shipment_date: string; // ISO 8601
  pickup_address: {
    company: string;
    street: string;
    postal_code: string;
    city: string;
    country_code: string;
    contact_person: string;
    phone: string;
  };
  delivery_address: {
    company: string;
    street: string;
    postal_code: string;
    city: string;
    country_code: string;
    contact_person: string;
    phone: string;
  };
  packages: {
    weight_kg: number;
    length_cm: number;
    width_cm: number;
    height_cm: number;
    quantity: number;
  }[];
  service_type: 'EXPRESS' | 'STANDARD' | 'ECONOMY';
  special_instructions?: string;
  insurance_value_sek?: number;
  reference_number: string; // Vårt ordernummer
}

const bookDHLFreight = async (order: Order) => {
  const response = await fetch('https://api.dhl.com/freight/v1/shipments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DHL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shipment_date: new Date().toISOString(),
      pickup_address: {
        company: order.supplier.name,
        street: order.supplier.address_line1,
        postal_code: order.supplier.postal_code,
        city: order.supplier.city,
        country_code: 'SE',
        contact_person: order.supplier.contact_person,
        phone: order.supplier.contact_phone,
      },
      delivery_address: {
        company: order.restaurant.name,
        street: order.delivery_address_line1,
        postal_code: order.delivery_postal_code,
        city: order.delivery_city,
        country_code: order.delivery_country_code,
        contact_person: order.contact_person,
        phone: order.contact_phone,
      },
      packages: [{
        weight_kg: calculateTotalWeight(order.items), // t.ex. 15 kg för 20 flaskor
        length_cm: 40,
        width_cm: 30,
        height_cm: 35,
        quantity: Math.ceil(order.items.reduce((sum, item) => sum + item.quantity, 0) / 12), // 12 flaskor per kull
      }],
      service_type: 'STANDARD',
      special_instructions: 'FRAGILE - Wine bottles. Handle with care. Keep upright.',
      insurance_value_sek: order.subtotal_sek,
      reference_number: order.order_number, // WF-2026-00123
    } as DHLFreightBooking)
  });

  const result = await response.json();
  return {
    shipment_id: result.shipment_id,
    tracking_number: result.tracking_number,
    tracking_url: result.tracking_url,
    estimated_delivery: result.estimated_delivery_date,
    shipping_label_url: result.label_url, // PDF för fraktsedel
  };
};
```

#### Exempel: Spåra sändning

```typescript
const trackDHLShipment = async (trackingNumber: string) => {
  const response = await fetch(
    `https://api.dhl.com/track/shipments?trackingNumber=${trackingNumber}`,
    {
      headers: {
        'Authorization': `Bearer ${DHL_API_KEY}`,
      }
    }
  );

  const result = await response.json();
  return {
    status: result.shipments[0].status.statusCode, // e.g., 'transit', 'delivered'
    status_description: result.shipments[0].status.description,
    current_location: result.shipments[0].status.location,
    estimated_delivery: result.shipments[0].estimatedDeliveryDate,
    events: result.shipments[0].events.map((e: any) => ({
      timestamp: e.timestamp,
      description: e.description,
      location: e.location?.address?.addressLocality,
    }))
  };
};
```

#### Webhook (leveransstatus)

```typescript
// POST /api/webhooks/dhl
interface DHLWebhook {
  event_type: 'shipment.created' | 'shipment.in_transit' | 'shipment.delivered' | 'shipment.exception';
  tracking_number: string;
  reference_number: string; // Vårt ordernummer
  status: string;
  timestamp: string;
  location?: {
    city: string;
    country_code: string;
  };
}

export async function handleDHLWebhook(webhook: DHLWebhook) {
  const order = await findOrderByNumber(webhook.reference_number);

  switch (webhook.event_type) {
    case 'shipment.in_transit':
      await updateOrderStatus(order.order_id, 'SHIPPED');
      await notifyRestaurant(order, `Din vinleverans är på väg! Spårningsnummer: ${webhook.tracking_number}`);
      break;

    case 'shipment.delivered':
      await updateOrderStatus(order.order_id, 'DELIVERED');
      await releaseEscrowPayment(order.order_id); // Frigör betalning till leverantör
      await notifyRestaurant(order, 'Din vinleverans har anlänt!');
      break;

    case 'shipment.exception':
      await updateOrderStatus(order.order_id, 'DELIVERY_ISSUE');
      await notifySupport(order, `Leveransproblem: ${webhook.status}`);
      break;
  }
}
```

---

### 2. VinLog (Specialiserad vintransport)

**Fördelar:**
- Specialiserad på vin och alkohol
- Temperaturkontrollerade fordon
- Högre service-nivå
- Försäkring inkluderad

**Nackdelar:**
- Mindre täckning än DHL
- Högre kostnader
- Mindre utvecklad API

**API-typ:** REST/SOAP (ofta äldre system)
**Dokumentation:** Via direkt kontakt

#### Funktioner:
- Boknings-API (ofta via email/portal)
- Grundläggande spårning
- Specialhantering (temperatur, försäkring)

#### Kostnader:
- 300-800 kr per leverans (beroende på mängd och destination)
- Försäkring inkluderad upp till ett visst belopp

#### Integration (förenklad)

```typescript
// Ofta ingen fullständig API - hybrid-lösning
const bookVinLogDelivery = async (order: Order) => {
  // Option 1: API om tillgänglig
  if (VINLOG_API_AVAILABLE) {
    const response = await fetch('https://api.vinlog.se/bookings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VINLOG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickup: {
          name: order.supplier.name,
          address: order.supplier.address_line1,
          postal_code: order.supplier.postal_code,
          city: order.supplier.city,
        },
        delivery: {
          name: order.restaurant.name,
          address: order.delivery_address_line1,
          postal_code: order.delivery_postal_code,
          city: order.delivery_city,
        },
        bottles: order.items.reduce((sum, item) => sum + item.quantity, 0),
        estimated_value_sek: order.subtotal_sek,
        reference: order.order_number,
      })
    });
    return response.json();
  }

  // Option 2: Email-baserad bokning (automatisk email-generering)
  await sendVinLogBookingEmail({
    to: 'bookings@vinlog.se',
    subject: `Bokning - ${order.order_number}`,
    body: generateBookingEmailTemplate(order),
    attachments: [
      {
        filename: 'order_details.pdf',
        content: await generateOrderPDF(order),
      }
    ]
  });

  // Manuellt eller semi-automatiskt spårning via email-notifikationer
  return {
    booking_method: 'EMAIL',
    confirmation_pending: true,
  };
};
```

---

### 3. Schenker (DB Schenker)

**Fördelar:**
- Stor i Europa
- Bra för gränsöverskridande leveranser
- Robust API
- Hantering av tull och importpapper

**API-typ:** REST API
**Dokumentation:** https://developer.dbschenker.com/

#### Funktioner:
- Freight booking
- Customs clearance support
- Multi-modal transport (väg, järnväg, sjö)
- Track & trace

#### Användningsfall:
- Import av vin från andra EU-länder
- Framtida internationell expansion

---

## Unified Logistics Layer

För att abstrahera olika logistikpartners skapar vi ett enhetligt interface.

### Interface Definition

```typescript
export interface LogisticsProvider {
  name: string;
  bookShipment(order: Order): Promise<ShipmentBooking>;
  trackShipment(trackingNumber: string): Promise<ShipmentTracking>;
  cancelShipment(shipmentId: string): Promise<void>;
  getShippingLabel(shipmentId: string): Promise<Buffer>; // PDF
}

export interface ShipmentBooking {
  provider: 'DHL' | 'VINLOG' | 'SCHENKER';
  shipment_id: string;
  tracking_number: string;
  tracking_url: string;
  estimated_delivery_date: string;
  shipping_label_url: string;
  cost_sek: number;
}

export interface ShipmentTracking {
  tracking_number: string;
  status: ShipmentStatus;
  status_description: string;
  current_location?: string;
  estimated_delivery: string;
  events: ShipmentEvent[];
}

export type ShipmentStatus =
  | 'PENDING'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'RETURNED';

export interface ShipmentEvent {
  timestamp: string;
  status: string;
  description: string;
  location?: string;
}
```

### Implementation: DHL Provider

```typescript
export class DHLLogisticsProvider implements LogisticsProvider {
  name = 'DHL';

  async bookShipment(order: Order): Promise<ShipmentBooking> {
    const response = await fetch('https://api.dhl.com/freight/v1/shipments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DHL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildBookingPayload(order)),
    });

    const result = await response.json();

    return {
      provider: 'DHL',
      shipment_id: result.shipment_id,
      tracking_number: result.tracking_number,
      tracking_url: `https://www.dhl.com/se-sv/home/tracking.html?tracking-id=${result.tracking_number}`,
      estimated_delivery_date: result.estimated_delivery_date,
      shipping_label_url: result.label_url,
      cost_sek: result.total_price_sek,
    };
  }

  async trackShipment(trackingNumber: string): Promise<ShipmentTracking> {
    // Implementation som ovan
    // ...
  }

  private buildBookingPayload(order: Order) {
    // Transform order to DHL API format
    // ...
  }
}
```

### Logistics Orchestrator

```typescript
export class LogisticsOrchestrator {
  private providers: Map<string, LogisticsProvider>;

  constructor() {
    this.providers = new Map([
      ['DHL', new DHLLogisticsProvider()],
      ['VINLOG', new VinLogLogisticsProvider()],
      ['SCHENKER', new SchenkerLogisticsProvider()],
    ]);
  }

  async bookShipmentForOrder(order: Order): Promise<Shipment> {
    // 1. Välj bästa provider baserat på:
    //    - Destination
    //    - Vikt/volym
    //    - Pris
    //    - Leverantörens preferens
    const provider = this.selectProvider(order);

    // 2. Boka frakt
    const booking = await provider.bookShipment(order);

    // 3. Spara i databas
    const shipment = await this.saveShipment({
      order_id: order.order_id,
      provider: booking.provider,
      shipment_id: booking.shipment_id,
      tracking_number: booking.tracking_number,
      tracking_url: booking.tracking_url,
      estimated_delivery_date: booking.estimated_delivery_date,
      shipping_cost_sek: booking.cost_sek,
      status: 'PENDING',
    });

    // 4. Uppdatera order status
    await updateOrderStatus(order.order_id, 'SHIPPED');

    // 5. Skicka notifikation till restaurang
    await notifyRestaurant(order, {
      type: 'SHIPMENT_CREATED',
      tracking_number: booking.tracking_number,
      tracking_url: booking.tracking_url,
    });

    return shipment;
  }

  private selectProvider(order: Order): LogisticsProvider {
    // Enkel logik för MVP
    // TODO: Implementera smart routing baserat på pris, tid, destination
    return this.providers.get('DHL')!;
  }

  async trackAllActiveShipments(): Promise<void> {
    const activeShipments = await getActiveShipments();

    for (const shipment of activeShipments) {
      const provider = this.providers.get(shipment.provider);
      if (!provider) continue;

      try {
        const tracking = await provider.trackShipment(shipment.tracking_number);

        // Uppdatera status om ändrad
        if (tracking.status !== shipment.status) {
          await updateShipmentStatus(shipment.shipment_id, tracking.status);

          // Hantera specifika statusar
          if (tracking.status === 'DELIVERED') {
            await handleDeliveryCompleted(shipment.order_id);
          } else if (tracking.status === 'EXCEPTION') {
            await handleDeliveryException(shipment.order_id, tracking.status_description);
          }
        }
      } catch (error) {
        console.error(`Failed to track shipment ${shipment.tracking_number}:`, error);
      }
    }
  }
}
```

---

## Datamodell: Shipments

```sql
CREATE TABLE shipments (
  shipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  -- Provider
  provider VARCHAR(20) NOT NULL, -- 'DHL', 'VINLOG', 'SCHENKER'
  provider_shipment_id VARCHAR(255),

  -- Spårning
  tracking_number VARCHAR(100) UNIQUE NOT NULL,
  tracking_url VARCHAR(500),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
    -- Eller EXCEPTION → RETURNED

  -- Kostnad
  shipping_cost_sek DECIMAL(10,2),

  -- Tidsestimat
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  picked_up_at TIMESTAMPTZ,

  -- Proof of delivery
  pod_signature_url VARCHAR(500), -- URL till signatur
  pod_name VARCHAR(255), -- Vem som kvitterat
  pod_timestamp TIMESTAMPTZ,

  -- Försäkring
  insurance_value_sek DECIMAL(10,2),
  insurance_policy_number VARCHAR(100),

  -- Metadata
  carrier_reference VARCHAR(100),
  special_instructions TEXT,
  shipping_label_url VARCHAR(500), -- PDF

  -- Tidsstämplar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_shipment_status CHECK (status IN (
    'PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'EXCEPTION', 'RETURNED'
  ))
);

CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_status ON shipments(status);

-- Händelselogg för spårning
CREATE TABLE shipment_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,

  -- Event
  event_type VARCHAR(50) NOT NULL, -- 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', etc.
  description TEXT,

  -- Location
  location_city VARCHAR(100),
  location_country_code CHAR(2),

  -- Tidsstämpel
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipment_events_shipment ON shipment_events(shipment_id);
CREATE INDEX idx_shipment_events_occurred ON shipment_events(occurred_at DESC);
```

---

## Automated Tracking Poller

För providers utan webhook-stöd kan vi polla för uppdateringar.

```typescript
// Cron job som körs var 30:e minut
export async function pollShipmentUpdates() {
  const orchestrator = new LogisticsOrchestrator();
  await orchestrator.trackAllActiveShipments();
}

// I Next.js API route eller separat worker
// GET /api/cron/track-shipments
export async function GET() {
  await pollShipmentUpdates();
  return new Response('OK', { status: 200 });
}
```

---

## Notifikationer till restauranger

```typescript
export async function notifyRestaurant(order: Order, notification: {
  type: 'SHIPMENT_CREATED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  tracking_number: string;
  tracking_url: string;
}) {
  const messages = {
    SHIPMENT_CREATED: `Din vinleverans har skickats! Spårningsnummer: ${notification.tracking_number}`,
    IN_TRANSIT: `Din vinleverans är på väg!`,
    OUT_FOR_DELIVERY: `Din vinleverans levereras idag!`,
    DELIVERED: `Din vinleverans har anlänt! Kontrollera att allt är i ordning.`,
  };

  // Email
  await sendEmail({
    to: order.contact_email,
    subject: `Winefeed - ${messages[notification.type]}`,
    html: renderEmailTemplate('shipment_update', {
      order,
      notification,
      tracking_url: notification.tracking_url,
    }),
  });

  // SMS (optional)
  if (order.contact_phone && notification.type === 'OUT_FOR_DELIVERY') {
    await sendSMS({
      to: order.contact_phone,
      message: `${messages[notification.type]} Spåra: ${notification.tracking_url}`,
    });
  }

  // In-app notification
  await createInAppNotification({
    user_id: order.restaurant.user_id,
    type: notification.type,
    title: 'Leveransuppdatering',
    message: messages[notification.type],
    link: `/orders/${order.order_id}`,
  });
}
```

---

## Nästa steg

1. ✅ Kontakta DHL för API-access och pricing
2. ⏳ Utvärdera VinLog för premium-leveranser
3. ⏳ Implementera Logistics Orchestrator
4. ⏳ Sätt upp webhook-endpoints för DHL
5. ⏳ Skapa cron job för tracking-poller
6. ⏳ Designa notifikationssystem för restauranger

---

**Rekommendation:**

För MVP:
- **Primär:** DHL (bra API, bred täckning, rimligt pris)
- **Fallback:** Manuell hantering via email

För production:
- Lägg till VinLog för premium-leveranser (högre värde, känsliga kunder)
- Implementera smart routing baserat på pris/tid/destination

---

**Skapad:** 2026-01-14
**Senast uppdaterad:** 2026-01-14
