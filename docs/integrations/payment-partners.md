# Betalningsintegrationer

**Syfte:** Specificera betalningspartners, API-integrationer och escrow-hantering

---

## Översikt

Winefeed behöver robusta betalningslösningar som stödjer:
1. **B2B-betalningar** (faktura, företagskort)
2. **Escrow/split payment** (hålla medel tills leverans)
3. **PCI DSS-compliance** (vi sparar inga kortuppgifter)
4. **Svensk och nordisk marknad**

---

## Betalningspartners

### 1. Worldline (Tidigare Bambora/Nets)

**Fördelar:**
- Stor i Norden
- B2B-fokus med faktureringslösningar
- Escrow-funktionalitet via marketplace-tjänster
- PCI DSS Level 1-certifierad

**API-typ:** REST API
**Dokumentation:** https://developer.worldline.com/

#### Funktioner vi behöver:
- Payment Intent API (skapa betalning)
- Card payments (Visa, Mastercard)
- B2B invoice (faktura 30 dagar)
- Split payment (dela upp betalning mellan Winefeed och leverantör)
- Webhooks för statusuppdateringar

#### Kostnader (uppskattade):
- Kortbetalning: 1,5-2,5% + 2 kr per transaktion
- Faktura: 2-3% + fast avgift
- Månadskostnad: 0-500 kr beroende på volym

#### Exempel: Skapa betalning

```typescript
// POST https://api.worldline.com/v1/payments
const createPayment = async (orderId: string, amount: number) => {
  const response = await fetch('https://api.worldline.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WORLDLINE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: orderId,
      amount: amount * 100, // öre
      currency: 'SEK',
      payment_methods: ['card', 'invoice'],
      return_url: `https://winefeed.se/orders/${orderId}/payment/complete`,
      webhook_url: 'https://winefeed.se/api/webhooks/worldline',
      metadata: {
        order_number: 'WF-2026-00123',
        restaurant_id: 'uuid'
      }
    })
  });

  return response.json();
};
```

#### Webhook exempel (betalning bekräftad)

```typescript
// POST /api/webhooks/worldline
interface WorldlineWebhook {
  event: 'payment.succeeded' | 'payment.failed' | 'payment.pending';
  payment_id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  timestamp: string;
}

export async function handleWorldlineWebhook(webhook: WorldlineWebhook) {
  if (webhook.event === 'payment.succeeded') {
    await updateOrderStatus(webhook.order_id, 'PAID');
    await notifyRestaurant(webhook.order_id);
    await notifySupplier(webhook.order_id);
  }
}
```

---

### 2. Stripe

**Fördelar:**
- Bäst-i-klassen developer experience
- Stark dokumentation och SDK:er
- Stripe Connect för marketplace/split payments
- Globalt etablerad

**Nackdelar:**
- Mindre fokus på nordisk B2B-faktura
- Högre avgifter för vissa betalmetoder

**API-typ:** REST API + officiella SDK:er (Node, Python, etc.)
**Dokumentation:** https://stripe.com/docs/api

#### Funktioner vi behöver:
- Payment Intents API
- Stripe Connect (för split payment)
- Invoices API (faktura)
- Webhooks

#### Kostnader:
- Kortbetalning: 1,4% + 1,80 kr (EEA-kort)
- Connect-avgift: +2% för split payments
- Faktura: Kräver Stripe Billing

#### Exempel: Skapa Payment Intent

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const createPaymentIntent = async (orderId: string, amount: number) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // öre
    currency: 'sek',
    payment_method_types: ['card'],
    metadata: {
      order_id: orderId,
      order_number: 'WF-2026-00123'
    },
    // Split payment via Stripe Connect
    transfer_data: {
      destination: 'acct_supplier_123', // Leverantörens Stripe-konto
    },
    application_fee_amount: 500 * 100, // Winefeed:s provision (5%)
  });

  return paymentIntent;
};
```

#### Webhook exempel

```typescript
// POST /api/webhooks/stripe
import { buffer } from 'micro';

export async function handleStripeWebhook(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    await updateOrderStatus(paymentIntent.metadata.order_id, 'PAID');
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

---

### 3. Klarna (B2B-faktura)

**Fördelar:**
- Marknadsledande i Norden för faktura
- B2B-lösningar med kreditkontroll
- Flexibla betalvillkor (14-30 dagar)

**Nackdelar:**
- Inget escrow/split payment native
- Högre avgifter för faktura

**API-typ:** REST API
**Dokumentation:** https://docs.klarna.com/

#### Funktioner:
- Klarna Checkout (för kortbetalningar)
- Klarna Payments (Payment Methods API)
- B2B Invoice (faktura med kreditkontroll)

#### Kostnader:
- Faktura B2B: 2,5-4% beroende på riskprofil
- Fast avgift: ca 3-5 kr per transaktion

#### Exempel: Skapa B2B-faktura

```typescript
const createKlarnaInvoice = async (order: Order, restaurant: Restaurant) => {
  const response = await fetch('https://api.klarna.com/checkout/v3/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${KLARNA_UID}:${KLARNA_PASSWORD}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      purchase_country: 'SE',
      purchase_currency: 'SEK',
      locale: 'sv-SE',
      order_amount: order.total_sek * 100,
      order_tax_amount: order.vat_amount_sek * 100,
      order_lines: order.items.map(item => ({
        name: item.wine_name,
        quantity: item.quantity,
        unit_price: item.unit_price_sek * 100,
        tax_rate: order.vat_rate * 100,
        total_amount: item.line_total_sek * 100,
        total_tax_amount: (item.line_total_sek * order.vat_rate / 100) * 100,
      })),
      merchant_urls: {
        confirmation: `https://winefeed.se/orders/${order.order_id}/confirmed`,
        notification: 'https://winefeed.se/api/webhooks/klarna',
      },
      // B2B-specific
      customer: {
        type: 'organization',
        organization_registration_id: restaurant.org_number, // Orgnr
      },
      billing_address: {
        organization_name: restaurant.name,
        street_address: restaurant.billing_address_line1,
        postal_code: restaurant.billing_postal_code,
        city: restaurant.billing_city,
        country: 'SE',
      },
      options: {
        allowed_customer_types: ['organization'],
      },
    })
  });

  return response.json();
};
```

---

## Escrow & Split Payment

### Koncept

**Escrow:**
- Medel hålls av betalningspartner tills leverans bekräftats
- Skyddar både restaurang (får vad de betalt för) och leverantör (garanterad betalning)

**Split Payment:**
- Betalningen delas upp automatiskt:
  - X% till leverantör
  - Y% till Winefeed (provision)
  - Z kr till fraktkostnad (eventuellt)

### Implementation med Stripe Connect

```typescript
// 1. Leverantör ansluter sitt Stripe-konto till Winefeed
const connectAccount = await stripe.accounts.create({
  type: 'express',
  country: 'SE',
  email: 'leverantor@example.com',
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});

// 2. Vid betalning: håll medel i escrow
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000 * 100, // 10,000 SEK
  currency: 'sek',
  payment_method_types: ['card'],
  on_behalf_of: connectAccount.id, // Leverantörens konto
  transfer_data: {
    destination: connectAccount.id,
  },
  // Medel hålls tills explicit release
});

// 3. Efter leverans bekräftad: frigör medel
await stripe.transfers.create({
  amount: 9500 * 100, // 9,500 SEK till leverantör (efter provision)
  currency: 'sek',
  destination: connectAccount.id,
  source_transaction: paymentIntent.charges.data[0].id,
  description: 'Order WF-2026-00123 delivered',
});

// Winefeed får automatiskt sin 500 SEK som application_fee
```

### Implementation med Worldline Marketplace

```typescript
// Worldline har marketplace-tjänst som stödjer escrow
const marketplacePayment = await worldlineMarketplace.createPayment({
  order_id: 'WF-2026-00123',
  amount: 10000 * 100,
  currency: 'SEK',
  // Split payment
  sub_merchants: [
    {
      merchant_id: 'supplier_123',
      amount: 9500 * 100, // 95% till leverantör
    },
    {
      merchant_id: 'winefeed',
      amount: 500 * 100, // 5% provision
    }
  ],
  // Escrow: håll medel tills approved
  escrow: {
    hold_until: 'approved', // eller 'delivered'
  }
});

// Efter leverans: frigör medel
await worldlineMarketplace.releaseEscrow({
  payment_id: marketplacePayment.id,
  release_to: ['supplier_123', 'winefeed']
});
```

---

## PCI DSS Compliance

### Vad vi INTE får göra:
- ❌ Spara kortuppgifter (PAN, CVV, etc.)
- ❌ Logga kortdata
- ❌ Skicka kortdata i klartext

### Vad vi GÖR:
- ✅ Använd betalningspartners' hosted checkout (Stripe Elements, Worldline Hosted Payment Page)
- ✅ Tokenisering - vi får bara en token (t.ex. `pm_1234...`)
- ✅ PCI DSS SAQ A (Self-Assessment Questionnaire A) - lägsta nivån

### Exempel: Stripe Elements (frontend)

```typescript
// Frontend: React component
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PaymentForm({ orderId, amount }: { orderId: string; amount: number }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    // 1. Skapa Payment Intent på backend
    const { clientSecret } = await fetch('/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount }),
    }).then(r => r.json());

    // 2. Bekräfta betalning med Stripe Elements (inga kortuppgifter till vår server)
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)!,
      },
    });

    if (error) {
      console.error(error);
    } else if (paymentIntent.status === 'succeeded') {
      // Betalning lyckades - redirect till success-sida
      window.location.href = `/orders/${orderId}/payment/success`;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit" disabled={!stripe}>
        Betala {amount} kr
      </button>
    </form>
  );
}

export default function PaymentPage() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm orderId="uuid" amount={10000} />
    </Elements>
  );
}
```

---

## Datamodell: Payments

```sql
CREATE TABLE payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  -- Betalningspartner
  provider VARCHAR(20) NOT NULL, -- 'STRIPE', 'WORLDLINE', 'KLARNA'
  provider_payment_id VARCHAR(255) UNIQUE NOT NULL, -- t.ex. 'pi_1234...'

  -- Belopp
  amount_sek DECIMAL(10,2) NOT NULL,
  currency CHAR(3) DEFAULT 'SEK',

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING → PROCESSING → SUCCEEDED → CAPTURED
    -- Eller FAILED → REFUNDED

  -- Betalmetod
  payment_method_type VARCHAR(20), -- 'CARD', 'INVOICE', 'BANK_TRANSFER'
  payment_method_details JSONB, -- Maskat kortnummer, fakturainfo, etc.

  -- Escrow
  escrow_status VARCHAR(20) DEFAULT 'NONE',
    -- NONE → HELD → RELEASED → REFUNDED
  escrow_released_at TIMESTAMPTZ,

  -- Metadata
  client_secret VARCHAR(255), -- För Stripe Elements
  receipt_url VARCHAR(500),

  -- Tidsstämplar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES users(user_id)
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_provider_id ON payments(provider, provider_payment_id);
CREATE INDEX idx_payments_status ON payments(status);
```

---

## Nästa steg

1. ✅ Utvärdera Worldline vs Stripe för vårt use case
2. ⏳ Kontakta säljare för pricing och support
3. ⏳ Sätt upp sandbox-konton för testning
4. ⏳ Implementera Payment Orchestration Layer (abstraktion över providers)
5. ⏳ Säkerställ PCI DSS SAQ A-compliance

---

**Rekommendation:**

För MVP:
- **Primär:** Stripe (bäst developer experience, snabb time-to-market)
- **Sekundär:** Klarna (för restauranger som föredrar faktura)

För production:
- Utvärdera Worldline för lägre avgifter och bättre nordiskt B2B-stöd
- Behåll Stripe som fallback

---

**Skapad:** 2026-01-14
**Senast uppdaterad:** 2026-01-14
