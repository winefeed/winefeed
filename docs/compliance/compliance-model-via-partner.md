# Regelefterlevnad via Licensierad Importörpartner

**Syfte:** Dokumentera Winefeeds affärsmodell där regelefterlevnad hanteras av en licensierad importörpartner

**Status:** Rekommenderad modell för MVP och skalning

---

## Översikt

Winefeed fungerar som **teknisk och administrativ mellanhand**, inte som vinhandlare eller importör. All regelefterlevnad (alkoholskatt, EMCS, licenser) hanteras av en **licensierad importörpartner**.

### Kärnprincip

> **Winefeed säljer inte vin och hanterar inte alkohollicenser.**
> Vi koordinerar processen och säkerställer korrekt dataflöde och dokumentation.

---

## Rollfördelning

```
┌────────────────────────────────────────────────────────────────┐
│                    AKTÖRER OCH ANSVAR                           │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Restaurang (Köpare)                                            │
│  ├─ Beställer vin via Winefeed                                 │
│  ├─ Betalar för vin + frakt + skatter                          │
│  └─ Tar emot leverans                                           │
│                                                                  │
│  Winefeed (Koordinator)                                         │
│  ├─ Tillhandahåller plattform och användarupplevelse           │
│  ├─ Hanterar orderflöde och kommunikation                      │
│  ├─ Koordinerar mellan restaurang, importör och producent      │
│  ├─ Genererar dokumentation (faktura, bokföringsunderlag)      │
│  └─ Tar provision för förmedlingstjänst                         │
│                                                                  │
│  Licensierad Importör (Compliance-partner)                      │
│  ├─ Registrerad som "godkänd mottagare" hos Skatteverket       │
│  ├─ Ansvarar för alkoholskatt och uppskovsförfarande           │
│  ├─ Hanterar EMCS-dokumentation (e-AD, ARC-nummer)            │
│  ├─ Registrerar restauranger som "direktleveransplatser"       │
│  ├─ Deklarerar och betalar punktskatt till Skatteverket        │
│  ├─ Organiserar transport (direkt eller via logistikpartner)   │
│  └─ Juridiskt ansvar för regelefterlevnad                       │
│                                                                  │
│  EU-Producent/Vingård (Säljare)                                │
│  ├─ Säljer vin till restaurangen                                │
│  ├─ Skapar EMCS-dokument (e-AD) för leverans under uppskov     │
│  └─ Skickar direkt till restaurang i Sverige                    │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Processflöde (Komplett)

### Steg 1: Order skapas

```
Restaurang                Winefeed                  Database
    │                         │                         │
    │  1. Beställer vin       │                         │
    │  (via plattform)        │                         │
    │────────────────────────>│                         │
    │                         │  2. Skapar Order        │
    │                         │────────────────────────>│
    │                         │  (status: PENDING)      │
    │                         │                         │
    │  3. Orderbekräftelse    │                         │
    │<────────────────────────│                         │
    │  (Order #WF-2026-00123) │                         │
```

### Steg 2: Order skickas till Licensierad Importör

```
Winefeed              Importör API/Email         Importör
    │                         │                       │
    │  1. Skickar orderdata   │                       │
    │────────────────────────>│                       │
    │  Format:                │                       │
    │  - Restauranginfo       │                       │
    │  - Vindetaljer          │                       │
    │  - Leveransadress       │                       │
    │  - Kontaktperson        │                       │
    │                         │  2. Tar emot order    │
    │                         │──────────────────────>│
    │                         │                       │
    │                         │  3. Kontrollerar:     │
    │                         │     - Tillgänglighet  │
    │                         │     - Pris            │
    │                         │     - Licensstatus    │
    │                         │                       │
    │  4. Bekräftelse         │                       │
    │<────────────────────────│<──────────────────────│
    │  - Bekräftat pris       │                       │
    │  - Leveranstid          │                       │
    │  - Totalkostnad inkl.   │                       │
    │    skatter              │                       │
```

### Steg 3: Importör registrerar Restaurangen

```
Importör                  Skatteverket (EMCS)      Database (Winefeed)
    │                             │                        │
    │  1. Kontrollerar om         │                        │
    │  restaurang redan           │                        │
    │  registrerad                │                        │
    │                             │                        │
    │  Om ej registrerad:         │                        │
    │                             │                        │
    │  2. Anmäler restaurang      │                        │
    │  som "Direktleveransplats"  │                        │
    │────────────────────────────>│                        │
    │  (kod 5369_03)              │                        │
    │                             │                        │
    │  3. Restaurang får EMCS-ID  │                        │
    │<────────────────────────────│                        │
    │  (t.ex. SE12345678)         │                        │
    │                             │                        │
    │  4. Sparar EMCS-ID          │                        │
    │─────────────────────────────────────────────────────>│
    │                             │                        │
```

### Steg 4: Importör beställer från EU-producent

```
Importör            EU-Producent          EMCS (EU-system)
    │                     │                       │
    │  1. Beställer vin   │                       │
    │────────────────────>│                       │
    │                     │                       │
    │                     │  2. Skapar e-AD       │
    │                     │  (elektroniskt        │
    │                     │  följedokument)       │
    │                     │──────────────────────>│
    │                     │                       │
    │                     │  3. ARC-nummer        │
    │                     │  genereras            │
    │                     │<──────────────────────│
    │                     │  (t.ex.               │
    │                     │   FR12AB34567890)     │
    │                     │                       │
    │  4. ARC-nummer      │                       │
    │  + leveransinfo     │                       │
    │<────────────────────│                       │
```

### Steg 5: Vin levereras direkt till Restaurang

```
EU-Producent      Transport      Restaurang      Importör
    │                 │               │               │
    │  1. Skickar vin │               │               │
    │  (EMCS-dokument │               │               │
    │   medföljer)    │               │               │
    │────────────────>│               │               │
    │                 │               │               │
    │                 │  2. Leverans  │               │
    │                 │───────────────>│               │
    │                 │  ARC-nummer   │               │
    │                 │  på fraktsedel│               │
    │                 │               │               │
    │                 │  3. Kvitterar │               │
    │                 │  mottagande   │               │
    │                 │<───────────────│               │
    │                 │               │               │
    │                 │               │  4. Notifieras│
    │                 │               │  om leverans  │
    │                 │               │<──────────────│
```

### Steg 6: Importör hanterar Punktskatt

```
Importör              EMCS               Skatteverket
    │                     │                     │
    │  1. Bekräftar       │                     │
    │  mottagande i EMCS  │                     │
    │────────────────────>│                     │
    │  (inom 5 dagar)     │                     │
    │                     │                     │
    │                     │  2. Punktskatt      │
    │                     │  förfaller          │
    │                     │────────────────────>│
    │                     │                     │
    │  3. Deklarerar och  │                     │
    │  betalar punktskatt │                     │
    │─────────────────────────────────────────>│
    │  (senast 15:e i     │                     │
    │   månaden efter)    │                     │
```

### Steg 7: Winefeed genererar Dokumentation

```
Winefeed          Document Service       Restaurang
    │                     │                     │
    │  1. Hämtar data     │                     │
    │  från importör:     │                     │
    │  - Punktskatt       │                     │
    │  - Moms             │                     │
    │  - Fraktkostnad     │                     │
    │                     │                     │
    │  2. Genererar       │                     │
    │  dokument:          │                     │
    │────────────────────>│                     │
    │  - Faktura          │                     │
    │  - Skatteunderlag   │                     │
    │  - Fraktsedel       │                     │
    │                     │                     │
    │                     │  3. Skickar till    │
    │                     │  restaurang         │
    │                     │────────────────────>│
    │                     │  (PDF + JSON för    │
    │                     │   bokföringssystem) │
```

---

## Juridisk Struktur

### Avtalsstruktur

```
┌─────────────────────────────────────────────────────────┐
│                    AVTALSRELATIONER                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. Restaurang ↔ Winefeed                                │
│     - Plattformsavtal                                     │
│     - Winefeed tillhandahåller förmedlingstjänst         │
│     - Provision: X% av ordervärde eller fast avgift      │
│                                                           │
│  2. Winefeed ↔ Licensierad Importör                      │
│     - Samarbetsavtal                                      │
│     - Importören hanterar compliance                      │
│     - Fee-struktur för importörens tjänster              │
│                                                           │
│  3. Restaurang ↔ EU-Producent (via Importör)            │
│     - Köpeavtal                                           │
│     - Restaurang är köpare                                │
│     - Importör faciliterar transaktionen                  │
│                                                           │
│  4. Restaurang ↔ Importör (implicit)                     │
│     - Importören agerar som ombud                         │
│     - Hanterar regelefterlevnad för restaurangens räkning│
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Ansvarsfördelning

| Ansvar | Winefeed | Importör | Restaurang | Producent |
|--------|----------|----------|------------|-----------|
| Alkohollicens | ❌ | ✅ | ✅ (serveringstillstånd) | ✅ |
| EMCS-dokumentation | ❌ | ✅ | ❌ | ✅ (skapar e-AD) |
| Punktskatt (deklarera & betala) | ❌ | ✅ | ❌ | ❌ |
| Moms | ⚠️ (på provision) | ✅ (på import) | ✅ (ingående moms) | ✅ |
| Registrering av direktleveransplats | ❌ | ✅ | ❌ | ❌ |
| Transport | ❌ | ✅ (organiserar) | ❌ | ⚠️ (ev. ordnar) |
| Plattform & UX | ✅ | ❌ | ❌ | ❌ |
| Dokumentation (faktura, underlag) | ✅ | ⚠️ (data till Winefeed) | ❌ | ❌ |
| Kundrelation | ✅ | ⚠️ (support vid behov) | - | ❌ |
| Juridiskt ansvar (alkohol) | ❌ | ✅ | ✅ | ✅ |

**Förklaring:**
- ✅ = Fullt ansvar
- ⚠️ = Delat ansvar eller support
- ❌ = Inget ansvar

---

## Dataflöde mot Licensierad Importör

### API/Integration (Preferred)

Om importören har API kan Winefeed integrera direkt.

#### Endpoint: Skapa Order

```typescript
// POST /api/orders (Importörens API)
interface ImporterOrderRequest {
  // Winefeed order reference
  winefeed_order_id: string;
  winefeed_order_number: string; // "WF-2026-00123"

  // Restaurang
  restaurant: {
    name: string;
    org_number: string; // För VIES-kontroll
    vat_number?: string;
    serving_license_number: string; // Serveringstillstånd
    delivery_address: {
      line1: string;
      line2?: string;
      postal_code: string;
      city: string;
      country_code: string; // "SE"
    };
    contact: {
      person: string;
      email: string;
      phone: string;
    };
  };

  // Vin
  wines: {
    producer: string;
    wine_name: string;
    vintage?: number;
    country: string;
    region?: string;
    quantity: number;
    alcohol_percentage: number;
    bottle_size_ml: number;
    requested_unit_price_excl_vat_eur?: number; // Om känt
  }[];

  // Metadata
  notes?: string;
  requested_delivery_date?: string;
}

interface ImporterOrderResponse {
  // Importörens order ID
  importer_order_id: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';

  // Pris
  wines: {
    wine_index: number; // Index i request
    unit_price_excl_vat_eur: number;
    unit_price_excl_vat_sek: number;
    available_quantity: number;
  }[];

  // Skatter och kostnader
  subtotal_excl_vat_sek: number;
  excise_tax_sek: number;
  vat_sek: number;
  shipping_cost_sek: number;
  total_incl_vat_sek: number;

  // Leverans
  estimated_delivery_date: string;

  // EMCS (om redan registrerad)
  restaurant_emcs_id?: string;
  needs_registration: boolean;

  // Importörens avgift (om separat)
  importer_fee_sek?: number;
}
```

#### Webhook: Status Updates

```typescript
// POST /api/webhooks/importer (Winefeed mottar)
interface ImporterWebhook {
  event: 'order.confirmed' | 'emcs.registered' | 'emcs.created' |
         'shipped' | 'delivered' | 'excise_tax.declared' | 'completed';
  importer_order_id: string;
  winefeed_order_id: string;
  timestamp: string;

  // Event-specifik data
  data?: {
    // För emcs.created
    arc_number?: string;
    ead_reference?: string;

    // För emcs.registered
    restaurant_emcs_id?: string;

    // För shipped
    tracking_number?: string;
    tracking_url?: string;
    carrier?: string;

    // För delivered
    delivery_timestamp?: string;
    proof_of_delivery_url?: string;

    // För excise_tax.declared
    excise_tax_declared_amount_sek?: number;
    declaration_reference?: string;
  };
}
```

### Email-baserad Integration (Fallback)

Om importören inte har API kan Winefeed skicka strukturerad email.

#### Email Template

```
Till: orders@importer.se
Från: noreply@winefeed.se
Ämne: Ny order WF-2026-00123 - Restaurang X

Hej!

Ny order via Winefeed:

ORDER
- Winefeed Order ID: WF-2026-00123
- Datum: 2026-01-14

RESTAURANG
- Namn: Restaurang X AB
- Org.nr: 556123-4567
- Serveringstillstånd: ST-2024-12345
- Leveransadress: Kungsgatan 1, 111 43 Stockholm
- Kontakt: Anna Svensson, anna@restaurang.se, +46701234567

VIN
1. Chianti Classico DOCG 2020, Castello di Fonterutoli
   - Land: Italien, Region: Toscana
   - Alkoholhalt: 13,5%
   - Antal: 12 flaskor (750ml)

2. Barolo DOCG 2018, Paolo Scavino
   - Land: Italien, Region: Piemonte
   - Alkoholhalt: 14,0%
   - Antal: 6 flaskor (750ml)

ÖNSKAD LEVERANS
- Senast: 2026-02-01

ANTECKNINGAR
- Leverera till bakre entrén

---

Vänligen bekräfta order och meddela:
- Pris (exkl. moms)
- Punktskatt
- Fraktkostnad
- Leveranstid
- ARC-nummer (när leverans sker)

Mvh,
Winefeed Team
```

---

## Prissättning och Kostnadsfördelning

### Exempel: Order värd 10,000 SEK

```
┌─────────────────────────────────────────────────────────┐
│            KOSTNADSFÖRDELNING PER ORDER                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Vinpris (från producent)           8,000 SEK (exkl)    │
│  + Punktskatt                       2,000 SEK            │
│  + Fraktkostnad                       500 SEK (exkl)     │
│  ──────────────────────────────────────────────          │
│  Subtotal exkl. moms               10,500 SEK            │
│  + Moms (25%)                       2,625 SEK            │
│  ──────────────────────────────────────────────          │
│  Total till restaurang             13,125 SEK (inkl)     │
│                                                           │
│  FÖRDELNING:                                              │
│                                                           │
│  Producent får                      8,000 SEK            │
│  Skatteverket får                   2,000 SEK (punktskatt)│
│                                     2,625 SEK (moms)      │
│  Logistik                             500 SEK            │
│                                                           │
│  Importörens avgift                   400 SEK (4%)       │
│  Winefeed provision                   500 SEK (5%)       │
│                                                           │
│  ──────────────────────────────────────────────          │
│  Total kostnad för restaurang      13,125 SEK            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Förklaring:**
- **Importörens avgift (4%):** För hantering av compliance, EMCS, punktskatt
- **Winefeed provision (5%):** För plattform, koordination, dokumentation

**Total markup:** 9% (4% + 5%)

---

## Fördelar med denna Modell

### För Winefeed

✅ **Ingen licensiering krävs**
- Ingen initial investering i säkerhet (300-500k SEK)
- Ingen ansökan hos Skatteverket (2-6 månaders handläggningstid)
- Inget EMCS-system att bygga och underhålla

✅ **Snabbare time-to-market**
- Kan lansera inom veckor istället för månader
- Testa marknaden omedelbart
- Iterera snabbt baserat på feedback

✅ **Lägre risk**
- Inget juridiskt ansvar för alkoholregler
- Ingen exponering mot Skatteverket
- Partner bär regelrisk

✅ **Skalbarhet**
- Kan arbeta med flera importörpartners
- Olika partners för olika regioner (Frankrike, Italien, Spanien)
- Flexibel expansion

### För Restaurangen

✅ **Enkel upplevelse**
- En enda kontaktyta (Winefeed-plattformen)
- All komplexitet abstraherad
- Tydlig dokumentation för bokföring

✅ **Transparens**
- Ser alla kostnader (vin, skatt, frakt, provision)
- Får underlag för ingående moms
- Spårning av leverans

✅ **Compliance säkerställd**
- Licensierad partner hanterar regelefterlevnad
- Restaurangen behöver inte förstå EMCS
- Inget ansvar för punktskattedeklaration

### För Importörpartnern

✅ **Ny affärsström**
- Tillgång till Winefeeds restaurangkunder
- Ökad volym utan egen marknadsföring
- Provision per order

✅ **Bibehållen kontroll**
- Fullt ansvar för compliance (= kan säkerställa kvalitet)
- Direktrelation med producenter
- Kan använda befintlig infrastruktur (EMCS, logistik)

---

## Val av Importörpartner

### Kriterier

| Kriterie | Vikt | Varför viktigt |
|----------|------|----------------|
| **Licensiering** | 🔴 Kritisk | Måste vara "godkänd mottagare" hos Skatteverket |
| **EMCS-access** | 🔴 Kritisk | Måste kunna hantera e-AD och ARC-nummer |
| **API/Integration** | 🟡 Viktigt | Möjliggör automation, annars manuell process |
| **Geografisk täckning** | 🟡 Viktigt | Vilka EU-länder kan de importera från? |
| **Pris & Provision** | 🟢 Önskvärt | Bör vara konkurrenskraftigt (3-5%) |
| **Service-nivå** | 🟢 Önskvärt | Snabb respons, bra kommunikation |
| **Volym-kapacitet** | 🟢 Önskvärt | Kan de hantera växande volymer? |

### Potentiella Partners (Sverige)

1. **Brasri AB** (Corentin de Tregomain)
   - Org.nr: 556785-0655
   - Redan licensierad importör
   - Specialiserad på franska viner
   - Har redan dialog med Skatteverket om direktleveranser

2. **Andra svenska vinimportörer**
   - Recherchera: Sök på "godkända mottagare alkohol Sverige"
   - Kontakta Skatteverket för lista

---

## Implementationsplan

### Fas 1: Pilot med en Partner (Q1 2026)

**Mål:** Bevisa konceptet med 10-20 orders

**Steg:**
1. ✅ Kontakta Brasri AB (eller annan importör)
2. ✅ Förhandla samarbetsavtal
3. ✅ Definiera dataformat (API eller email-baserat)
4. ✅ Integrera i Winefeed-plattformen
5. ✅ Onboarda 3-5 pilotrestauranger
6. ✅ Genomför 10-20 testorders
7. ✅ Samla feedback och iterera

**Kriterier för success:**
- 100% regelefterlevnad (inga avvikelser från Skatteverket)
- <5% problemorder (EMCS-fel, leveransproblem)
- >80% restaurangnöjdhet

### Fas 2: Skalning med flera Partners (Q2-Q3 2026)

**Mål:** 50-100 orders/månad, flera EU-länder

**Steg:**
1. ✅ Rekrytera 2-3 ytterligare importörpartners
   - En för Italien
   - En för Spanien
   - (Frankrike redan täckt av Brasri)
2. ✅ Bygga "Importer Orchestrator" - smart routing till bästa partner
3. ✅ Standardisera API-integrationer
4. ✅ Automatisera dokumentgenerering
5. ✅ Implementera monitoring och alerting

### Fas 3: Utvärdera Egen Licensiering (Q4 2026)

**Villkor för att gå vidare med egen licensiering:**
- Volym >100 EU-orders/månad
- Bevisat produktmarknadsfit
- Kapital för initial investering (500k-1M SEK)
- Stabil intäktström (kan täcka löpande compliance-kostnader)

**Fördelar med egen licensiering (vid hög volym):**
- Högre marginaler (sparar importörens 3-5%)
- Full kontroll över processen
- Kan differentiera på service
- Direktrelationer med EU-producenter

---

## Datamodell

### Tabell: importer_partners

```sql
CREATE TABLE importer_partners (
  partner_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Företagsinformation
  company_name VARCHAR(255) NOT NULL,
  org_number VARCHAR(20) UNIQUE NOT NULL,
  vat_number VARCHAR(30),

  -- Licensiering
  skatteverket_approved_receiver_id VARCHAR(50) UNIQUE, -- "Godkänd mottagare"-ID
  emcs_access BOOLEAN DEFAULT false,
  license_valid_from DATE,
  license_valid_until DATE,

  -- Kontakt
  primary_contact_name VARCHAR(255),
  primary_contact_email VARCHAR(255),
  primary_contact_phone VARCHAR(20),
  order_email VARCHAR(255), -- Email för att ta emot orders
  support_email VARCHAR(255),

  -- Kapacitet
  supported_countries TEXT[], -- ['FR', 'IT', 'ES']
  max_orders_per_month INT DEFAULT 100,

  -- Integration
  api_endpoint VARCHAR(500), -- Om API finns
  api_key_encrypted TEXT,
  integration_type VARCHAR(20) DEFAULT 'EMAIL', -- 'API', 'EMAIL', 'MANUAL'
  webhook_url VARCHAR(500),

  -- Prissättning
  commission_percentage DECIMAL(5,2) DEFAULT 4.00, -- 4%
  flat_fee_per_order_sek DECIMAL(10,2) DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'SUSPENDED'
  is_preferred BOOLEAN DEFAULT false,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_importer_partners_status ON importer_partners(status);
CREATE INDEX idx_importer_partners_countries ON importer_partners USING GIN(supported_countries);
```

### Tabell: importer_orders (kopplingstabell)

```sql
CREATE TABLE importer_orders (
  importer_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationer
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES importer_partners(partner_id),

  -- Importörens referens
  partner_order_id VARCHAR(100), -- Importörens eget order-ID
  partner_order_reference VARCHAR(255),

  -- EMCS
  arc_number VARCHAR(50),
  ead_reference VARCHAR(100),
  restaurant_emcs_id VARCHAR(50),

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING → CONFIRMED → EMCS_CREATED → SHIPPED → DELIVERED → COMPLETED

  -- Kostnader (från importören)
  partner_subtotal_sek DECIMAL(10,2),
  partner_excise_tax_sek DECIMAL(10,2),
  partner_shipping_sek DECIMAL(10,2),
  partner_commission_sek DECIMAL(10,2),
  partner_total_sek DECIMAL(10,2),

  -- Tidsstämplar
  confirmed_at TIMESTAMPTZ,
  emcs_created_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  excise_tax_declared_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_importer_orders_order ON importer_orders(order_id);
CREATE INDEX idx_importer_orders_partner ON importer_orders(partner_id);
CREATE INDEX idx_importer_orders_arc ON importer_orders(arc_number);
```

---

## API Endpoints (Winefeed internt)

### POST `/api/internal/importer-orders`

Skicka order till vald importörpartner.

```typescript
const response = await fetch('/api/internal/importer-orders', {
  method: 'POST',
  body: JSON.stringify({
    order_id: 'uuid',
    partner_id: 'uuid', // Eller låt systemet välja automatiskt
  })
});
```

### GET `/api/internal/importer-orders/:order_id`

Hämta status från importör.

---

## Juridisk Checklist

- [ ] Samarbetsavtal med importörpartner tecknat
- [ ] Ansvarsfördelning tydligt dokumenterad
- [ ] Försäkring för plattformsansvar (E&O insurance)
- [ ] GDPR-compliance (DPA med partner)
- [ ] Verifierat att partner är licensierad ("godkänd mottagare")
- [ ] Konsulterat jurist för avtalsstruktur

---

## Nästa Steg (Action Items)

### Omedelbart (vecka 1-2)

1. ✅ **Kontakta Brasri AB**
   - Email: corentin@brasri.com
   - Boka möte för att diskutera samarbete
   - Presentera Winefeed-konceptet

2. ✅ **Utarbeta samarbetsavtal**
   - Definiera ansvarsfördelning
   - Prissättning och provision
   - SLA (service-level agreement)

### Kort sikt (månad 1)

3. ✅ **Definiera integration**
   - API eller email-baserat?
   - Dataformat (se exempel ovan)
   - Webhook för status updates

4. ✅ **Implementera i plattformen**
   - Integrationslager mot importör
   - Dokumentgenerering
   - Status-tracking

5. ✅ **Pilotrestauranger**
   - Rekrytera 3-5 restauranger
   - Onboarding och utbildning
   - Förbered för första orders

### Medellång sikt (månad 2-3)

6. ✅ **Genomför pilot**
   - 10-20 orders
   - Samla feedback från restauranger och importör
   - Iterera på process och UX

7. ✅ **Dokumentera learnings**
   - Vad fungerade bra?
   - Var uppstod problem?
   - Hur kan vi förbättra?

---

**Skapad:** 2026-01-14
**Senast uppdaterad:** 2026-01-14
**Baserat på:** Användarens förtydligande av affärsmodell
