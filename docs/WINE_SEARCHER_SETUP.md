# Wine-Searcher API Setup Guide

Denna guide hjälper dig att ansöka om och konfigurera Wine-Searcher Market Price API för Winefeed.

## 🎯 Vad Wine-Searcher ger dig

Med Wine-Searcher Market Price API kan Winefeed:
- ✅ Visa restauranger **var de kan köpa viner billigast**
- ✅ Jämföra dina priser mot **marknadsgenomsnitt**
- ✅ Visa **antal återförsäljare** som säljer varje vin
- ✅ Berika AI-rekommendationer med **realtids prisdata**

---

## 📝 Steg 1: Ansök om API-nyckel

### 1.1 Gå till Wine-Searcher Trade
🔗 **https://www.wine-searcher.com/trade/api**

### 1.2 Klicka på "Apply for API Access"
Du hittar ansökningsformuläret på trade/api-sidan.

### 1.3 Fyll i ansökningsformulär
Du behöver ange:
- **Företagsnamn:** Winefeed
- **Email:** Din företagsemail
- **Website:** Din webbplats (kan vara localhost för test)
- **Användningsområde:** Beskriv hur du ska använda API:et

**Exempel på beskrivning:**
> "Vi bygger en AI-driven vinrekommendationsplattform för restauranger.
> Vi vill använda Market Price API för att visa restauranger var de kan
> köpa rekommenderade viner till bäst pris. API:et används för att berika
> våra AI-genererade vinrekommendationer med marknadsprisdata."

### 1.4 Vänta på godkännande
- Wine-Searcher granskar ansökan manuellt
- Kan ta **1-3 arbetsdagar**
- Du får email när din API-nyckel är klar

### 1.5 Ta emot API-nyckel
Du får ett email med:
- Din API-nyckel
- Dokumentationslänkar
- Rate limits (100 anrop/dag för trial)

---

## ⚙️ Steg 2: Konfigurera API-nyckel i Winefeed

### 2.1 Lägg till i .env.local
```bash
# Öppna .env.local
nano .env.local

# Lägg till din API-nyckel
WINE_SEARCHER_API_KEY=din_api_nyckel_här
```

### 2.2 Verifiera konfiguration
```bash
# Kontrollera att nyckeln är satt
grep WINE_SEARCHER_API_KEY .env.local
```

---

## 🧪 Steg 3: Testa integrationen

### 3.1 Kör testscript
```bash
npx ts-node scripts/test-wine-searcher.ts
```

**Förväntat resultat:**
```
🍷 Testing Wine-Searcher Market Price API

Test 1: Söker priser för "Chateau Margaux 2015"...
✓ Svar mottaget:
  Vin: Chateau Margaux 2015
  Totalt antal resultat: 24
  Återförsäljare returnerade: 24
  Lägsta pris: 4500 SEK
  Från: Vinbutiken Stockholm

---

Test 2: Söker priser med LWIN-kod...
✓ Svar mottaget
...

✅ Test komplett!
```

### 3.2 Testa via HTTP API
```bash
# Starta dev server (om den inte redan körs)
npm run dev

# Testa wine-prices endpoint
curl "http://localhost:3000/api/wine-prices?winename=Barolo&currency=SEK"
```

### 3.3 Testa suggest-API med prisdata
```bash
# Skicka en vinförfrågan
curl -X POST http://localhost:3000/api/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "fritext": "Jag söker elegant rött vin till biff",
    "budget_per_flaska": 300
  }'
```

**Exempel-svar (med Wine-Searcher data):**
```json
{
  "request_id": "test-request-1768370123456",
  "suggestions": [
    {
      "wine": {
        "id": "...",
        "namn": "Barolo DOCG 2019",
        "producent": "Marchesi di Barolo",
        "pris_sek": 385
      },
      "supplier": { "namn": "Vingruppen AB" },
      "motivering": "Elegant Barolo passar perfekt till biff",
      "ranking_score": 0.95,
      "market_data": {
        "lowest_price": 350,
        "merchant_name": "Systembolaget",
        "merchant_count": 12,
        "price_difference": 35,
        "price_difference_percent": "10.0"
      }
    }
  ]
}
```

---

## 📊 Steg 4: Synkronisera vinpriser

### 4.1 Kör databas-migration
```bash
# Applicera migration på Supabase
# Gå till: https://app.supabase.com/project/_/sql/new
# Kör SQL-filen: supabase/migrations/add_market_price_fields.sql
```

### 4.2 Synka priser för befintliga viner
```bash
# Synka 10 viner (testar)
npx ts-node scripts/sync-wine-prices.ts --limit 10

# Synka alla viner (långsamt - 100/dag limit)
npx ts-node scripts/sync-wine-prices.ts --limit 90 --delay 3000
```

---

## 🔄 Steg 5: Automatisk prisuppdatering (Valfritt)

### 5.1 Sätt upp daglig cron-job

**Option A: Vercel Cron Jobs**
```typescript
// app/api/cron/sync-prices/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Verifiera cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Kör prissynkronisering
  // ... (importera och kör sync-wine-prices logik)

  return NextResponse.json({ success: true });
}
```

**Option B: Linux Cron**
```bash
# Öppna crontab
crontab -e

# Lägg till daglig synkronisering kl 03:00
0 3 * * * cd /path/to/winefeed && npx ts-node scripts/sync-wine-prices.ts --limit 90
```

---

## 📈 Användningsstatistik

### Kontrollera API-anrop
Wine-Searcher visar remaining calls i API-svar (om de exponerar det).

### Rate Limits
- **Trial:** 100 anrop/dag
- **Reset:** Midnatt UK-tid
- **Uppgradering:** Kontakta Wine-Searcher för högre limits

### Optimera användning
Med 100 anrop/dag kan du:
- ✅ Synka 90 viner/dag (med marginal)
- ✅ Hantera ~20 restaurangförfrågningar/dag (5 viner/förfrågan)
- ⚠️ Övervaka användning noga

**Tips för att spara API-anrop:**
1. Cacha prisdata i databasen (uppdatera max 1x/dag)
2. Använd databas-priser först, fallback till Wine-Searcher om äldre än 24h
3. Prioritera populära viner för prisuppdatering

---

## 🚨 Troubleshooting

### Problem: "Wine-Searcher API key not configured"
**Lösning:** Lägg till `WINE_SEARCHER_API_KEY` i `.env.local`

### Problem: 403 Forbidden
**Lösningar:**
1. Kontrollera att API-nyckeln är korrekt kopierad
2. Vänta på godkännande från Wine-Searcher
3. Kontakta Wine-Searcher support

### Problem: Inga resultat returneras
**Lösningar:**
1. Kontrollera vinnamn-stavning
2. Försök utan årgång
3. Sök med enklare namn (t.ex. "Barolo" istället för "Barolo DOCG Riserva")
4. Använd LWIN-kod om möjligt

### Problem: Rate limit exceeded
**Lösningar:**
1. Vänta till midnatt UK-tid
2. Minska antal synkroniseringar
3. Cacha resultat längre
4. Uppgradera till betald plan

### Problem: Långsam response
**Orsak:** Wine-Searcher API kan vara långsamt (1-3 sekunder/anrop)
**Lösningar:**
1. Använd Promise.all() för parallella anrop
2. Implementera timeout (10 sekunder)
3. Cacha resultat i databas
4. Hämta priser asynkront (background job)

---

## 💡 Nästa Steg

Efter att Wine-Searcher är uppsatt:

1. **Testa i produktion**
   - Deploya till Vercel/annan hosting
   - Testa med riktiga restaurangförfrågningar
   - Övervaka API-användning

2. **Optimera prisdata**
   - Lägg till frontend-visning av marknadspriser
   - Visa "Köp här"-knappar till återförsäljare
   - Implementera prishistorik

3. **Utöka integrationer**
   - Lägg till fler prisAPI:er (Vivino, Systembolaget)
   - Integrera Bordeaux Index för finviner
   - Bygg prisjämförelse-dashboard

---

## 📞 Support

**Wine-Searcher:**
- Website: https://www.wine-searcher.com/trade/api
- Email: Via kontaktformulär på deras sida

**Winefeed (internt):**
- Dokumentation: `lib/wine-searcher/README.md`
- Testscript: `scripts/test-wine-searcher.ts`
- Sync-script: `scripts/sync-wine-prices.ts`

---

## ✅ Checklist

- [ ] Ansökt om Wine-Searcher API-nyckel
- [ ] Mottagit och verifierat API-nyckel via email
- [ ] Lagt till `WINE_SEARCHER_API_KEY` i `.env.local`
- [ ] Kört `scripts/test-wine-searcher.ts` framgångsrikt
- [ ] Testat `/api/wine-prices` endpoint
- [ ] Testat `/api/suggest` med prisdata
- [ ] Kört databas-migration för market_price-fält
- [ ] Synkat priser för testvinerna
- [ ] (Valfritt) Satt upp automatisk prissynkronisering
- [ ] (Valfritt) Implementerat frontend-visning av priser

---

🎉 **Grattis! Wine-Searcher är nu integrerat i Winefeed!**

Restauranger får nu intelligenta vinrekommendationer **med realtids prisdata** från hela marknaden.
