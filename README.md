# Winefeed

AI-driven inköpsassistent för vinrekommendationer till restauranger.

## Snabbstart (5 minuter)

### 1. Installera dependencies

```bash
npm install
```

### 2. Sätt upp Supabase

1. Skapa ett gratis konto på [supabase.com](https://supabase.com)
2. Skapa ett nytt projekt
3. Gå till SQL Editor och kör `supabase-schema.sql`
4. Kopiera API-nycklar från Settings → API

### 3. Konfigurera environment variables

```bash
cp .env.example .env.local
```

Redigera `.env.local` och fyll i:
- `NEXT_PUBLIC_SUPABASE_URL` - från Supabase Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - från Supabase Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` - från Supabase Settings → API
- `ANTHROPIC_API_KEY` - från [console.anthropic.com](https://console.anthropic.com/)
- `RESEND_API_KEY` - från [resend.com](https://resend.com) (valfritt för MVP)

### 4. Importera vindata

```bash
cd scripts
pip3 install -r requirements.txt
python3 import-systembolaget.py
```

Scriptet frågar om du vill ladda upp till Supabase. Svara `y`.

### 5. Starta dev-server

```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000)

## Projektstruktur

```
winefeed/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   └── suggest/       # POST /api/suggest - Generera vinförslag
│   ├── dashboard/         # Dashboard-sidor
│   │   └── new-request/   # Formulär för ny förfrågan
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn UI components
│   └── request-form.tsx  # Huvudformulär
├── lib/                   # Utilities
│   ├── ai/               # Claude AI integration
│   ├── supabase/         # Supabase clients
│   └── utils.ts          # Helpers
└── scripts/              # Data import scripts
    └── import-systembolaget.py
```

## API Endpoints

### POST /api/suggest

Generera vinförslag baserat på restaurangens behov.

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
      "wine": {
        "id": "uuid-789",
        "namn": "Barolo DOCG 2019",
        "producent": "Marchesi di Barolo",
        "pris_sek": 385
      },
      "supplier": {
        "namn": "Vingruppen AB",
        "kontakt_email": "order@vingruppen.se"
      },
      "motivering": "Kraftfull Nebbiolo...",
      "ranking_score": 0.92
    }
  ]
}
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres + Auth)
- **AI**: Claude 3.5 Sonnet (Anthropic API)
- **Email**: Resend.com
- **Styling**: Tailwind CSS + Shadcn/ui
- **Hosting**: Vercel

## Utvecklingsflöde

### Vecka 1-2 (DU ÄR HÄR)
- [x] Setup projekt
- [x] Supabase schema
- [x] Dataimport-script
- [x] API endpoint `/api/suggest`
- [x] Request form
- [ ] Auth (login/signup)
- [ ] Integrera Claude AI

### Vecka 3-4
- [ ] Implementera `rankWinesWithClaude()`
- [ ] Implementera `generateMotivation()`
- [ ] Visa AI-genererade motiveringar

### Vecka 5-6
- [ ] Email-flöde (Resend)
- [ ] Tracking av offerter

### Vecka 7-8
- [ ] Dashboard med historik
- [ ] User testing
- [ ] Bug fixes

## Vanliga problem

### "Supabase connection error"
- Dubbelkolla att `.env.local` har rätt nycklar
- Verifiera att Supabase-projektet är aktivt
- Kör SQL-schemat om du inte gjort det

### "No wines found"
- Kör dataimport-scriptet: `python3 scripts/import-systembolaget.py`
- Dubbelkolla att viner finns i Supabase Table Editor

### "Claude API error"
- Verifiera `ANTHROPIC_API_KEY` i `.env.local`
- Kontrollera att du har credits på ditt Anthropic-konto

## Deploy till Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Lägg till environment variables i Vercel dashboard.

## Kostnader (MVP)

- Vercel: $0 (Hobby tier)
- Supabase: $0 (Free tier)
- Anthropic API: ~$30-50/månad (50 req/dag)
- Resend: $0 (3000 emails/månad gratis)

**Total: ~$40/månad**

## Support

- Läs [MVP-PLAN.md](MVP-PLAN.md) för fullständig spec
- Issues/frågor: Skapa GitHub issue
- Dokumentation: Se Supabase och Anthropic docs

## Licens

Private - Winefeed MVP
