# Skatt och Regelefterlevnad

**Syfte:** Dokumentera skatteregler, beräkningar och compliance-krav för alkoholhandel

---

## Översikt

Alkoholhandel i Sverige regleras av:
1. **Alkohollagen (2010:1622)** - Licensiering och handel
2. **Alkoholskattelagen (1994:1564)** - Punktskatt på alkohol
3. **Mervärdesskattelagen (1994:200)** - Moms
4. **EU-direktiv 92/83/EEG** - Harmoniserad punktskatt inom EU

### Viktiga principer

- ✅ Endast **licensierade aktörer** får sälja alkohol
- ✅ **Restauranger måste ha serveringstillstånd** för att köpa alkohol
- ✅ **Winefeed är förmedlare**, inte säljare - vi hanterar inga alkohollicenser
- ✅ Alla transaktioner måste **dokumenteras** för Skatteverket

---

## 1. Moms (Mervärdesskatt)

### Grundregler

**Standard momssats i Sverige:** 25%

#### Vad gäller för vin:
- Vin beskattas med **25% moms** (standardsats)
- Momsen är på **hela priset** inklusive punktskatt
- Moms beräknas på: Inköpspris + Punktskatt + Frakt

### Momsberäkning

```typescript
export function calculateVAT(
  subtotal_excl_vat: number,
  excise_tax: number,
  shipping_cost_excl_vat: number,
  vat_rate: number = 25
): {
  vat_base: number;
  vat_amount: number;
  total_incl_vat: number;
} {
  // Momsbas = Inköpspris + Punktskatt + Frakt (exkl. moms)
  const vat_base = subtotal_excl_vat + excise_tax + shipping_cost_excl_vat;

  // Momsbelopp
  const vat_amount = vat_base * (vat_rate / 100);

  // Totalt inkl. moms
  const total_incl_vat = vat_base + vat_amount;

  return {
    vat_base: Math.round(vat_base * 100) / 100,
    vat_amount: Math.round(vat_amount * 100) / 100,
    total_incl_vat: Math.round(total_incl_vat * 100) / 100,
  };
}

// Exempel
const result = calculateVAT(
  8000, // Inköpspris exkl. moms: 8,000 kr
  2000, // Punktskatt: 2,000 kr
  300,  // Frakt exkl. moms: 300 kr
  25    // Moms: 25%
);
// result = {
//   vat_base: 10300,
//   vat_amount: 2575,
//   total_incl_vat: 12875
// }
```

### Omvänd skattskyldighet (Reverse Charge)

För **gränsöverskridande handel inom EU** kan omvänd skattskyldighet gälla:
- Säljaren (leverantör i annat EU-land) tar **0% moms**
- Köparen (restaurang i Sverige) **själv beräknar och betalar moms** till Skatteverket

**Villkor:**
- Både säljare och köpare är **momsregistrerade**
- Säljare har giltigt **VAT-nummer** i sitt land
- Köparen har giltigt **svenskt momsregistreringsnummer**

```typescript
export function shouldApplyReverseCharge(
  supplier_country: string,
  restaurant_country: string,
  supplier_vat_number: string | null,
  restaurant_vat_number: string | null
): boolean {
  // Omvänd skattskyldighet gäller om:
  // 1. Leverantör är i annat EU-land
  // 2. Köpare är i Sverige
  // 3. Båda har VAT-nummer
  const is_cross_border_eu =
    supplier_country !== restaurant_country &&
    isEUCountry(supplier_country) &&
    restaurant_country === 'SE';

  const both_have_vat =
    supplier_vat_number !== null &&
    restaurant_vat_number !== null;

  return is_cross_border_eu && both_have_vat;
}

// Om omvänd skattskyldighet gäller:
// - supplier_vat_rate = 0%
// - restaurant måste rapportera både utgående och ingående moms
```

### VIES-kontroll (VAT Information Exchange System)

För gränsöverskridande handel **måste** VAT-nummer verifieras.

```typescript
export async function verifyVATNumber(
  vat_number: string,
  country_code: string
): Promise<{
  valid: boolean;
  company_name?: string;
  company_address?: string;
}> {
  // EU:s VIES-tjänst
  const response = await fetch(
    `https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode: country_code,
        vatNumber: vat_number.replace(country_code, ''), // Ta bort landskod
      }),
    }
  );

  const result = await response.json();

  return {
    valid: result.valid,
    company_name: result.name,
    company_address: result.address,
  };
}

// Exempel
const vatCheck = await verifyVATNumber('SE556677889901', 'SE');
// vatCheck.valid === true → OK att tillämpa omvänd skattskyldighet
```

---

## 2. Punktskatt (Alkoholskatt)

### Grundregler

Punktskatt på alkohol beror på:
1. **Alkoholvolym** (% alkohol)
2. **Volym** (liter)
3. **Produkttyp** (vin, starkviner, sprit)

### Skattesatser 2026 (Sverige)

| Produkttyp | Alkoholhalt | Skattesats per liter ren alkohol |
|------------|-------------|----------------------------------|
| Vin        | 2,25-15%    | 2 927 kr/liter ren alkohol      |
| Vin        | 15-18%      | 3 907 kr/liter ren alkohol      |
| Starkviner | 18-22%      | 5 861 kr/liter ren alkohol      |
| Sprit      | >22%        | 56 810 kr/liter ren alkohol     |

**Källa:** Skatteverket (2026 års skattetabell)

### Beräkning av punktskatt

```typescript
export function calculateExciseTax(
  alcohol_percentage: number,
  bottle_size_ml: number,
  quantity: number
): {
  tax_rate_per_liter: number;
  pure_alcohol_liters: number;
  total_excise_tax: number;
} {
  // 1. Bestäm skattesats baserat på alkoholhalt
  let tax_rate_per_liter: number;

  if (alcohol_percentage < 2.25) {
    tax_rate_per_liter = 0; // Alkoholfritt
  } else if (alcohol_percentage <= 15) {
    tax_rate_per_liter = 2927; // Vin
  } else if (alcohol_percentage <= 18) {
    tax_rate_per_liter = 3907; // Starkt vin
  } else if (alcohol_percentage <= 22) {
    tax_rate_per_liter = 5861; // Starkviner
  } else {
    tax_rate_per_liter = 56810; // Sprit
  }

  // 2. Beräkna liter ren alkohol
  // Formel: (alkohol% / 100) × (flaskvolym_ml / 1000) × antal_flaskor
  const pure_alcohol_liters =
    (alcohol_percentage / 100) * (bottle_size_ml / 1000) * quantity;

  // 3. Beräkna total punktskatt
  const total_excise_tax = pure_alcohol_liters * tax_rate_per_liter;

  return {
    tax_rate_per_liter: Math.round(tax_rate_per_liter * 100) / 100,
    pure_alcohol_liters: Math.round(pure_alcohol_liters * 10000) / 10000,
    total_excise_tax: Math.round(total_excise_tax * 100) / 100,
  };
}

// Exempel: 20 flaskor vin (13,5%, 750 ml)
const excise = calculateExciseTax(13.5, 750, 20);
// excise = {
//   tax_rate_per_liter: 2927,
//   pure_alcohol_liters: 2.025 (13.5% × 0.75L × 20)
//   total_excise_tax: 5927.18 kr
// }
```

### Punktskatt vid import (EU)

Vid import från annat EU-land:
- Punktskatten **betalas i destinationslandet** (Sverige)
- Varor skickas **punktskattefritt** från ursprungslandet (med EMCS-dokument)
- Importören (eller Winefeed som mellanhand) ansvarar för att deklarera och betala punktskatten

**EMCS (Excise Movement and Control System):**
- Elektroniskt system för spårning av alkohol inom EU
- Kräver auktorisation från Skatteverket
- Varje transport måste ha ett **ARC-nummer** (Administrative Reference Code)

**VIKTIGT FÖR DIREKTLEVERANSER:**

För detaljerad information om EU-import och direktleveranser till restauranger, se:
**[eu-import-direct-delivery.md](./eu-import-direct-delivery.md)**

Nyckelkrav från Skatteverket:
- Winefeed måste vara **"godkänd mottagare"** (registrerad hos Skatteverket)
- Restauranger måste registreras som **"Direkt leveransplatser"** (kod 5369_03)
- EMCS-dokument måste följa varje leverans
- Punktskatten deklareras och betalas av Winefeed (om Winefeed är importör)

```typescript
export interface EMCSDocument {
  arc_number: string; // t.ex. 'SE12AB34567890'
  origin_country: string;
  destination_country: string;
  product_type: 'WINE' | 'FORTIFIED_WINE' | 'SPIRITS';
  total_liters: number;
  pure_alcohol_liters: number;
  excise_tax_suspended: boolean; // true = skatten inte betalad än
  dispatch_date: string;
  expected_arrival_date: string;
}
```

---

## 3. Total skatteberäkning (komplett exempel)

```typescript
export interface TaxCalculationInput {
  items: {
    wine_name: string;
    quantity: number;
    unit_price_excl_vat_sek: number;
    alcohol_percentage: number;
    bottle_size_ml: number;
  }[];
  shipping_cost_excl_vat_sek: number;
  vat_rate: number;
}

export interface TaxCalculationResult {
  // Grundbelopp
  subtotal_excl_vat: number;

  // Punktskatt
  total_pure_alcohol_liters: number;
  total_excise_tax: number;

  // Frakt
  shipping_cost_excl_vat: number;

  // Moms
  vat_base: number;
  vat_amount: number;

  // Totalt
  total_incl_vat: number;

  // Breakdown per rad
  line_items: {
    wine_name: string;
    quantity: number;
    unit_price_excl_vat: number;
    line_subtotal_excl_vat: number;
    excise_tax: number;
    vat_amount: number;
    line_total_incl_vat: number;
  }[];
}

export function calculateTotalTax(
  input: TaxCalculationInput
): TaxCalculationResult {
  let subtotal_excl_vat = 0;
  let total_excise_tax = 0;
  let total_pure_alcohol_liters = 0;

  const line_items = input.items.map((item) => {
    // 1. Subtotal exkl. moms
    const line_subtotal_excl_vat = item.quantity * item.unit_price_excl_vat_sek;
    subtotal_excl_vat += line_subtotal_excl_vat;

    // 2. Punktskatt för denna rad
    const excise = calculateExciseTax(
      item.alcohol_percentage,
      item.bottle_size_ml,
      item.quantity
    );
    total_excise_tax += excise.total_excise_tax;
    total_pure_alcohol_liters += excise.pure_alcohol_liters;

    // 3. Momsbas för denna rad (inköpspris + punktskatt)
    const line_vat_base = line_subtotal_excl_vat + excise.total_excise_tax;

    // 4. Moms för denna rad
    const line_vat_amount = line_vat_base * (input.vat_rate / 100);

    // 5. Totalt för denna rad
    const line_total_incl_vat = line_vat_base + line_vat_amount;

    return {
      wine_name: item.wine_name,
      quantity: item.quantity,
      unit_price_excl_vat: item.unit_price_excl_vat_sek,
      line_subtotal_excl_vat: Math.round(line_subtotal_excl_vat * 100) / 100,
      excise_tax: Math.round(excise.total_excise_tax * 100) / 100,
      vat_amount: Math.round(line_vat_amount * 100) / 100,
      line_total_incl_vat: Math.round(line_total_incl_vat * 100) / 100,
    };
  });

  // Moms på frakt
  const shipping_vat = input.shipping_cost_excl_vat_sek * (input.vat_rate / 100);

  // Total momsbas (varor + punktskatt + frakt exkl. moms)
  const vat_base = subtotal_excl_vat + total_excise_tax + input.shipping_cost_excl_vat_sek;

  // Total moms
  const vat_amount = vat_base * (input.vat_rate / 100);

  // Totalt inkl. allt
  const total_incl_vat = vat_base + vat_amount;

  return {
    subtotal_excl_vat: Math.round(subtotal_excl_vat * 100) / 100,
    total_pure_alcohol_liters: Math.round(total_pure_alcohol_liters * 10000) / 10000,
    total_excise_tax: Math.round(total_excise_tax * 100) / 100,
    shipping_cost_excl_vat: input.shipping_cost_excl_vat_sek,
    vat_base: Math.round(vat_base * 100) / 100,
    vat_amount: Math.round(vat_amount * 100) / 100,
    total_incl_vat: Math.round(total_incl_vat * 100) / 100,
    line_items,
  };
}

// Exempel: Order med 2 viner
const calculation = calculateTotalTax({
  items: [
    {
      wine_name: 'Chianti Classico 2020',
      quantity: 12,
      unit_price_excl_vat_sek: 150,
      alcohol_percentage: 13.5,
      bottle_size_ml: 750,
    },
    {
      wine_name: 'Barolo 2018',
      quantity: 6,
      unit_price_excl_vat_sek: 400,
      alcohol_percentage: 14.0,
      bottle_size_ml: 750,
    },
  ],
  shipping_cost_excl_vat_sek: 300,
  vat_rate: 25,
});

console.log(calculation);
/*
{
  subtotal_excl_vat: 4200,        // 12×150 + 6×400
  total_pure_alcohol_liters: 1.845, // (13.5%×0.75×12) + (14%×0.75×6)
  total_excise_tax: 5400.32,      // 1.845 × 2927
  shipping_cost_excl_vat: 300,
  vat_base: 9900.32,              // 4200 + 5400.32 + 300
  vat_amount: 2475.08,            // 9900.32 × 25%
  total_incl_vat: 12375.40,       // 9900.32 + 2475.08
  line_items: [...]
}
*/
```

---

## 4. Rapportering till Skatteverket

### Momsdeklaration

**Frekvens:** Månadsvis eller kvartalsvis (beroende på omsättning)

**Vad ska rapporteras:**
- **Utgående moms** (försäljning)
- **Ingående moms** (inköp)
- **Nettomoms** = Utgående - Ingående

För Winefeed (förmedlare):
- Vi rapporterar moms på vår **provision** (t.ex. 5% av ordervärde)
- Leverantören rapporterar moms på försäljning till restaurangen
- Restaurangen drar av ingående moms

```typescript
export interface VATReport {
  period_start: string; // '2026-01-01'
  period_end: string;   // '2026-01-31'

  // Utgående moms (försäljning)
  outgoing_vat_base: number;
  outgoing_vat_amount: number;

  // Ingående moms (inköp)
  incoming_vat_base: number;
  incoming_vat_amount: number;

  // Netto
  net_vat_amount: number; // Utgående - Ingående
}

export async function generateMonthlyVATReport(
  year: number,
  month: number
): Promise<VATReport> {
  const period_start = `${year}-${String(month).padStart(2, '0')}-01`;
  const period_end = new Date(year, month, 0).toISOString().split('T')[0];

  // Hämta alla orders för perioden
  const orders = await getOrdersForPeriod(period_start, period_end);

  let outgoing_vat_base = 0;
  let outgoing_vat_amount = 0;

  for (const order of orders) {
    // Winefeed:s provision (t.ex. 5% av ordervärde)
    const commission_rate = 0.05;
    const commission_excl_vat = order.subtotal_sek * commission_rate;
    const commission_vat = commission_excl_vat * 0.25;

    outgoing_vat_base += commission_excl_vat;
    outgoing_vat_amount += commission_vat;
  }

  // Ingående moms (t.ex. på betalningsavgifter, fraktkostnader, etc.)
  const expenses = await getExpensesForPeriod(period_start, period_end);
  let incoming_vat_base = 0;
  let incoming_vat_amount = 0;

  for (const expense of expenses) {
    incoming_vat_base += expense.amount_excl_vat;
    incoming_vat_amount += expense.vat_amount;
  }

  return {
    period_start,
    period_end,
    outgoing_vat_base: Math.round(outgoing_vat_base * 100) / 100,
    outgoing_vat_amount: Math.round(outgoing_vat_amount * 100) / 100,
    incoming_vat_base: Math.round(incoming_vat_base * 100) / 100,
    incoming_vat_amount: Math.round(incoming_vat_amount * 100) / 100,
    net_vat_amount: Math.round((outgoing_vat_amount - incoming_vat_amount) * 100) / 100,
  };
}
```

### Punktskattedeklaration

För leverantörer som importerar vin (om Winefeed skulle bli licensierad):

**Frekvens:** Månadsvis
**System:** Skatteverkets elektroniska tjänst (e-tjänster)

```typescript
export interface ExciseTaxReport {
  period_start: string;
  period_end: string;

  // Per produkttyp
  wine_liters: number;
  wine_pure_alcohol_liters: number;
  wine_excise_tax: number;

  fortified_wine_liters: number;
  fortified_wine_pure_alcohol_liters: number;
  fortified_wine_excise_tax: number;

  // Totalt
  total_excise_tax: number;
}
```

---

## 5. Juridiska krav och licenser

### Alkohollicenser

#### För leverantörer (krävs):
1. **Partihandelsförsäljningstillstånd** - Skatteverket
2. **Serveringstillstånd** (om även servar) - Kommun

#### För restauranger (krävs):
1. **Serveringstillstånd för alkohol** - Kommun
   - Kategori A, B, C eller D beroende på alkoholhalt och serveringsform

#### För Winefeed (krävs INTE):
- Vi behöver **ingen alkohollicens** eftersom vi bara förmedlar kontakt
- Juridiskt ansvar ligger hos leverantör och restaurang

### Verifiering av restaurangers serveringstillstånd

```typescript
export async function verifyServingLicense(
  restaurant_id: string
): Promise<{
  valid: boolean;
  license_number?: string;
  license_type?: 'A' | 'B' | 'C' | 'D';
  expiry_date?: string;
}> {
  // API-anrop till kommunens register (om tillgängligt)
  // Alternativt: manuell verifiering via uppladdad PDF

  const restaurant = await getRestaurant(restaurant_id);

  // Exempel: Stockholms stad har öppen data
  const response = await fetch(
    `https://open.stockholm.se/api/licenses?org_number=${restaurant.org_number}`
  );

  const data = await response.json();

  return {
    valid: data.licenses.length > 0,
    license_number: data.licenses[0]?.number,
    license_type: data.licenses[0]?.type,
    expiry_date: data.licenses[0]?.expiry_date,
  };
}
```

---

## 6. Dokumentation och arkivering

### Bokföringslagen

**Krav:** 7 års arkivering av alla transaktioner

**Dokument som måste sparas:**
1. **Fakturor** (inköp och försäljning)
2. **Fraktsedlar**
3. **Betalningsbekräftelser**
4. **Skatteunderlag** (moms, punktskatt)
5. **Avtal** med leverantörer och restauranger

### Datamodell

```sql
CREATE TABLE tax_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(order_id),

  -- Dokumenttyp
  document_type VARCHAR(50) NOT NULL,
    -- 'INVOICE', 'SHIPPING_LABEL', 'VAT_RECEIPT', 'EXCISE_TAX_DECLARATION'

  -- Fil
  file_url VARCHAR(500) NOT NULL, -- S3/Cloudflare R2
  file_size_bytes INT,
  mime_type VARCHAR(50),

  -- Metadata
  document_date DATE NOT NULL,
  tax_period VARCHAR(7), -- '2026-01' för månad, '2026-Q1' för kvartal

  -- Arkivering
  archived_at TIMESTAMPTZ,
  retention_expires_at DATE, -- 7 år från document_date

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_documents_order ON tax_documents(order_id);
CREATE INDEX idx_tax_documents_type ON tax_documents(document_type);
CREATE INDEX idx_tax_documents_retention ON tax_documents(retention_expires_at);
```

---

## 7. API Integration med Skatteverket (framtida)

Skatteverket planerar API:er för e-deklaration och VIES-kontroller.

### Momsdeklaration via API

```typescript
export async function submitVATDeclaration(report: VATReport) {
  // Framtida: API till Skatteverket
  const response = await fetch('https://api.skatteverket.se/vat/declarations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SKATTEVERKET_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      period_start: report.period_start,
      period_end: report.period_end,
      outgoing_vat: report.outgoing_vat_amount,
      incoming_vat: report.incoming_vat_amount,
      net_vat: report.net_vat_amount,
      org_number: process.env.WINEFEED_ORG_NUMBER,
    }),
  });

  return response.json();
}
```

---

## Sammanfattning: Winefeed:s ansvar

### Vad Winefeed GÖR:
- ✅ Beräknar korrekt moms och punktskatt
- ✅ Genererar underlag för skattedeklarationer
- ✅ Arkiverar dokument i 7 år
- ✅ Verifierar restaurangers serveringstillstånd
- ✅ Förmedlar betalningar (escrow)
- ✅ Rapporterar moms på egen provision

### Vad Winefeed INTE gör:
- ❌ Säljer alkohol (licensierade leverantörer gör det)
- ❌ Hanterar alkohollicenser
- ❌ Deklarerar punktskatt (leverantörens ansvar)
- ❌ Lagrar alkohol

---

## Nästa steg

1. ✅ Implementera Tax Calculation Engine
2. ⏳ Kontakta Skatteverket för rådgivning
3. ⏳ Sätt upp VIES-integration för VAT-kontroller
4. ⏳ Designa Document Generation Service
5. ⏳ Planera arkiveringslösning (S3/R2 med 7-års retention)
6. ⏳ Konsultera skattejurist för compliance-review

---

**Skapad:** 2026-01-14
**Senast uppdaterad:** 2026-01-14
