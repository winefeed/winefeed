# Wine-Searcher Market Price API Integration

Integration för att hämta marknadspriser från Wine-Searcher API.

## Funktioner

- ✅ Hämta priser från upp till 24 återförsäljare (sorterat efter lägsta pris)
- ✅ Sökning med vinnamn + årgång
- ✅ Sökning med LWIN-kod (Liv-Ex Wine Identification Number)
- ✅ Stöd för flera valutor (SEK, EUR, USD, GBP)
- ✅ TypeScript-typade API-svar

## Komma igång

### 1. Ansök om API-nyckel

1. Gå till https://www.wine-searcher.com/trade/api
2. Ansök om trial API key (100 gratis anrop/dag)
3. Vänta på godkännande via email

### 2. Konfigurera API-nyckel

Lägg till i `.env.local`:

```bash
WINE_SEARCHER_API_KEY=your_api_key_here
```

### 3. Testa integrationen

Kör testscriptet:

```bash
npx ts-node scripts/test-wine-searcher.ts
```

## Användning

### Via API-klienten

```typescript
import { wineSearcherClient } from '@/lib/wine-searcher/client';

// Sök med vinnamn och årgång
const prices = await wineSearcherClient.getPricesByName(
  'Chateau Margaux',
  '2015',
  'SEK'
);

// Sök med LWIN-kod
const pricesLWIN = await wineSearcherClient.getPricesByLWIN(
  '1012361',
  'SEK'
);

// Hämta bara lägsta priset
const lowestPrice = await wineSearcherClient.getLowestPrice({
  winename: 'Barolo',
  currencycode: 'SEK',
});
```

### Via API-route

```bash
# Sök med vinnamn
curl "http://localhost:3000/api/wine-prices?winename=Chateau%20Margaux&vintage=2015&currency=SEK"

# Sök med LWIN-kod
curl "http://localhost:3000/api/wine-prices?lwin=1012361&currency=SEK"
```

### API Response Format

```json
{
  "wine": "Chateau Margaux",
  "vintage": "2015",
  "lwin": "1012361",
  "currency": "SEK",
  "merchants": [
    {
      "merchant_name": "Vinbutiken AB",
      "merchant_url": "https://...",
      "price": 4500,
      "currency": "SEK",
      "bottle_size": "750ml",
      "availability": "In Stock"
    }
  ],
  "total_results": 24,
  "lowest_price": 4500
}
```

## Integration med Winefeed

### Automatiskt uppdatera vinpriser

Skapa ett cron-jobb som hämtar priser för alla viner i databasen:

```typescript
// scripts/sync-wine-prices.ts
import { createClient } from '@supabase/supabase-js';
import { wineSearcherClient } from '@/lib/wine-searcher/client';

async function syncWinePrices() {
  const supabase = createClient(url, key);

  // Hämta alla viner
  const { data: wines } = await supabase
    .from('wines')
    .select('id, namn, producent, vintage');

  for (const wine of wines) {
    // Hämta priser från Wine-Searcher
    const prices = await wineSearcherClient.getPricesByName(
      `${wine.producent} ${wine.namn}`,
      wine.vintage,
      'SEK'
    );

    if (prices && prices.results.length > 0) {
      // Uppdatera lägsta marknadspris i databasen
      await supabase
        .from('wines')
        .update({
          market_price_sek: prices.results[0].price,
          price_updated_at: new Date().toISOString()
        })
        .eq('id', wine.id);
    }

    // Rate limiting (100 anrop/dag = ~4 per timme)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### Visa priser till användare

Lägg till i wine suggestions response:

```typescript
// app/api/suggest/route.ts
const suggestions = ranked.map(async (wine) => {
  // Hämta marknadspris från Wine-Searcher
  const prices = await wineSearcherClient.getPricesByName(
    `${wine.producent} ${wine.namn}`,
    wine.vintage,
    'SEK'
  );

  return {
    wine,
    supplier,
    motivering: wine.ai_reason,
    market_data: prices ? {
      lowest_price: prices.results[0]?.price,
      merchant_count: prices.total_results,
      best_merchant: prices.results[0]?.merchant_name,
    } : null,
  };
});
```

## Rate Limits

- **Trial:** 100 anrop/dag
- **Paid:** Kontakta Wine-Searcher för högre limits
- Reset: Midnatt UK-tid

## LWIN-koder

LWIN (Liv-Ex Wine Identification Number) är en standardiserad vinkod:

- **LWIN-7:** Producent + vin (ex: 1012361)
- **LWIN-11:** Inkluderar årgång
- **LWIN-18:** Inkluderar flaskstorlek och pack

Fördelar med LWIN:
- Mer exakt matchning än textbaserad sökning
- Snabbare API-svar
- Ingen risk för felstavning

## Troubleshooting

**Problem:** `Wine-Searcher API key not configured`
- **Lösning:** Lägg till `WINE_SEARCHER_API_KEY` i `.env.local`

**Problem:** 403 Forbidden
- **Lösning:** Kontrollera att API-nyckeln är korrekt

**Problem:** Inga resultat returneras
- **Lösning:**
  - Kontrollera stavning av vinnamn
  - Försök utan årgång
  - Använd LWIN-kod om möjligt

**Problem:** Rate limit exceeded
- **Lösning:** Vänta till midnatt UK-tid för reset

## Dokumentation

- [Wine-Searcher API](https://www.wine-searcher.com/trade/api)
- [API Usage Guide](https://www.wine-searcher.com/trade/ws-api)
- [FAQ](https://www.wine-searcher.com/trade/faq)

## Support

Kontakta Wine-Searcher:
- Email: Via deras website
- Ansök om API-access: https://www.wine-searcher.com/trade/api
