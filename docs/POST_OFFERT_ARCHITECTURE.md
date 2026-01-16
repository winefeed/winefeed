# Winefeed Post-Offert Arkitektur

**Version:** 1.0
**Status:** Konceptuell design
**Syfte:** Modellera Winefeeds roll som intelligent mellanhand i köpprocessen efter offertacceptans

---

## Översikt

Winefeed ska fungera som en B2B-plattform som automatiserar hela köpprocessen från offertacceptans till leverans, samtidigt som vi abstraherar bort komplexitet kring alkoholhandel, logistik och regelefterlevnad.

### Kärnprinciper

1. **Winefeed säljer inte vin** - Vi är teknisk och administrativ mellanhand
2. **Licensierade aktörer behåller ansvar** - Leverantörer och importörer har det juridiska ansvaret
3. **Modularitet** - Varje komponent ska kunna byggas och integreras stegvis
4. **Transparens** - Restauranger ska alltid veta vad som händer och varför

**⚠️ VIKTIGT: Regelefterlevnad via Licensierad Importörpartner**

**Rekommenderad modell för MVP och skalning:**

Winefeed fungerar som **teknisk och administrativ mellanhand**, inte som vinhandlare eller importör. All regelefterlevnad hanteras av en **licensierad importörpartner**.

**Rollfördelning:**
- **Restaurang:** Köpare av vinet
- **Winefeed:** Koordinator (plattform, orderflöde, dokumentation)
- **Licensierad Importör:** Compliance-partner (alkoholskatt, EMCS, licenser, transport)
- **EU-Producent:** Säljare (skickar direkt till restaurang)

**Fördelar:**
- ✅ Ingen licensiering krävs för Winefeed
- ✅ Ingen initial investering (300-500k SEK sparas)
- ✅ Snabbare time-to-market (veckor istället för månader)
- ✅ Inget juridiskt ansvar för alkoholregler
- ✅ Kan skala med flera partners för olika regioner

**Fullständig dokumentation:**
- [compliance/compliance-model-via-partner.md](./compliance/compliance-model-via-partner.md) ⭐ **PRIMÄR MODELL**
- [compliance/eu-import-direct-delivery.md](./compliance/eu-import-direct-delivery.md) (Om egen licensiering senare)

---

## Systemroller

### 1. Restaurang (Köpare)
- Accepterar offertförslag
- Godkänner beställning och betalning
- Tar emot leverans
- Får dokumentation för bokföring

### 2. Winefeed (Mellanhand)
- Samordnar hela processen
- Hanterar kommunikation mellan parter
- Faciliterar betalning (escrow/split payment)
- Beräknar skatter och avgifter
- Genererar dokumentation
- Spårar leveranser

### 3. Leverantör/Importör (Säljare)
- Bekräftar tillgänglighet och pris
- Fullgör ordern
- Ordnar frakt (eller delegerar till logistikpartner)
- Levererar underlag för skatt och dokumentation

### 4. Betalningspartner
- Hanterar transaktioner
- Möjliggör escrow/split payment
- Säkerställer PCI DSS-compliance

### 5. Logistikpartner
- Hanterar transport
- Ger spårningsinformation
- Bekräftar leverans

### 6. Skattemyndigheter
- Mottar rapportering för moms och punktskatt
- Får underlag för gränsöverskridande handel

---

## Processflöde (6 steg)

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. OFFERT ACCEPTERAS                          │
│  Restaurangen väljer vinförslag → Köpintention skapas            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  2. LEVERANTÖRSKONTAKT                           │
│  Winefeed skickar order till leverantör → Bekräftelse mottages   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 3. BESTÄLLNING & BETALNING                       │
│  Order skapas → Betalning initieras → Escrow/split payment       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   4. LOGISTIK & LEVERANS                         │
│  Frakt bokas → Spårning aktiveras → Leverans till restaurang     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               5. SKATT & REGELEFTERLEVNAD                        │
│  Moms/punktskatt beräknas → Underlag genereras → Rapporteras     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     6. EFTERLEVERANS                             │
│  Orderhistorik sparas → Dokument tillgängliga → Export möjlig    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Teknisk Arkitektur

### Kärnkomponenter

#### Order Management System (OMS)
- Hanterar orderlivscykel från offert till leverans
- Statushantering och händelseloggning
- Integrationer mot leverantörs-API:er

#### Payment Orchestration Layer
- Abstraherar betalningspartners (Worldline, Stripe, Klarna)
- Hanterar escrow och split payment
- PCI DSS-compliance via tokenisering

#### Logistics Integration Layer
- Integrerar mot DHL, VinLog, Schenker, etc.
- Hanterar bokningar och spårning
- Leveransbekräftelser och avvikelsehantering

#### Tax & Compliance Engine
- Beräknar moms (SE: 25%, varierar per land)
- Beräknar punktskatt (alkoholskatt)
- Hanterar VIES-kontroller för EU-handel
- Genererar skatteunderlag

#### Document Generation Service
- Skapar fakturor
- Genererar fraktsedlar
- Producerar skattedeklarationsunderlag
- Exporterar till bokföringssystem (Fortnox, Visma)

---

## Dataflöden

### Steg 1: Offert → Order

```
Restaurang accepterar offert
    ↓
Order Intent skapas (status: PENDING)
    ↓
Skickar till Leverantörskö (message queue)
```

### Steg 2: Leverantörsbekräftelse

```
Leverantör tar emot order via API/email
    ↓
Bekräftar: tillgänglighet, pris, leveranstid
    ↓
Order status: CONFIRMED eller REJECTED
    ↓
Notification skickas till restaurang
```

### Steg 3: Betalning

```
Order status: CONFIRMED
    ↓
Payment Intent skapas hos betalningspartner
    ↓
Restaurang får betalningslänk/widget
    ↓
Betalning genomförs → Medel hålls i escrow
    ↓
Order status: PAID
```

### Steg 4: Leverans

```
Order status: PAID
    ↓
Leverantör förbereder leverans
    ↓
Frakt bokas via Logistics API
    ↓
Tracking ID sparas på order
    ↓
Order status: SHIPPED
    ↓
Leverans slutförs
    ↓
Order status: DELIVERED
    ↓
Escrow-medel frigörs till leverantör
```

### Steg 5: Skatt och Efterlevnad

```
Order status: DELIVERED
    ↓
Tax Engine beräknar:
  - Moms (inkl/exkl)
  - Punktskatt (alkoholvolym × skattesats)
  - Importavgifter (om internationell)
    ↓
Skatteunderlag genereras
    ↓
Sparas för rapportering
```

### Steg 6: Dokumentation

```
Order slutförd
    ↓
Faktura genereras (PDF)
Fraktsedel arkiveras
Skatteunderlag sparas
    ↓
Tillgängliga i restaurangens portal
    ↓
Kan exporteras till bokföringssystem
```

---

## Integrationer

### Externa partners (exempel)

| Kategori | Partner | Funktion | API-typ |
|----------|---------|----------|---------|
| Betalning | Worldline | Card payments, escrow | REST API |
| Betalning | Stripe | Alternative payments | REST API + webhooks |
| Betalning | Klarna | B2B fakturaköp | REST API |
| Logistik | DHL | Freight, tracking | REST API |
| Logistik | VinLog | Specialiserad vintransport | REST/SOAP API |
| Skattemyndighet | Skatteverket | Momsrapportering | SFTP/API |
| Bokföring | Fortnox | Verifikationer, fakturor | REST API + OAuth |
| Bokföring | Visma eEkonomi | Samma som ovan | REST API + OAuth |
| Leverantör | Egna API:er | Order, lager, priser | REST/webhook |

---

## Säkerhet och Compliance

### PCI DSS
- Inga kortuppgifter sparas i Winefeed
- Tokenisering via betalningspartner
- Årlig compliance-audit

### GDPR
- Personuppgifter krypteras i vila
- Tydliga databehandlingsavtal (DPA)
- Rätt till radering och dataportabilitet

### Alkohollagstiftning
- Säkerställ att endast licensierade aktörer säljer
- Verifiering av restaurangers serveringstillstånd
- Dokumentation för Folkhälsomyndigheten

### Bokföringslagen
- 7 års arkivering av transaktioner
- Verifikationskedja från order till betalning
- Revision trail

---

## Framtida utbyggnad

### Fas 1: MVP (Q2 2026)
- Manuell leverantörskontakt (email)
- Betalning via Stripe
- Grundläggande skatteberäkning (svensk moms)
- PDF-fakturor

### Fas 2: Automation (Q3-Q4 2026)
- API-integrationer mot 3 stora leverantörer
- DHL-integration för spårning
- Automatisk momsrapportering
- Fortnox-export

### Fas 3: Full platform (2027)
- Escrow och split payment
- Multi-carrier logistik
- Gränsöverskridande handel (EU)
- ML-baserad prognostisering

---

## Kostnadsmodell

### Möjliga intäktsströmmar

1. **Provision per order** (t.ex. 3-5% av ordervärde)
2. **Fast avgift per order** (t.ex. 50-100 kr)
3. **Månadsprenumeration** för restauranger (plattformsavgift)
4. **Premium-funktioner** (prioriterad leverans, utökad analys)

### Kostnadsposter

- Betalningsavgifter (1,5-3% + fast avgift)
- Fraktkostnader (kan läggas på restaurang eller leverantör)
- API-kostnader (Fortnox, Skatteverket, etc.)
- Drift och underhåll

---

## Juridiska överväganden

### Avtalsstruktur

1. **Restaurang ↔ Winefeed**: Plattformsavtal
2. **Winefeed ↔ Leverantör**: Förmedlingsavtal
3. **Restaurang ↔ Leverantör**: Köpeavtal (via Winefeed)

### Ansvarsfördelning

- **Produktansvar**: Ligger hos leverantör
- **Alkohollicens**: Leverantör och restaurang
- **Leveransansvar**: Logistikpartner (via leverantör eller Winefeed)
- **Betalningsansvar**: Winefeed som förmedlare

---

## Risker och mitigering

| Risk | Sannolikhet | Påverkan | Mitigering |
|------|-------------|----------|------------|
| Leverantör inte kan leverera | Medel | Hög | Alternativleverantörer, tydlig SLA |
| Betalning misslyckas | Låg | Medel | Retry-logik, alternativa metoder |
| Frakt försenas/skadar vin | Medel | Medel | Försäkring, kompensationsmodell |
| Skattefel i beräkning | Låg | Hög | Extern revision, automatiska tester |
| GDPR-brott | Låg | Hög | Privacy by design, regelbundna audits |

---

## Datamodell (översikt)

Se detaljerad modellering i:
- `docs/data-models/order-flow.md`
- `docs/data-models/payment-flow.md`
- `docs/data-models/logistics-flow.md`

Kärnentiteter:
- **Order** (order_id, status, timestamps, etc.)
- **OrderItem** (wine_id, quantity, price)
- **Payment** (payment_id, amount, status, method)
- **Shipment** (shipment_id, tracking_number, carrier)
- **TaxCalculation** (moms, punktskatt, underlag)
- **Document** (faktura, fraktsedel, skatteunderlag)

---

## Nästa steg

1. ✅ Skapa detaljerad datamodell
2. ✅ Definiera API-kontrakt för leverantörsintegrationer
3. ✅ Dokumentera skatte- och momshantering
4. ⏳ Prototypa Payment Orchestration Layer
5. ⏳ Designa Order Management System
6. ⏳ Utvärdera betalningspartners (Worldline vs Stripe vs Klarna)
7. ⏳ Kartlägga juridiska krav med jurist

---

## Kontaktpersoner och ansvar

- **Produktägare**: [Markus]
- **Tech Lead**: [TBD]
- **Compliance Officer**: [TBD]
- **Juridisk rådgivare**: [TBD]

---

**Skapad:** 2026-01-14
**Senast uppdaterad:** 2026-01-14
**Nästa review:** TBD
