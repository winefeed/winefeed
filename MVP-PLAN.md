# WINEFEED MVP-PLAN
**AI-driven inköpsassistent för restauranger**
*8–10 veckor till första live-test*

---

## 1) MVP-SCOPE

### B2B Use Cases (3st)

**UC1: Återkommande basinköp**
Restaurang behöver fylla på 20-30 flaskor varje månad (husviner, klassiker). Anger budget + matstilar → får förslag som kan beställas direkt hos leverantör via offert-länk.

**UC2: Specialevent/vinprovning**
Restaurang planerar temamiddag (italiensk afton, champagnelunch). Anger tema + gästantal + budget → får kurerad lista med storytelling-beskrivningar för menyn.

**UC3: Hållfyllnad (akut)**
Restaurang har sålt slut på något i helgen. Anger "behöver ersätta Barolo, 3 flaskor, leverans inom 48h" → får 2-3 alternativ från lokala leverantörer med kontaktinfo.

### INTE i MVP
- Ingen betalning/checkout
- Ingen lagerstatus i realtid
- Ingen integration med leverantörssystem
- Ingen B2C (privatpersoner)
- Ingen priskampanj/rabattkoder
- Ingen vinprovningshistorik (lagras ej)

### KPI:er (beslutar om MVP lyckas)
1. **10 restauranger** testar systemet minst 2 gånger var
2. **60% conversion** från förslag → restaurangen kontaktar leverantör
3. **NPS ≥ 40** från testrestaurangerna

---

## 2) PRODUKTFLÖDE

**Huvudflöde: Behov → Förslag → Offert**

1. Restaurang loggar in (enkel email + lösenord)
2. Fyller i formulär: "Vad behöver du?" (fritext + några fält: budget, antal flaskor, leveransdatum, matstil)
3. Klickar "Få förslag"
4. System skickar förfrågan till AI-agent
5. Agent genererar 5-8 vinförslag med motiveringar (3-5 sek svarstid)
6. Restaurang ser resultatlista med pris, leverantör, "varför detta vin passar"
7. Restaurang klickar "Skicka offertförfrågan" på 1-5 viner
8. System skickar email till restaurang + leverantör med kontaktinfo (vi kopplar ihop dem, sen tar de över)

**Edge case i MVP:**
Om agenten inte hittar något → visa "Vi hittar inget just nu, men här är 3 generiska förslag" (fallback-lista).

---

## 3) SYSTEM & STACK (DETALJERAD)

### Arkitektur (overview)

```
┌─────────────────┐
│  RESTAURANG     │
│  (Browser)      │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────────────────────────────┐
│         VERCEL (Next.js 14)                     │
│                                                 │
│  ┌──────────────┐      ┌──────────────────┐   │
│  │   Frontend   │──────│   API Routes     │   │
│  │  (App Router)│      │  /api/suggest    │   │
│  │  React + RSC │      │  /api/send-offer │   │
│  └──────────────┘      └────────┬─────────┘   │
│                                  │             │
└──────────────────────────────────┼─────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────┐
         │                         │                     │
         ▼                         ▼                     ▼
  ┌─────────────┐          ┌─────────────┐      ┌─────────────┐
  │  SUPABASE   │          │  ANTHROPIC  │      │  RESEND.COM │
  │  Postgres   │          │  Claude API │      │  Email API  │
  │  + Auth     │          │  (Sonnet)   │      │             │
  └─────────────┘          └─────────────┘      └─────────────┘
```

### Stack (med versioner)

| Komponent | Val | Varför detta? |
|-----------|-----|---------------|
| **Framework** | Next.js 14.2+ (App Router) | Server Components → färre API-calls. Vercel-optimerad. |
| **UI** | Tailwind 3.4 + Shadcn/ui | Snabbast att bygga forms/tables. Inga design-beslut. |
| **Databas** | Supabase (Postgres 15) | Gratis tier räcker för MVP. Auth ingår. Edge-ready. |
| **LLM** | Claude 3.5 Sonnet (API) | Bäst på strukturerad output + svenska. 200k context. |
| **Email** | Resend.com | Enklaste API. React Email för templates. |
| **Hosting** | Vercel (Hobby → Pro) | Zero-config deploy. Edge functions gratis. |
| **Analytics** | Posthog (self-hosted eller cloud) | Event tracking för vilket förslag accepteras. |

### Databasschema (SQL – kör detta i Supabase)

```sql
-- TABELL 1: Restauranger (Supabase Auth hanterar users-tabellen, detta är metadata)
CREATE TABLE restaurants (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 2: Viner
CREATE TABLE wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn TEXT NOT NULL,
  producent TEXT NOT NULL,
  land TEXT NOT NULL,
  region TEXT,
  pris_sek INTEGER NOT NULL, -- heltal för att undvika float-problem
  beskrivning TEXT NOT NULL,
  druva TEXT,
  ekologisk BOOLEAN DEFAULT FALSE,
  lagerstatus TEXT DEFAULT 'tillgänglig' CHECK (lagerstatus IN ('tillgänglig', 'få kvar', 'slut')),
  systembolaget_id TEXT UNIQUE, -- om data kommer från Systembolaget
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för snabbare filtrering
CREATE INDEX idx_wines_pris ON wines(pris_sek);
CREATE INDEX idx_wines_land ON wines(land);
CREATE INDEX idx_wines_lagerstatus ON wines(lagerstatus);

-- TABELL 3: Leverantörer
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn TEXT NOT NULL,
  kontakt_email TEXT NOT NULL,
  telefon TEXT,
  hemsida TEXT,
  normalleveranstid_dagar INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 4: Koppling vin ↔ leverantör (många-till-många)
CREATE TABLE wine_suppliers (
  wine_id UUID REFERENCES wines(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  PRIMARY KEY (wine_id, supplier_id)
);

-- TABELL 5: Förfrågningar (sparar vad restaurangen frågade efter)
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  fritext TEXT NOT NULL,
  budget_per_flaska INTEGER,
  antal_flaskor INTEGER,
  leverans_senast DATE,
  specialkrav TEXT[], -- array av krav: ["ekologiskt", "veganskt"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 6: Genererade förslag (sparar vad AI:n föreslog)
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  wine_id UUID REFERENCES wines(id) ON DELETE SET NULL,
  motivering TEXT NOT NULL, -- AI-genererad text
  ranking_score DECIMAL(3,2), -- 0.00-1.00
  accepted BOOLEAN DEFAULT FALSE, -- true om restaurang klickade "inkludera i offert"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 7: Skickade offerter (tracking)
CREATE TABLE offers_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  wine_ids UUID[], -- array av vin-ID:n som skickades
  email_sent_at TIMESTAMPTZ DEFAULT NOW(),
  supplier_responded BOOLEAN DEFAULT FALSE,
  response_received_at TIMESTAMPTZ
);

-- RLS (Row Level Security) – restauranger ser bara sin egen data
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restauranger ser bara egna requests"
  ON requests FOR ALL
  USING (auth.uid() = restaurant_id);

CREATE POLICY "Restauranger ser bara egna suggestions"
  ON suggestions FOR ALL
  USING (
    request_id IN (SELECT id FROM requests WHERE restaurant_id = auth.uid())
  );
```

### API-endpoints (Next.js App Router)

**Struktur:**
```
/app
  /api
    /suggest
      route.ts          → POST: Generera vinförslag
    /send-offer
      route.ts          → POST: Skicka offert till leverantör
    /wines
      route.ts          → GET: Lista alla viner (admin)
      /import
        route.ts        → POST: Importera viner från CSV (admin)
```

#### Endpoint 1: `/api/suggest` (POST)

**Request:**
```json
{
  "fritext": "Behöver 20 flaskor italienska rödviner till pasta-meny",
  "budget_per_flaska": 200,
  "antal_flaskor": 20,
  "leverans_senast": "2026-02-15",
  "specialkrav": ["ekologiskt"]
}
```

**Response:**
```json
{
  "request_id": "uuid-123",
  "suggestions": [
    {
      "id": "uuid-456",
      "wine": {
        "id": "uuid-789",
        "namn": "Barolo DOCG 2019",
        "producent": "Marchesi di Barolo",
        "land": "Italien",
        "region": "Piemonte",
        "pris_sek": 385,
        "ekologisk": false
      },
      "supplier": {
        "namn": "Vingruppen AB",
        "kontakt_email": "order@vingruppen.se",
        "normalleveranstid_dagar": 3
      },
      "motivering": "Kraftfull Nebbiolo med toner av körsbär och tryffel. Perfekt till din pasta-meny med köttbaserade såser. Premium-känsla för gäster.",
      "ranking_score": 0.92
    },
    // ... 5-7 fler förslag
  ]
}
```

**Logik (pseudokod):**
```typescript
// app/api/suggest/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  // 1. Spara request i DB
  const request = await supabase.from('requests').insert({
    restaurant_id: user.id,
    fritext: body.fritext,
    budget_per_flaska: body.budget_per_flaska,
    // ...
  });

  // 2. Filtrera viner (SQL)
  const wines = await supabase
    .from('wines')
    .select('*, wine_suppliers(supplier:suppliers(*))')
    .lte('pris_sek', body.budget_per_flaska * 1.3)
    .eq('lagerstatus', 'tillgänglig')
    .limit(50);

  // 3. Rangordna med AI (Claude API)
  const ranked = await rankWinesWithClaude(wines, body.fritext);

  // 4. Generera motiveringar (Claude API)
  const suggestions = await Promise.all(
    ranked.slice(0, 6).map(async (wine) => {
      const motivering = await generateMotivation(wine, body.fritext);
      return { wine, motivering, ranking_score: wine.score };
    })
  );

  // 5. Spara suggestions i DB
  await saveSuggestions(request.id, suggestions);

  return Response.json({ request_id: request.id, suggestions });
}
```

#### Endpoint 2: `/api/send-offer` (POST)

**Request:**
```json
{
  "request_id": "uuid-123",
  "selected_wine_ids": ["uuid-789", "uuid-101"]
}
```

**Response:**
```json
{
  "success": true,
  "emails_sent": 2,
  "message": "Offertförfrågan skickad till Vingruppen AB och Wineworld."
}
```

### Filstruktur (Next.js projekt)

```
winefeed/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # Inloggning
│   │   └── signup/
│   │       └── page.tsx              # Registrering (restauranger)
│   ├── dashboard/
│   │   ├── page.tsx                  # Översikt (tidigare förfrågningar)
│   │   ├── new-request/
│   │   │   └── page.tsx              # Nytt förfrågningsformulär
│   │   └── results/
│   │       └── [requestId]/
│   │           └── page.tsx          # Resultat för en förfrågan
│   ├── api/
│   │   ├── suggest/
│   │   │   └── route.ts              # POST /api/suggest
│   │   ├── send-offer/
│   │   │   └── route.ts              # POST /api/send-offer
│   │   └── wines/
│   │       ├── route.ts              # GET /api/wines (admin)
│   │       └── import/
│   │           └── route.ts          # POST /api/wines/import
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Landing page (redirect till login)
│
├── components/
│   ├── ui/                           # Shadcn components (button, input, etc)
│   ├── request-form.tsx              # Formulär för ny förfrågan
│   ├── wine-card.tsx                 # Kort för varje vinförslag
│   └── offer-summary.tsx             # Sammanfattning innan email skickas
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Supabase client (browser)
│   │   └── server.ts                 # Supabase client (server)
│   ├── ai/
│   │   ├── claude.ts                 # Claude API wrapper
│   │   ├── rank-wines.ts             # Rangordningslogik
│   │   └── generate-motivation.ts    # Motivering-generator
│   ├── email/
│   │   ├── resend.ts                 # Resend client
│   │   └── templates/
│   │       ├── offer-to-restaurant.tsx
│   │       └── offer-to-supplier.tsx
│   └── utils.ts                      # Helpers (formatPrice, etc)
│
├── scripts/
│   └── import-systembolaget.py       # Python-script för dataimport
│
├── .env.local                        # Environment variables
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

### Dependencies (package.json)

```json
{
  "name": "winefeed",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.21",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@supabase/supabase-js": "^2.47.10",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@anthropic-ai/sdk": "^0.32.1",
    "resend": "^4.0.1",
    "@radix-ui/react-slot": "^1.1.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "zod": "^3.24.1",
    "react-hook-form": "^7.54.2",
    "@hookform/resolvers": "^3.9.1"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "eslint": "^8",
    "eslint-config-next": "14.2.21"
  }
}
```

### Environment Variables (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # för admin-operationer

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...

# Resend (email)
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000  # eller https://winefeed.se i prod
```

### Vad byggs först vs mockas

**Vecka 1-2 (CORE):**
```
✓ Supabase setup + schema deployed
✓ Next.js projekt med auth (login/signup)
✓ Förfrågningsformulär (/dashboard/new-request)
✓ AI-agent (Claude API integration)
✓ 200 viner importerade från Systembolaget
✓ Resultatsida (statisk lista, ingen ranking ännu)
```

**Vecka 3-4 (AI + RANKING):**
```
✓ Implementera rankWinesWithClaude() i lib/ai/rank-wines.ts
✓ Implementera generateMotivation() för varje vin
✓ Visa motiveringar på resultatsida
✓ Lägg till checkboxes för "inkludera i offert"
```

**Vecka 5-6 (EMAIL):**
```
✓ Resend integration
✓ Email-templates (React Email)
✓ POST /api/send-offer endpoint
✓ Tracking i offers_sent-tabellen
```

**Vecka 7-8 (POLISH + TEST):**
```
✓ Dashboard med tidigare förfrågningar
✓ Admin-panel (/admin/wines) för manuell dataimport
✓ Fallback-lista om AI:n inte hittar något
✓ User testing med 3 restauranger
✓ Bug fixes
```

**Mockas/skjuts fram:**
- Realtids-priser från leverantörer (använder statiska priser)
- Lagerstatus-sync (hårdkodat till "tillgänglig")
- Betalningsflöde (sker utanför systemet)
- Leverantörs-API-integrationer (manuell email i MVP)
- Advanced analytics (Posthog installeras men används minimalt)

### Deployment (Vercel)

**Setup:**
```bash
# 1. Installera Vercel CLI
npm i -g vercel

# 2. Logga in
vercel login

# 3. Länka projekt
vercel link

# 4. Lägg till env variables i Vercel dashboard
# (kopiera från .env.local)

# 5. Deploy
vercel --prod
```

**Auto-deploy:**
- Push till `main` branch → deploy till produktion
- PR:s → preview-URL genereras automatiskt

### Kostnadsuppskattning (MVP, 8 veckor med 50 förfrågningar/dag)

| Tjänst | Kostnad/månad | Anteckningar |
|--------|---------------|--------------|
| Vercel (Hobby) | $0 | Räcker för MVP (<10k requests/dag) |
| Supabase (Free tier) | $0 | 500MB DB, 2GB bandwidth |
| Anthropic API | ~$30-50 | 50 req/dag × 2 LLM-calls × $0.003/req |
| Resend (Free tier) | $0 | 3000 emails/månad gratis |
| **Total** | **~$40/månad** | Skalar till $200-300/mån vid 200 req/dag |

### Batch vs Realtid

**Realtid:**
- `/api/suggest` endpoint (triggas av användare)
- Claude API-calls (genererar förslag on-demand)

**Batch/Manuellt:**
- Vindata uppdateras 1 gång/vecka via Python-script
- Leverantörskontakter googlas manuellt (10-15 st vid start)
- Email-tracking granskas manuellt (ingen auto-follow-up)

### Kodexempel: Claude API integration

```typescript
// lib/ai/rank-wines.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function rankWinesWithClaude(
  wines: Wine[],
  userRequest: string
): Promise<RankedWine[]> {
  const prompt = `Du är en sommelier-AI för restauranger.

En restaurang söker: "${userRequest}"

Här är ${wines.length} viner som matchar deras budget:
${wines.map((w, i) => `${i + 1}. ${w.namn} (${w.land}, ${w.pris_sek} kr) - ${w.beskrivning}`).join('\n')}

UPPGIFT:
Rangordna dessa viner från bäst till sämst match för restaurangens behov.
Returnera JSON:

[
  {"wine_id": "uuid", "score": 0.95, "reason": "kort motivering"},
  ...
]

Regler:
- score: 0.0-1.0 (1.0 = perfekt match)
- Ta hänsyn till pris, matstil, region, beskrivning
- Max 6 viner i svaret`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonMatch = message.content[0].text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Claude returnerade inte JSON');

  const ranked = JSON.parse(jsonMatch[0]);

  return ranked.map((r: any) => ({
    ...wines.find(w => w.id === r.wine_id)!,
    score: r.score,
    ai_reason: r.reason,
  }));
}
```

### Nästa steg (tekniskt)

1. **Idag:**
   ```bash
   npx create-next-app@latest winefeed --typescript --tailwind --app
   cd winefeed
   npm install @supabase/supabase-js @anthropic-ai/sdk resend
   ```

2. **Imorgon:**
   - Skapa Supabase-projekt på supabase.com
   - Kör SQL-schemat ovan i Supabase SQL Editor
   - Skapa `.env.local` med API-nycklar

3. **Dag 3:**
   - Skriv `/api/suggest` endpoint (stub först, sen Claude-integration)
   - Bygg request-form.tsx (simple form med 3 fält)

**Frågor att lösa innan kod:**
- Ska vi använda React Email för email-templates eller bara plain text i MVP? (rekommendation: plain text, snabbare)

---

## 4) AGENTLOGIK

### Vad agenten GÖR
- Tolkar restaurangens fritext-behov (extraherar krav: pris, stil, ursprung, matstilar)
- Matchar mot vindatabas med semantisk sökning + filtrering
- Rangordnar viner baserat på: budget-match (40%), matstilsmatch (30%), leveranstid (20%), specialkrav (10%)
- Genererar 2-3 meningar per vin som förklarar "varför detta passar"
- Flaggar om förfrågan är juridiskt problematisk (t.ex. privatperson som försöker köpa)

### Vad agenten INTE GÖR
- Lova specifika leveranstider (vi visar "normalt 2-5 dagar" som default)
- Garantera pris (vi skriver "cirkapris, bekräftas av leverantör")
- Jämföra leverantörer negativt ("X är sämre än Y")
- Hantera returer/reklamationer (ej vårt ansvar i MVP)
- Lagra känslig företagsdata (bokföring, marginalkalkyler osv)

### Rangordningslogik (steg-för-steg)

```python
# Pseudokod för MVP-agent

1. Extrahera krav från fritext (LLM-call):
   {
     "budget_per_flaska": 150,
     "antal": 25,
     "matstil": ["italienskt", "pasta"],
     "leverans_senast": "2026-02-01",
     "specialkrav": ["ekologiskt"]
   }

2. SQL-filtrering:
   SELECT * FROM wines
   WHERE pris <= budget_per_flaska * 1.3  -- tillåt 30% överskridning
   AND (ekologisk = true IF specialkrav innehåller "ekologiskt")
   AND lagerstatus != 'slut'  -- mockad som alltid 'tillgänglig' i MVP

3. Semantisk matching (embeddings):
   - Embed restaurangens matstilsbeskrivning
   - Embed varje vins beskrivning
   - Beräkna cosine similarity
   - Välj top 20

4. Rangordning (viktad summa):
   score =
     0.4 * budget_match_score +      # 1.0 om exakt budget, 0.5 om 30% över
     0.3 * matstil_similarity_score + # från embeddings
     0.2 * leverantör_tillgänglighet + # mockad som 1.0 i MVP
     0.1 * specialkrav_bonus          # +0.2 om ekologisk etc

5. LLM-generering av motiveringar:
   Prompt: "Förklara varför [vinnamn] passar till [matstil] för en restaurang med budget [X]. Max 3 meningar, skriv konkret."

6. Returnera top 5-8 viner med motiveringar
```

---

## 5) DATA (MINIMUM)

### 7 fält per vin (MVP-minimum)

```json
{
  "id": "uuid",
  "namn": "Barolo DOCG 2019",
  "producent": "Marchesi di Barolo",
  "land": "Italien",
  "region": "Piemonte",
  "pris_sek": 385,
  "beskrivning": "Kraftfull Nebbiolo med toner av körsbär, tryffel och läder. Passar vilt, ostklass, röda köttgryter.",
  "leverantor": {
    "namn": "Vingruppen AB",
    "kontakt_email": "order@vingruppen.se",
    "normalleveranstid_dagar": 3
  }
}
```

**Nice-to-have (lägg till om tid finns):**
- `druva` (Nebbiolo, Chardonnay etc)
- `ekologisk` (bool)
- `lagerstatus` (enum: tillgänglig, få kvar, slut)
- `årgång`

### Hantering av ofullständig data

**Regel:**
- Saknas `beskrivning` → LLM genererar en från `namn + land + region` vid import
- Saknas `pris` → vinet visas EJ i förslag (måste ha pris)
- Saknas `leverantor.kontakt_email` → vi använder default-email för den regionen (hårdkodat)

### Startdata (1 källa)

**MVP startar med:**
- 200 viner från **Systembolagets API** (offentlig, gratis, strukturerad)
- Kompletteras med leverantörskontakter manuellt (googla 10-15 svenska vinleverantörer)
- Importeras som CSV → läses in i Postgres

**Datakvalitet:**
- Vi bryr oss INTE om att ha "allt" – 200 bra viner är bättre än 10,000 dåliga poster
- I MVP är det OK om 30% av förfrågningarna får "hittar inget, här är fallback-lista"

---

## 6) UX – TEXT-WIREFRAMES

### Vy 1: Förfrågan (restaurang)

```
╔══════════════════════════════════════════════════════╗
║  WINEFEED – Få vinförslag på 30 sekunder            ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Beskriv vad du behöver:                            ║
║  ┌────────────────────────────────────────────────┐ ║
║  │ "Behöver 20 flaskor italienska rödviner till   │ ║
║  │ vår nya pasta-meny. Budget 150-250 kr/flaska.  │ ║
║  │ Leverans inom 2 veckor."                       │ ║
║  └────────────────────────────────────────────────┘ ║
║                                                      ║
║  Antal flaskor: [____20____]                        ║
║  Budget/flaska: [____200____] kr                    ║
║  Leverans senast: [____2026-02-15____]              ║
║                                                      ║
║  Specialkrav (valfritt):                            ║
║  [ ] Ekologiskt  [ ] Biodynamiskt  [ ] Veganskt     ║
║                                                      ║
║             [ Få förslag ]                           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

### Vy 2: Resultat + Offert

```
╔══════════════════════════════════════════════════════╗
║  Vi hittade 6 viner som passar din förfrågan        ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  1. ★ Barolo DOCG 2019                              ║
║     Marchesi di Barolo | Italien, Piemonte          ║
║     385 kr/flaska (cirkapris)                       ║
║                                                      ║
║     Kraftfull Nebbiolo med toner av körsbär och     ║
║     tryffel. Perfekt till din pasta-meny med kött-  ║
║     baserade såser. Premium-känsla för gäster.      ║
║                                                      ║
║     Leverantör: Vingruppen AB (normalt 3 dagar)     ║
║     [✓] Inkludera i offert                          ║
║                                                      ║
║  ─────────────────────────────────────────────────  ║
║                                                      ║
║  2.  Chianti Classico Riserva 2020                  ║
║     ... (samma layout)                              ║
║                                                      ║
║  ─────────────────────────────────────────────────  ║
║                                                      ║
║  [3-6 fortsätter...]                                ║
║                                                      ║
║  ─────────────────────────────────────────────────  ║
║                                                      ║
║  Valda: 3 viner | Uppskattat totalpris: ~18,500 kr ║
║                                                      ║
║          [ Skicka offertförfrågan ]                 ║
║                                                      ║
║  (Vi skickar dina val till leverantörerna.          ║
║   De kontaktar dig inom 24h med exakt pris.)        ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

### Email-mall (auto-skickas)

**Till restaurang:**
```
Hej [Restaurangnamn],

Här är din offertförfrågan från Winefeed:

- Barolo DOCG 2019 (Vingruppen AB) – 25 flaskor, ~385 kr/st
- Chianti Classico Riserva 2020 (Wineworld) – 15 flaskor, ~215 kr/st

Vi har skickat detta till leverantörerna. De kontaktar dig på [restaurang@email.se] inom 24h.

Mvh,
Winefeed
```

**Till leverantör:**
```
Hej [Leverantör],

Restaurang [Namn] är intresserad av:
- [Vinnamn], [Antal] flaskor

Kontakta dem direkt:
Email: [restaurang@email.se]
Telefon: [optional]

Detta är en förfrågan från Winefeed (vinrekommendationssystem).

Mvh,
Winefeed-teamet
```

---

## 7) RISK & COMPLIANCE

### 5 största riskerna

| Risk | Sannolikhet | Konsekvens | Mitigation i MVP |
|------|-------------|------------|------------------|
| **1. Alkohollicens-miss** | Medel | Kritisk | Vi säljer INTE vin. Vi är en rekommendationsmotor. Leverantören säljer. Tydligt i ToS. |
| **2. Dåliga AI-rekommendationer** | Hög | Medel | Mänsklig granskning av första 50 förslagen. Fallback-lista om agenten misslyckas. |
| **3. Leverantör svarar ej** | Hög | Medel | Välj endast leverantörer vi pratat med. Ha 2-3 backup-leverantörer per region. |
| **4. Restaurang förväntar sig köp direkt** | Medel | Låg | Tydlig text i UX: "offertförfrågan" (inte "köp"). Email förtydligar processen. |
| **5. GDPR-brott (restaurangdata)** | Låg | Hög | Lagra minimum: email + företagsnamn. Inga kortuppgifter. Opt-in för marknadsföring. |

### Juridisk avgränsning

**Vad Winefeed INTE är:**
- Inte alkoholhandel (vi säljer ej)
- Inte logistikpartner (leverantören levererar)
- Inte betalningsförmedlare (restaurang betalar direkt till leverantör)
- Inte ansvarig för produktkvalitet (leverantörens ansvar)

**Vad Winefeed ÄR:**
- B2B-rekommendationstjänst (som Google för vin)
- Lead-generation för leverantörer
- Beslutshjälp för restauranger

**Skrivet i ToS:**
> "Winefeed förmedlar kontakt mellan restauranger och licensierade vinleverantörer. Pris, leverans och produktkvalitet ansvarar leverantören för. Winefeed är inte part i transaktionen."

### Agent-guardrails

**Agenten FÅR INTE:**
- Lova exakta priser (säg alltid "cirkapris")
- Säga "vi levererar" (säg "leverantör X levererar normalt inom...")
- Rekommendera vin utanför restaurangens budget med >50% marginal
- Svara på privatpersoner (flagga till manuell review)
- Ge medicinska råd ("vin mot migrän" osv)

**Prompt-snippet:**
```
Du är Winefeed, en AI-assistent för B2B-vinrekommendationer.

REGLER:
- Rekommendera endast till företag (restauranger, hotell)
- Skriv alltid "cirkapris, bekräftas av leverantör"
- Skriv aldrig "vi levererar" – skriv "leverantören levererar"
- Om användaren verkar vara privatperson, svara: "Winefeed är för restauranger. Kontakta oss på hello@winefeed.se."
```

---

## 8) STARTPLAN

### Vecka 1: Setup & grunddata

**Dag 1-2:**
- [ ] Skapa Next.js-projekt + Supabase-konto
- [ ] Sätt upp repo + Vercel-deploy
- [ ] Importera 200 viner från Systembolagets API (Python-script)
- [ ] Manuellt googla 10 leverantörer, lägg in kontaktinfo i CSV

**Dag 3-5:**
- [ ] Bygg inloggning (Supabase Auth + email/password)
- [ ] Bygg förfrågningsformulär (Next.js form + Tailwind)
- [ ] Skapa första AI-agent-funktion (anropar Claude API)
  - Prompt: "Extrahera krav från denna text: [fritext]"
  - Output: JSON med budget, antal, matstil

### Vecka 2: AI-logik + resultatsida

**Dag 6-8:**
- [ ] Implementera filtrering i Postgres (SQL-query baserat på krav)
- [ ] Bygg semantisk matching (OpenAI Embeddings om tid finns, annars enkel keyword-match)
- [ ] Implementera rangordningslogik (se avsnitt 4)

**Dag 9-10:**
- [ ] Bygg resultatsida (lista med 6 viner + checkboxes)
- [ ] Integrera AI-generering av motiveringar (LLM-call per vin)
- [ ] Testa manuellt med 5 olika förfrågningar

**Dag 11-12:**
- [ ] Bygg email-flöde (Resend.com)
- [ ] Testa end-to-end: Förfrågan → Förslag → Email skickas
- [ ] Bjud in 2 restauranger för alpha-test

### Roller som krävs

**1. Fullstack-utvecklare (1 person, 100%)**
- Bygger frontend + backend + AI-integration
- Erfaren med Next.js + LLM-API:er

**2. Product Lead (1 person, 50%)**
- Skriver prompts till AI-agent
- Testar UX med restauranger
- Granskar vinrekommendationer manuellt första veckorna

**3. Data-person (1 person, 25%, kan vara samma som Product Lead)**
- Importerar vindata
- Googlar leverantörer
- Uppdaterar CSV varje vecka

**Totalt:** 1.75 FTE i 8-10 veckor.

---

## NÄSTA STEG (DIREKT EFTER DETTA DOK)

1. Skapa Supabase-projekt + Vercel-konto
2. Klona startkit: `npx create-next-app@latest winefeed --typescript --tailwind`
3. Skriv Python-script för Systembolaget-import (idag)
4. Boka möte med 3 restauranger för user interviews (innan vi kodar)

**Fråga att svara på innan sprint 1:**
- Vilka 3 restauranger testar vi med? (behöver namn för att fokusera use cases)

---

*Dokument skapat: 2026-01-13*
*Revidera efter vecka 2 baserat på alpha-test.*
