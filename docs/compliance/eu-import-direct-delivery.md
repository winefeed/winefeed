# EU-Import och Direktleveranser

**Syfte:** Dokumentera regler och krav för direktleverans från EU-leverantörer till svenska restauranger

**Baserat på:** Skatteverkets svar (ID:25MBSKV892314, 2025-10-31)

---

## Översikt

När Winefeed ska möjliggöra att restauranger beställer vin direkt från EU-leverantörer (t.ex. vingårdar i Frankrike, Italien, Spanien) som sedan skickas direkt till restaurangen i Sverige, finns det särskilda krav från Skatteverket.

### Två huvudscenarier

1. **Winefeed som importör** - Vi organiserar importen och hanterar punktskatten
2. **Restaurang som köpare** - Restaurangen köper direkt, vi tillhandahåller importtjänster

I **båda fallen** krävs att Winefeed är en **godkänd aktör** hos Skatteverket.

---

## Scenario 1: Winefeed som Importör (Rekommenderat)

### Flöde

```
Restaurang                Winefeed                  EU-Leverantör
    │                         │                           │
    │  Beställer vin          │                           │
    │────────────────────────>│                           │
    │                         │  Beställer från leverantör│
    │                         │──────────────────────────>│
    │                         │                           │
    │                         │  Vinet skickas            │
    │                         │  (under uppskov via EMCS) │
    │                         │<──────────────────────────│
    │                         │  ↓ Direkt till restaurang │
    │  Vinet levereras        │                           │
    │<────────────────────────│                           │
    │                         │                           │
    │                         │  Winefeed betalar:        │
    │                         │  - Punktskatt             │
    │                         │  - Moms                   │
    │                         │                           │
```

### Juridisk struktur

- **Köpare:** Restaurangen köper från Winefeed
- **Säljare:** Winefeed säljer till restaurangen
- **Importör:** Winefeed organiserar import och betalar punktskatt
- **Leverans:** Direkt från EU-leverantör till restaurang

### Krav från Skatteverket

#### 1. Winefeed måste vara "godkänd aktör"

**Definition:** Godkänd aktör = registrerad hos Skatteverket för att hantera alkoholprodukter under uppskov

**Registrering:**
- Ansök om registrering som "Godkänd mottagare" (kod 5369_01)
- Beviljad av Skatteverket efter prövning
- Kräver säkerhet (borgen) beroende på volym

#### 2. Restaurangen måste registreras som "Direkt leveransplats"

**Från Skatteverkets svar:**
> "Ja - det måste du göra om du vill att vingården ska kunna skicka varorna under uppskov."

**Registrering:**
- Kod: **5369_03_Direkt_Leveransplats**
- Winefeed anmäler restaurangen hos Skatteverket
- Restaurangen måste ha giltigt serveringstillstånd

#### 3. EMCS-dokument måste följa leveransen

**EMCS (Excise Movement and Control System):**
- EU:s elektroniska system för att spåra alkohol under uppskov
- Vingården (EU-leverantör) skapar ett **e-AD** (elektroniskt följedokument)
- **ARC-nummer** (Administrative Reference Code) följer leveransen
- Exempel: `FR12AB34567890123456`

**När vinet anländer till Sverige:**
- Winefeed (som godkänd mottagare) bekräftar mottagandet i EMCS
- Punktskatten förfaller till betalning
- Winefeed deklarerar och betalar punktskatten till Skatteverket

---

## Scenario 2: Restaurang som Köpare (Mindre vanligt)

### Flöde

```
Restaurang                Winefeed                  EU-Leverantör
    │                         │                           │
    │  Betalar vingård direkt │                           │
    │────────────────────────────────────────────────────>│
    │  (reservationsavgift)   │                           │
    │                         │                           │
    │  Anlitar Winefeed för   │                           │
    │  importtjänster         │                           │
    │────────────────────────>│                           │
    │                         │  Organiserar transport    │
    │                         │  + tullklarering          │
    │                         │<──────────────────────────│
    │                         │  ↓ Direkt till restaurang │
    │  Vinet levereras        │                           │
    │<────────────────────────│                           │
    │                         │                           │
    │  Restaurangen betalar:  │                           │
    │  - Punktskatt           │                           │
    │  - Moms                 │                           │
    │  - Importtjänst (till Winefeed)                     │
```

### Från Skatteverkets svar

> "Ja - det spelar ingen roll om restaurangen står som köpare - däremot måste varorna skickas mellan godkända aktörer, dvs mellan vingården och dig och då under förutsättning att du har anmält restaurangen som en direkt leveransplats."

### Tolkning

- **Även om restaurangen är köpare**, måste Winefeed fortfarande vara godkänd aktör
- **Samma krav gäller:**
  - Winefeed registrerad som godkänd mottagare
  - Restaurangen registrerad som direkt leveransplats
  - EMCS-dokument

### Skatteansvar

**Restaurangen ansvarar för:**
- Punktskatt (deklareras och betalas av restaurangen)
- Moms (restaurangen redovisar moms)

**Winefeed:**
- Tillhandahåller importtjänst (fakturerar service fee)
- Hanterar EMCS-dokument och tullklarering
- Ingen punktskatt eller moms (dessa är restaurangens ansvar)

**Problem med detta scenario:**
- Restauranger är **inte vana** att deklarera punktskatt
- Kräver att restaurangen är **momsregistrerad** och har kunskap om alkoholskatt
- **Komplicerat för restaurangen** → mindre attraktivt

**Rekommendation:** Använd **Scenario 1** (Winefeed som importör) för enklare kundupplevelse.

---

## Registrering som Godkänd Aktör

### Steg för att bli godkänd mottagare

#### 1. Ansökan till Skatteverket

**Blankett:** SKV 5369 - Ansökan om godkännande för befordran av alkoholvaror under uppskov

**Information som krävs:**
- Organisationsnummer (Winefeed AB)
- Ansvarig person
- Beskrivning av verksamheten
- Uppskattad årlig volym (liter ren alkohol)
- Säkerhet (borgen eller bankgaranti)

**Säkerhet:**
- Belopp beror på volym
- Exempel: 100,000 liter vin/år → ca 300,000 kr säkerhet
- Kan vara bankgaranti eller borgen från försäkringsbolag

#### 2. Besiktning (eventuellt)

Skatteverket kan begära inspektion av lokaler där alkohol hanteras. För Winefeed (som inte lagrar, bara förmedlar direktleverans) kan detta ev. undvikas.

#### 3. Godkännande

Skatteverket beslutar om godkännande. Handläggningstid: 2-6 månader.

#### 4. EMCS-access

Efter godkännande får Winefeed tillgång till EMCS-systemet via Skatteverkets e-tjänster.

---

## Registrering av Restauranger som Direktleveransplatser

### Process

#### 1. Restaurang måste ha serveringstillstånd

Kontrollera att restaurangen har giltigt serveringstillstånd för alkohol från kommunen.

#### 2. Anmälan till Skatteverket

Winefeed anmäler restaurangen som direkt leveransplats via EMCS-systemet.

**Information som krävs:**
- Restaurangens organisationsnummer
- Adress (leveransadress)
- Kontaktperson
- Kopie av serveringstillstånd

#### 3. Godkännande

Skatteverket bekräftar registreringen. Restaurangen får ett **EMCS-ID** som används vid leveranser.

---

## EMCS-flöde (detaljerat)

### Innan leverans

```
EU-Leverantör (t.ex. vingård i Frankrike)
    │
    │  1. Skapar e-AD (elektroniskt följedokument) i EMCS
    │     - ARC-nummer genereras (t.ex. FR12AB34567890123456)
    │     - Mottagare: Winefeed (godkänd mottagare)
    │     - Leveransplats: Restaurang X (direktleveransplats)
    │     - Produkt: Vin, 50 liter, 13% alkohol
    │
    ↓  e-AD skickas elektroniskt till svenska EMCS
    │
Skatteverket (Sverige)
    │
    │  2. Winefeed får notifikation i EMCS
    │     - Kan se att en leverans är på väg
    │     - ARC-nummer: FR12AB34567890123456
    │
    ↓  Leveransen skickas fysiskt
    │
Restaurang (direktleveransplats)
    │
    │  3. Vinet anländer till restaurang
    │     - ARC-nummer finns på fraktsedel
    │     - Restaurang kvitterar mottagande
    │
    ↓  Winefeed bekräftar i EMCS
    │
Winefeed
    │
    │  4. Bekräftar mottagande i EMCS (inom 5 arbetsdagar)
    │     - Rapporterar faktisk mängd mottagen
    │     - Eventuella avvikelser (skadade flaskor, etc.)
    │
    ↓  Punktskatten förfaller
    │
Skatteverket
    │
    │  5. Skickar underlag för punktskattedeklaration
    │     - Winefeed deklarerar och betalar punktskatt
    │     - Deadline: Senast den 15:e i månaden efter leverans
```

---

## Punktskattedeklaration för EU-import

### Exempel: 50 liter vin (13% alkohol)

#### Beräkning

```typescript
const wine_liters = 50;
const alcohol_percentage = 13;
const pure_alcohol_liters = wine_liters * (alcohol_percentage / 100);
// pure_alcohol_liters = 6.5 liter ren alkohol

const tax_rate_per_liter = 2927; // SEK (för vin 2,25-15%)
const excise_tax = pure_alcohol_liters * tax_rate_per_liter;
// excise_tax = 6.5 × 2927 = 19,025.50 SEK
```

#### Deklaration

Winefeed deklarerar i Skatteverkets e-tjänst:
- **ARC-nummer:** FR12AB34567890123456
- **Produkt:** Vin
- **Volym:** 50 liter
- **Alkoholhalt:** 13%
- **Ren alkohol:** 6.5 liter
- **Punktskatt:** 19,025.50 SEK

**Betalning:** Senast den 15:e i månaden efter leverans

---

## Kostnader och Avgifter

### Initial setup

| Post | Kostnad | Engångskostnad |
|------|---------|----------------|
| Ansökan till Skatteverket | Gratis | Ja |
| Säkerhet (borgen/bankgaranti) | 300,000 - 500,000 kr | Ja (returneras vid upphörande) |
| Juridisk rådgivning | 20,000 - 50,000 kr | Ja |
| EMCS-systemintegration | 50,000 - 100,000 kr | Ja |
| **Total initial kostnad** | **70,000 - 150,000 kr** + säkerhet | |

### Löpande kostnader

| Post | Kostnad | Frekvens |
|------|---------|----------|
| EMCS-systemavgift | Ca 500 kr/månad | Månatlig |
| Punktskattedeklaration | Ingår (egen tid) | Månatlig |
| Årlig förnyelse av säkerhet | Ca 1-2% av säkerhet | Årlig |
| Compliance-konsult (vid behov) | 5,000 - 10,000 kr | Vid behov |

---

## Affärsmodell med EU-import

### Intäkter

**Per order:**
- Vinpris från leverantör: 8,000 kr
- Winefeed markup: 15% → 1,200 kr
- Punktskatt: 2,000 kr (Winefeed betalar, faktureras till restaurang)
- Frakt: 500 kr
- **Total till restaurang:** 11,700 kr (exkl. moms)
- **Moms (25%):** 2,925 kr
- **Total inkl. moms:** 14,625 kr

**Winefeed intäkt:** 1,200 kr per order

### Kostnadstäckning

För att täcka initial investering på 100,000 kr (exkl. säkerhet):
- Behöver: 100,000 / 1,200 = **~84 orders**

Med 10 orders/månad → Breakeven efter **~8 månader**

---

## Alternativ: Samarbete med befintlig importör

Om initial investering och komplexitet är för hög, kan Winefeed **samarbeta med en befintlig licensierad importör**.

### Modell

```
Restaurang → Winefeed → Licensierad Importör → EU-Leverantör
            (plattform)  (hanterar EMCS, punktskatt)
```

**Fördelar:**
- Ingen egen licensiering behövs
- Snabbare time-to-market
- Lägre initial kostnad

**Nackdelar:**
- Mindre kontroll
- Lägre marginal (importören tar en del)
- Beroende av partner

---

## Rekommendation för Winefeed

### Fas 1 (MVP): Samarbete

**Strategi:** Samarbeta med 1-2 licensierade importörer för EU-import

**Fördelar:**
- Minimal initial investering
- Testa marknaden
- Lär oss processen

### Fas 2 (Skalning): Egen licensiering

**När:**
- Volym >100 orders/månad från EU
- Bevisat produktmarknadsfit
- Kapital för initial investering

**Fördelar:**
- Full kontroll
- Högre marginaler
- Möjlighet att differentiera

---

## Datamodell för EU-Import

### Tabell: eu_imports

```sql
CREATE TABLE eu_imports (
  import_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id),

  -- EMCS
  arc_number VARCHAR(50) UNIQUE NOT NULL, -- t.ex. FR12AB34567890123456
  ead_reference VARCHAR(100), -- e-AD referens
  emcs_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING → IN_TRANSIT → DELIVERED → REPORTED → COMPLETED

  -- Leverantör (EU)
  supplier_country_code CHAR(2) NOT NULL, -- FR, IT, ES, etc.
  supplier_emcs_id VARCHAR(50),
  supplier_name VARCHAR(255),

  -- Produkt
  product_type VARCHAR(20) DEFAULT 'WINE',
  total_liters DECIMAL(10,2) NOT NULL,
  alcohol_percentage DECIMAL(4,2) NOT NULL,
  pure_alcohol_liters DECIMAL(10,4) NOT NULL,

  -- Punktskatt
  excise_tax_rate_per_liter DECIMAL(10,2) NOT NULL,
  excise_tax_total_sek DECIMAL(10,2) NOT NULL,
  excise_tax_declared_at TIMESTAMPTZ,
  excise_tax_paid_at TIMESTAMPTZ,

  -- Direktleveransplats
  direct_delivery_place_id VARCHAR(50), -- Restaurangens EMCS-ID
  direct_delivery_address TEXT,

  -- Tidsstämplar
  dispatch_date TIMESTAMPTZ,
  expected_arrival_date DATE,
  actual_arrival_date TIMESTAMPTZ,
  reported_to_skatteverket_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eu_imports_order ON eu_imports(order_id);
CREATE INDEX idx_eu_imports_arc ON eu_imports(arc_number);
CREATE INDEX idx_eu_imports_status ON eu_imports(emcs_status);
```

---

## Nästa steg

### Kortsiktigt (Fas 1 - MVP)

1. ✅ Identifiera 2-3 licensierade importörer för samarbete
2. ✅ Förhandla provisionsstruktur
3. ✅ Integrera deras katalog i Winefeed-plattformen
4. ✅ Testa med 5-10 pilotorders

### Långsiktigt (Fas 2 - Skalning)

1. ⏳ Ansök om godkännande som "Godkänd mottagare"
2. ⏳ Ordna säkerhet (borgen/bankgaranti)
3. ⏳ Implementera EMCS-integration
4. ⏳ Bygga intern kompetens för punktskattedeklaration
5. ⏳ Registrera första restauranger som direktleveransplatser
6. ⏳ Pilot med 1-2 franska vingårdar

---

## Juridisk Review Checklist

- [ ] Konsulterat alkoholskattejurist
- [ ] Kontaktat Skatteverket för rådgivningsmöte
- [ ] Verifierat tolkningar med jurist
- [ ] Klargjort ansvarsfördelning
- [ ] Dokumenterat samtliga krav
- [ ] Planerat för compliance-audit

---

**Källa:** Skatteverket, ID:25MBSKV892314, 2025-10-31
**Kontaktperson Skatteverket:** Susanne Widén, 010-5787166

**Skapad:** 2026-01-14
**Senast uppdaterad:** 2026-01-14
