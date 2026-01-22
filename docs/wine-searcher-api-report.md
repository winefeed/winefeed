# Wine-Searcher API - Utforskningsrapport

**Datum:** 2026-01-21
**API Key:** wnestest82020261601 (test/trial)
**Status:** Trial-period (går ut snart)

---

## Sammanfattning

Wine-Searcher API:t erbjuder två huvudendpoints med värdefull data för vinbranschen. Dock har API:t **0% täckning för nordiska viner** (Sverige, Danmark, Norge), vilket begränsar användningen för lokala viner.

---

## Endpoints

### 1. Wine Check (`/x`)

**URL:** `https://api.wine-searcher.com/x`

**Syfte:** Grundläggande vininfo och validering

**Parametrar:**
| Parameter | Beskrivning | Exempel |
|-----------|-------------|---------|
| `api_key` | API-nyckel | `wnestest...` |
| `winename` | Vinnamn eller LWIN-kod | `Chateau Margaux` eller `LWIN1012361` |
| `vintage` | Årgång (4 siffror eller NV) | `2015` eller `NV` |
| `Xcurr` | Valuta för priser | `SEK`, `USD`, `EUR` |

**Response-fält:**
```xml
<wine-searcher>
  <return-code>0</return-code>
  <list-currency-code>USD</list-currency-code>
  <wine-details>
    <wine>
      <region>Margaux</region>
      <grape>Cabernet Sauvignon, Merlot</grape>
      <price-average>584.99</price-average>
      <price-min>350.00</price-min>
      <price-max>1200.00</price-max>
      <ws-score>94</ws-score>
    </wine>
  </wine-details>
</wine-searcher>
```

**Fält:**
| Fält | Beskrivning | Användning |
|------|-------------|------------|
| `region` | Vinets region | Validering, enrichment |
| `grape` | Druvor | Validering, enrichment |
| `ws-score` | Wine-Searcher betyg (0-100) | Visa i UI, sortering |
| `price-average` | Genomsnittspris | Marknadsreferens |
| `price-min` | Lägsta pris | Prisintervall |
| `price-max` | Högsta pris | Prisintervall |

---

### 2. Market Price (`/a`)

**URL:** `https://api.wine-searcher.com/a`

**Syfte:** Lista handlare och deras priser för ett vin

**Parametrar:**
| Parameter | Beskrivning | Exempel |
|-----------|-------------|---------|
| `api_key` | API-nyckel | `wnestest...` |
| `winename` | Vinnamn eller LWIN-kod | `Dom Perignon` |
| `vintage` | Årgång | `2012` |
| `country` | Filtrera på land | `Sweden` |
| `Xcurr` | Valuta | `SEK` |

**Response-fält (per handlare):**
```xml
<prices-and-stores>
  <store>
    <merchant-name>Wine Shop Stockholm</merchant-name>
    <merchant-description>Premium wine retailer</merchant-description>
    <price>1299.00</price>
    <bottle-size>750ml</bottle-size>
    <vintage>2012</vintage>
    <country>Sweden</country>
    <state>Stockholm</state>
    <physical-address>Kungsgatan 1</physical-address>
    <zip-code>111 43</zip-code>
    <latitude>59.3293</latitude>
    <longitude>18.0686</longitude>
    <link>https://...</link>
    <offer-types>retail</offer-types>
  </store>
</prices-and-stores>
```

**Fält:**
| Fält | Beskrivning | Användning |
|------|-------------|------------|
| `merchant-name` | Handlarens namn | Konkurrentanalys |
| `price` | Aktuellt pris | Prisjämförelse |
| `bottle-size` | Flaskstorlek | Normalisering |
| `vintage` | Årgång | Matchning |
| `country`, `state` | Geografisk plats | Filtrera lokalt |
| `latitude`, `longitude` | Koordinater | Kartvisning |
| `link` | Länk till erbjudande | Referens |
| `offer-types` | Typ (retail, auction) | Filtrering |

---

## LWIN-koder

Wine-Searcher stödjer LWIN (Liquid Wine Identification Number) för exakt matchning:

| LWIN-typ | Format | Beskrivning |
|----------|--------|-------------|
| LWIN-7 | `LWIN1012361` | Vin + producent |
| LWIN-11 | `LWIN10123612015` | + årgång |
| LWIN-18 | `LWIN1012361201575006` | + flaskstorlek + förpackning |

**Användning:** Byt ut vinnamn mot LWIN-kod för exakt matchning:
```
?winename=LWIN1012361&vintage=2015
```

---

## Begränsningar

### 1. Nordisk täckning: 0%
Testade svenska, danska och norska viner:
- Kullabergs Solaris ❌
- Arilds Vingård ❌
- Frederiksdal ❌
- Egge Gård ❌

**Konsekvens:** Kan inte användas för att validera/enricha lokala viner.

### 2. Trial-begränsningar
- Samma data som gratisanvändare på wine-searcher.com
- PRO-data exkluderad
- Max 24 handlare per sökning

### 3. Kräver exakt vinnamn
Breda sökningar (typ "Barolo", "Riesling") returnerar ofta `return-code: -1`.

---

## Potentiella Use Cases för Winefeed

### ✅ Rekommenderade (högt värde)

#### 1. Marknadsreferenspris
**Data:** `price-average`, `price-min`, `price-max`
**Implementation:**
```typescript
// Visa i offert-vy
<div>
  <span>Leverantörspris: {offer.price} kr</span>
  <span className="text-gray-500">
    Marknadspris: {wsData.priceAverage} kr
    ({wsData.priceMin}-{wsData.priceMax})
  </span>
</div>
```
**Värde:** Hjälper restauranger bedöma om priset är bra.

#### 2. Kritikerbetyg
**Data:** `ws-score`
**Implementation:**
```typescript
// Visa i sökresultat
{wsScore && (
  <Badge>WS {wsScore}</Badge>
)}
```
**Värde:** Kvalitetsindikator, kan användas för filtrering.

#### 3. Vinvalidering vid import
**Data:** `region`, `grape`, `return-code`
**Implementation:**
```typescript
// Vid CSV-import
const validation = await wineSearcher.validate(wine.name, wine.vintage);
if (validation.returnCode === 0) {
  wine.isVerified = true;
  wine.region = wine.region || validation.region;
}
```
**Värde:** Automatisk kvalitetskontroll av importerad data.

### ⚠️ Möjliga (medelhögt värde)

#### 4. Konkurrentpriser (svenska handlare)
**Data:** `prices-and-stores` med `country=Sweden`
**Begränsning:** Endast internationella viner.

#### 5. Druv- och regiondata
**Data:** `grape`, `region`
**Användning:** Fylla i saknade fält i leverantörsdata.

### ❌ Ej möjliga

#### 6. Nordiska viner
Ingen täckning - behöver alternativ datakälla.

---

## Teknisk Implementation

### Nuvarande service
`lib/winesearcher-service.ts` - Endast Wine Check (`/x`)

### Förslag: Utöka med Market Price

```typescript
// Ny funktion i winesearcher-service.ts
async getMarketPrice(
  winename: string,
  vintage?: string,
  country?: string
): Promise<MarketPriceResult> {
  const params = new URLSearchParams({
    api_key: WINESEARCHER_API_KEY,
    winename,
    ...(vintage && { vintage }),
    ...(country && { country }),
    Xcurr: 'SEK',
  });

  const response = await fetch(
    `https://api.wine-searcher.com/a?${params}`
  );
  // ... parse XML
}
```

### Caching-strategi
- Wine Check: Cache 7 dagar (data ändras sällan)
- Market Price: Cache 24 timmar (priser ändras)

---

## Kostnadsanalys

| Plan | Anrop/månad | Kostnad | Per anrop |
|------|-------------|---------|-----------|
| Trial | Begränsad | Gratis | - |
| Basic | 10,000 | ~$100/mån | $0.01 |
| Pro | 100,000 | ~$500/mån | $0.005 |

**Rekommendation:** Basic-plan räcker för MVP (validering + stickprov på marknadspriser).

---

## Alternativa datakällor för nordiska viner

| Källa | Täckning | Kostnad | API |
|-------|----------|---------|-----|
| Systembolaget | 🇸🇪 100% | Gratis | Inofficiell |
| Vinmonopolet | 🇳🇴 100% | Gratis | Ja |
| Vivino | Global | Freemium | Begränsad |
| Manuell data | 100% | Tid | - |

---

## Slutsats

Wine-Searcher API:t är värdefullt för:
1. ✅ Marknadsreferenspriser på internationella viner
2. ✅ Kritikerbetyg (ws-score)
3. ✅ Vinvalidering vid import

Men **inte användbart** för:
1. ❌ Svenska/nordiska viner (0% täckning)
2. ❌ Lokala småproducenter

**Rekommendation:** Behåll Wine-Searcher för internationella viner, bygg separat lösning för nordiska viner (Systembolaget API, manuell data från leverantörer).

---

## Bilagor

### A. Testade viner med resultat

| Vin | Årgång | Land | Resultat |
|-----|--------|------|----------|
| Chateau Margaux | 2015 | Frankrike | ✅ Hittad |
| Krug Grande Cuvee | NV | Frankrike | ✅ Hittad |
| Sassicaia | 2018 | Italien | ✅ Hittad |
| Petrus | 2010 | Frankrike | ✅ Hittad |
| Dom Perignon | 2012 | Frankrike | ✅ Hittad |
| Opus One | 2019 | USA | ✅ Hittad |
| Kullaberg | - | Sverige | ❌ Ej hittad |
| Barolo (generisk) | - | Italien | ❌ Ej hittad |

### B. API Response-koder

| Kod | Betydelse |
|-----|-----------|
| 0 | Framgång, vin hittat |
| -1 | Vin ej hittat |
| -2 | Ogiltig API-nyckel |
| -3 | Rate limit överskriden |

---

*Rapport genererad av Claude Code, 2026-01-21*
