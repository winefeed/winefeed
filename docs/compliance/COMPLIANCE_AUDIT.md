# Compliance Audit: Winefeed Backend

**Datum:** 2026-01-14
**Syfte:** Identifiera compliance-risker i nuvarande backend och föreslå corrections
**Status:** 🔴 KRITISKA PROBLEM IDENTIFIERADE

---

## Executive Summary

**Huvudproblem:** Nuvarande datamodell gör att Winefeed **kan tolkas som vinhandlare** istället för teknisk mellanhand.

**Kritisk risk:**
- ⚠️ Winefeed kan anses vara part i alkoholhandeln
- ⚠️ Kan göra Winefeed alkoholskattskyldig
- ⚠️ Kan kräva alkohollicens från Skatteverket

**Rekommendation:** 🔴 **Omedelbar redesign av datamodell krävs innan produktion**

---

## Identifierade Problem

### 🔴 PROBLEM 1: Order-entiteten blandar juridiska roller

#### Nuvarande struktur
```sql
CREATE TABLE orders (
  order_id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants,
  supplier_id UUID REFERENCES suppliers,

  -- PROBLEMET: Priser lagras direkt på order
  subtotal_sek DECIMAL(10,2),
  vat_amount_sek DECIMAL(10,2),
  excise_tax_sek DECIMAL(10,2),
  total_sek DECIMAL(10,2),
  ...
);
```

#### Varför detta är problematiskt

1. **Winefeed ser ut att äga transaktionen**
   - Order har både köpare (restaurant) och säljare (supplier)
   - Priser lagras på Winefeeds order-entitet
   - Detta gör Winefeed till **part i köpet**

2. **Punktskatt (excise_tax) på Winefeeds order**
   - Om Winefeed lagrar punktskatt på sin order kan det tolkas som att **Winefeed är skattskyldigt**
   - Skatteverket kan fråga: "Varför har ni punktskatt om ni inte säljer alkohol?"

3. **Ingen separation av tjänsteavgift**
   - Saknar tydlig uppdelning mellan:
     - Vinpris (restaurang betalar till producent)
     - Winefeed's tjänsteavgift (restaurang betalar till Winefeed)

#### Juridisk risk

🔴 **Hög risk:** Skatteverket eller revisorer kan tolka detta som att Winefeed:
- Köper vin från leverantör
- Säljer vin till restaurang
- Är alkoholskattskyldig
- Behöver alkohollicens

---

### 🟡 PROBLEM 2: Saknas explicit modellering av importör

#### Nuvarande struktur
```sql
orders (
  supplier_id UUID  -- Kan vara vem som helst
);
```

#### Varför detta är problematiskt

1. **Ingen distinktion mellan**:
   - Svensk leverantör (direkt försäljning)
   - EU-producent (kräver importör)
   - Importör (ansvarig för compliance)

2. **Saknas obligatoriska fält för EU-import**:
   - Importör-ID (vem är godkänd mottagare?)
   - EMCS-referens (ARC-nummer)
   - Direkt leveransplats-ID

3. **Ingen validering**:
   - Systemet kan skapa orders för EU-vin utan importör
   - Risk att order skapas utan compliance-partner

#### Juridisk risk

🟡 **Medel risk:** Kan leda till att orders skapas som **inte kan fullgöras lagligt** eftersom ingen importör är kopplad.

---

### 🟡 PROBLEM 3: Payment-entiteten blandar vinpris och tjänsteavgift

#### Nuvarande struktur
```sql
CREATE TABLE payments (
  order_id UUID,
  amount_sek DECIMAL(10,2),  -- TOTAL summa
  ...
);
```

#### Varför detta är problematiskt

1. **En enda betalning för allt**:
   - Restaurangen betalar en summa till Winefeed
   - Winefeed verkar ta emot betalning för vin (= försäljning)

2. **Ingen split payment**:
   - Saknas uppdelning:
     - X SEK till producent/importör (för vin)
     - Y SEK till Winefeed (för tjänst)

3. **Momsredovisning blir fel**:
   - Winefeed kan inte visa att de **bara** tar moms på tjänsteavgift
   - Ser ut som Winefeed tar moms på hela beloppet (inklusive vin)

#### Juridisk risk

🟡 **Medel risk:** Skattemässigt kan detta tolkas som att Winefeed **säljer vin**, inte förmedlar kontakt.

---

### 🟡 PROBLEM 4: Saknas "Direkt leveransplats"-modellering

#### Nuvarande struktur
```sql
orders (
  delivery_address_line1 VARCHAR(255),
  delivery_city VARCHAR(100),
  ...
);
```

#### Varför detta är problematiskt

1. **Ingen koppling till Skatteverkets register**:
   - För EU-import måste restaurangen vara registrerad som "Direkt leveransplats"
   - Detta är **inte samma som leveransadress**

2. **Saknas:**
   - EMCS-ID för restaurangen
   - Registreringsstatus hos Skatteverket
   - Serveringstillståndsnummer

3. **Validering saknas**:
   - Systemet kan skapa EU-orders till restauranger som **inte är registrerade**
   - Detta är olagligt enligt Skatteverket

#### Juridisk risk

🟡 **Medel risk:** Orders kan skapas som **bryter mot Skatteverkets krav**.

---

### 🟢 PROBLEM 5: Dokumentation visar inte ansvarsfördelning

#### Nuvarande struktur
- Inga fält för att spåra vem som är juridiskt ansvarig
- Ingen audit trail för compliance-beslut

#### Varför detta är problematiskt

Vid revision eller granskning kan det vara **omöjligt att bevisa** att:
- Importören (inte Winefeed) var ansvarig för punktskatt
- Producenten (inte Winefeed) sålde vinet
- Winefeed bara koordinerade processen

#### Juridisk risk

🟢 **Låg risk** men **hög påverkan** vid revision: Kan inte bevisa att Winefeed är mellanhand.

---

## Sammanfattning av Risker

| Problem | Risk | Påverkan | Prioritet |
|---------|------|----------|-----------|
| Order blandar roller | 🔴 Hög | Winefeed kan krävas alkohollicens | 🔴 KRITISK |
| Punktskatt på Winefeeds order | 🔴 Hög | Winefeed kan bli skattskyldigt | 🔴 KRITISK |
| Payment blandar vinpris och tjänst | 🟡 Medel | Momsfel, tolkas som försäljning | 🟡 Viktigt |
| Saknas importör-modellering | 🟡 Medel | EU-orders kan bli olagliga | 🟡 Viktigt |
| Saknas direktleveransplats | 🟡 Medel | Bryter mot Skatteverkets krav | 🟡 Viktigt |
| Dokumentation visar inte ansvar | 🟢 Låg | Svårt att bevisa vid revision | 🟢 Önskvärt |

---

## Rekommenderad Lösning: Tre-lagers Arkitektur

### Arkitekturprincip

```
┌─────────────────────────────────────────────────────────────┐
│                    TRE-LAGERS MODELL                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  LAGER 1: CommercialIntent (Winefeed äger)                  │
│  ├─ Restaurangens köpintention                               │
│  ├─ Accepterad offert                                        │
│  ├─ Winefeeds tjänsteavgift                                  │
│  └─ Status: Intent-nivå                                      │
│                                                               │
│  LAGER 2: SupplierOrder (Referens, äger EJ)                 │
│  ├─ Order till producent/importör                            │
│  ├─ Producent/importörs priser                               │
│  ├─ Punktskatt (importörens ansvar)                          │
│  └─ Status: Supplier-nivå                                    │
│                                                               │
│  LAGER 3: Fulfillment (Referens, äger EJ)                   │
│  ├─ EMCS-dokumentation                                       │
│  ├─ Transport och leverans                                   │
│  ├─ Direktleveransplats                                      │
│  └─ Status: Compliance-nivå                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Varför detta löser problemen

1. **Tydlig separation av ansvar**
   - Winefeed äger bara Layer 1 (Commercial Intent)
   - Layer 2 och 3 är **referenser** till partner-data

2. **Juridiskt defensivt**
   - Punktskatt lagras INTE på Winefeeds entiteter
   - Priser separerade: vinpris (på SupplierOrder) vs tjänsteavgift (på CommercialIntent)

3. **Compliance-by-design**
   - Importör är obligatoriskt för EU-orders
   - Direktleveransplats är obligatoriskt
   - EMCS-data lagras explicit

---

## Detaljerad Ny Datamodell

Se separat dokument:
**[compliance-by-design-datamodel.md](./compliance-by-design-datamodel.md)**

---

## Action Items

### 🔴 KRITISKT (innan produktion)

1. ✅ Implementera tre-lagers arkitektur
2. ✅ Separera vinpris från Winefeeds tjänsteavgift
3. ✅ Ta bort punktskatt från Winefeeds order-entitet
4. ✅ Lägg till obligatorisk importör-referens för EU-orders

### 🟡 VIKTIGT (innan skalning)

5. ✅ Implementera direktleveransplats-modellering
6. ✅ Lägg till EMCS-referenskoppling
7. ✅ Skapa split payment-arkitektur
8. ✅ Dokumentera ansvarsfördelning i audit trail

### 🟢 ÖNSKVÄRT (kontinuerlig förbättring)

9. ⏳ Automatisk validering av compliance-krav
10. ⏳ Generera compliance-rapporter automatiskt
11. ⏳ Integrera med Skatteverkets API (när tillgängligt)

---

## Juridisk Review Checklist

Innan produktion, verifiera att:

- [ ] Winefeed **aldrig** står som köpare eller säljare av vin
- [ ] Punktskatt **aldrig** lagras på Winefeeds entiteter
- [ ] Betalningar är **separerade** (vin vs tjänst)
- [ ] Importör är **obligatoriskt** för EU-orders
- [ ] Direktleveransplats är **obligatoriskt** för EU-leveranser
- [ ] EMCS-referenser är **kopplade** till alla EU-orders
- [ ] Dokumentation visar **tydlig ansvarsfördelning**
- [ ] Juridisk rådgivare har **godkänt** datamodellen

---

## Slutsats

**Nuvarande backend-arkitektur är EJ compliance-säker.**

Omedelbar redesign enligt tre-lagers modellen krävs för att:
- ✅ Säkerställa att Winefeed är mellanhand, inte vinhandlare
- ✅ Undvika alkoholskattskyldighet
- ✅ Möjliggöra dialog med Skatteverket
- ✅ Skydda mot juridiska risker

**Nästa steg:** Implementera [compliance-by-design-datamodel.md](./compliance-by-design-datamodel.md)

---

**Skapad:** 2026-01-14
**Granskad av:** [Jurist TBD]
**Nästa review:** Innan produktion
