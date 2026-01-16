# Winefeed Post-Offert Dokumentation

**Version:** 1.0
**Skapad:** 2026-01-14
**Status:** Konceptuell design och modellering

---

## Översikt

Detta är den kompletta dokumentationen för Winefeeds post-offert-funktion - systemet som automatiserar hela köpprocessen från offertacceptans till leverans och efterleverans.

### Vision

> **Göra vininköp för restauranger lika enkelt som ett B2B-köp i en modern e-handelsplattform – trots komplexiteten i alkoholhandel, logistik och regelefterlevnad.**

---

## Innehåll

### 📋 Huvuddokumentation

**[POST_OFFERT_ARCHITECTURE.md](./POST_OFFERT_ARCHITECTURE.md)**
- Fullständig arkitekturöversikt
- Systemroller och ansvar
- 6-stegs processflöde
- Teknisk arkitektur med kärnkomponenter
- Dataflöden på hög nivå
- Säkerhet och compliance
- Fasindelning (MVP → Full platform)
- Kostnadsmodell och intäktsströmmar
- Risker och mitigering

**Start här om du vill:**
- Förstå helheten
- Få en executive summary
- Se roadmap och fasplan

---

### 🗄️ Datamodeller

**[data-models/order-flow.md](./data-models/order-flow.md)**
- Detaljerad datamodellering för hela orderflödet
- Entitetsrelationsdiagram (ERD)
- SQL-schema för alla tabeller:
  - `orders` - Huvudentitet
  - `order_items` - Radobjekt
  - `order_status_log` - Audit trail
  - `supplier_order_confirmations` - Leverantörssvar
  - `order_calculations` - Skatteberäkningar
- TypeScript-interfaces
- Affärslogik för statusövergångar
- API-endpoints (exempel)

**Läs detta om du vill:**
- Implementera databasschema
- Förstå orderlivscykeln
- Se exakta datastrukturer

---

### 🔌 Integrationer

#### **[integrations/payment-partners.md](./integrations/payment-partners.md)**
- Jämförelse av betalningspartners:
  - Worldline (Norden-fokus, B2B)
  - Stripe (bäst developer experience)
  - Klarna (B2B-faktura)
- API-exempel och implementationer
- Escrow och split payment-lösningar
- PCI DSS compliance
- Webhook-hantering
- Datamodell för payments

**Läs detta om du vill:**
- Välja betalningspartner
- Implementera betalningsflöde
- Förstå escrow-mekaniken

#### **[integrations/logistics-partners.md](./integrations/logistics-partners.md)**
- Logistikpartners:
  - DHL Freight (primär)
  - VinLog (specialiserad vintransport)
  - Schenker (EU-import)
- Unified Logistics Layer (abstraktion)
- API-exempel för fraktbokning och spårning
- Webhook-hantering för leveransstatus
- Automatisk tracking poller
- Notifikationssystem
- Datamodell för shipments

**Läs detta om du vill:**
- Implementera logistikintegration
- Förstå spårningsmekanismer
- Designa notifikationssystem

---

### ⚖️ Compliance och Regelefterlevnad

**[compliance/tax-and-regulations.md](./compliance/tax-and-regulations.md)**
- Moms (mervärdesskatt):
  - 25% svensk moms
  - Omvänd skattskyldighet (EU)
  - VIES-kontroll av VAT-nummer
- Punktskatt (alkoholskatt):
  - Skattesatser 2026
  - Beräkningsformler
  - EMCS för EU-import
- Total skatteberäkning (komplett exempel)
- Momsdeklaration och punktskattedeklaration
- Juridiska krav och licenser
- Dokumentation och arkivering (7 års bokföringskrav)
- Datamodell för tax_documents

**Läs detta om du vill:**
- Implementera skatteberäkningar
- Förstå regelkrav
- Säkerställa compliance

#### **[compliance/compliance-model-via-partner.md](./compliance/compliance-model-via-partner.md)** ⭐ **PRIMÄR MODELL**
- **Rekommenderad affärsmodell för MVP och skalning**
- Winefeed som teknisk och administrativ mellanhand
- Licensierad importörpartner hanterar all compliance
- Rollfördelning: Restaurang (köpare) → Winefeed (koordinator) → Importör (compliance) → EU-Producent (säljare)
- Komplett processflöde (7 steg)
- Juridisk struktur och avtalsrelationer
- Ansvarsfördelning (vem gör vad)
- API/dataflöde mot importör (med kod-exempel)
- Prissättning och kostnadsfördelning
- Val av importörpartner (kriterier)
- Implementationsplan (Fas 1-3)
- Datamodeller (importer_partners, importer_orders)

**Läs detta om du vill:**
- **Förstå hur Winefeed fungerar utan egen alkohollicens**
- **Se exakt hur samarbetet med importör fungerar**
- **Planera MVP-lansering**

#### **[compliance/multi-supplier-type-model.md](./compliance/multi-supplier-type-model.md)** ⭐ **UTÖKAD MODELL**
- **Stöd för både svenska importörer och EU-leverantörer i samma system**
- Leverantörstyper: SWEDISH_IMPORTER, EU_PRODUCER, EU_IMPORTER
- Automatisk beslutslogik för vilket regelverk som gäller
- Flöde för svenska vinimportörer (vin redan i Sverige, punktskatt betald)
- Flöde för EU-leverantörer (gränsöverskridande, uppskov via Brasri)
- SQL constraints och TypeScript validation per leverantörstyp
- Jämförelse: Domestic vs EU Direct Delivery
- Migration av befintliga leverantörer

**Läs detta om du vill:**
- **Förstå hur systemet hanterar både svenska och EU-leverantörer**
- **Se exakt vilka regler som gäller för varje leverantörstyp**
- **Implementera typ-baserad validering**

#### **[compliance/eu-import-direct-delivery.md](./compliance/eu-import-direct-delivery.md)** (Alternativ modell)
- EU-import och direktleveranser till restauranger
- Skatteverkets krav (baserat på officiellt svar ID:25MBSKV892314)
- "Godkänd mottagare" - Licensieringskrav om Winefeed blir importör själva
- "Direkt leveransplats" - Registrering av restauranger (kod 5369_03)
- EMCS-flöde (Excise Movement and Control System)
- Punktskattedeklaration för EU-import
- Initial investering och löpande kostnader (300-500k SEK initial + löpande)
- Datamodell för eu_imports

**Läs detta om du vill:**
- Förstå licensieringskrav för egen import (Fas 3)
- Utvärdera när egen licensiering blir lönsam (>100 orders/månad)

---

### 📊 Processflöden

**[flows/order-to-delivery-process.md](./flows/order-to-delivery-process.md)**
- Detaljerade sekvensdiagram för alla steg:
  1. Offertacceptans
  2. Leverantörskontakt
  3. Betalning
  4. Förberedelse och fraktbokning
  5. Transport och spårning
  6. Leverans
  7. Efterleverans
- Alternativa flöden (error handling)
- Tidslinjer (typiska tider för varje steg)
- Notifikationer till restaurang och leverantör
- Dashboard-vyer (mockups)

**Läs detta om du vill:**
- Se exakt vad som händer i varje steg
- Förstå felhantering
- Designa användargränssnitt

---

## Snabbnavigering

### För olika roller:

#### 🎯 Produktägare / Business
Start här:
1. [POST_OFFERT_ARCHITECTURE.md](./POST_OFFERT_ARCHITECTURE.md) - Översikt och vision
2. [order-to-delivery-process.md](./flows/order-to-delivery-process.md) - Se hela flödet
3. Kostnadsmodell i [POST_OFFERT_ARCHITECTURE.md](./POST_OFFERT_ARCHITECTURE.md#kostnadsmodell)

#### 💻 Utvecklare (Backend)
Start här:
1. [order-flow.md](./data-models/order-flow.md) - Datamodeller och schema
2. [payment-partners.md](./integrations/payment-partners.md) - Betalningsintegration
3. [logistics-partners.md](./integrations/logistics-partners.md) - Logistikintegration
4. [tax-and-regulations.md](./compliance/tax-and-regulations.md) - Skatteberäkningar

#### 🎨 Utvecklare (Frontend)
Start här:
1. [order-to-delivery-process.md](./flows/order-to-delivery-process.md) - Flöden och UX
2. Dashboard-vyer i [order-to-delivery-process.md](./flows/order-to-delivery-process.md#dashboard-vyer)
3. Notifikationer i [order-to-delivery-process.md](./flows/order-to-delivery-process.md#notifikationer-och-kommunikation)

#### ⚖️ Juridik / Compliance
Start här:
1. [tax-and-regulations.md](./compliance/tax-and-regulations.md) - Fullständig regelefterlevnad
2. Juridiska överväganden i [POST_OFFERT_ARCHITECTURE.md](./POST_OFFERT_ARCHITECTURE.md#juridiska-överväganden)
3. Säkerhet i [POST_OFFERT_ARCHITECTURE.md](./POST_OFFERT_ARCHITECTURE.md#säkerhet-och-compliance)

---

## Implementationsplan

### Fas 1: MVP (Q2 2026)

**Mål:** Fungerende end-to-end-flöde med manuella steg där automation saknas

**Komponenter:**
- ✅ Order Management System (grundfunktion)
- ✅ Betalning via Stripe (kortbetalningar)
- ✅ Manuell leverantörskontakt (email-baserad)
- ✅ DHL-integration för spårning
- ✅ Grundläggande skatteberäkning (svensk moms + punktskatt)
- ✅ PDF-generering (fakturor)

**Inte inkluderat i MVP:**
- Escrow/split payment (kommer Fas 2)
- Automatisk leverantörs-API (kommer Fas 2)
- Gränsöverskridande handel (kommer Fas 3)
- Fortnox/Visma-export (kommer Fas 2)

### Fas 2: Automation (Q3-Q4 2026)

**Mål:** Automatisera manuella steg och lägga till B2B-funktioner

**Komponenter:**
- ✅ API-integrationer mot 3 stora leverantörer
- ✅ Escrow och split payment (Stripe Connect)
- ✅ Automatisk momsrapportering
- ✅ Fortnox/Visma-export
- ✅ VinLog-integration (premium-leveranser)
- ✅ Email/SMS-notifikationer

### Fas 3: Full Platform (2027)

**Mål:** Komplett B2B-plattform med internationell räckvidd

**Komponenter:**
- ✅ Gränsöverskridande handel (EU)
- ✅ EMCS-integration för EU-import
- ✅ Multi-carrier logistik (smart routing)
- ✅ ML-baserad prognostisering
- ✅ Advanced analytics
- ✅ White-label-lösning för partners

---

## Nyckeltal och Metrics

### Operativa KPI:er

| Metric | Definition | Target (Year 1) |
|--------|------------|-----------------|
| **Order Success Rate** | % orders som når DELIVERED | >95% |
| **Time to Delivery** | Medeltid från offertacceptans till leverans | 3-5 dagar |
| **Payment Success Rate** | % betalningar som lyckas första försöket | >98% |
| **Supplier Response Time** | Medeltid för leverantörsbekräftelse | <4h |
| **Exception Rate** | % orders med problem (EXCEPTION, CANCELLED) | <5% |

### Business KPI:er

| Metric | Definition | Target (Year 1) |
|--------|------------|-----------------|
| **GMV (Gross Merchandise Value)** | Total ordervärde | 10M SEK |
| **Take Rate** | Winefeed:s provision (%) | 3-5% |
| **Repeat Purchase Rate** | % restauranger som beställer igen | >60% |
| **Average Order Value** | Genomsnittligt ordervärde | 5,000-10,000 SEK |
| **Orders per Month** | Antal orders per månad | 200-300 |

---

## Teknisk stack (rekommendation)

### Backend
- **Framework:** Next.js 14 (API Routes)
- **Database:** Supabase (PostgreSQL)
- **ORM:** Prisma eller Drizzle
- **Queue:** Vercel Cron + Upstash Redis
- **File Storage:** Cloudflare R2 eller AWS S3

### Integrationer
- **Betalning:** Stripe (primär), Klarna (sekundär)
- **Logistik:** DHL API
- **Email:** Resend eller SendGrid
- **SMS:** Twilio

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **State:** React Server Components + useState/useContext
- **Charts:** Recharts eller Tremor

### DevOps
- **Hosting:** Vercel
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry + Vercel Analytics
- **Logging:** Axiom eller Logtail

---

## Säkerhet och Compliance Checklist

- [ ] PCI DSS SAQ A (använd Stripe Elements)
- [ ] GDPR-compliance (DPA med partners, kryptering i vila)
- [ ] Alkohollicensverifiering (restaurangers serveringstillstånd)
- [ ] 7 års dokumentarkivering (bokföringslag)
- [ ] SSL/TLS för all kommunikation
- [ ] Rate limiting på API:er
- [ ] Webhook signature verification (Stripe, DHL)
- [ ] Audit logging för alla statusändringar
- [ ] Regular security audits
- [ ] Penetration testing (årligen)

---

## Kontakt och Support

**Dokumentägare:** Markus Nilsson
**Senast uppdaterad:** 2026-01-14
**Nästa review:** TBD

**För frågor:**
- Tekniska frågor: [Tech Lead TBD]
- Business-frågor: [Produktägare]
- Juridiska frågor: [Juridisk rådgivare TBD]

---

## Ändringslogg

### v1.2 - 2026-01-14 (slutlig uppdatering)
- **NY:** Dokumentation för regelefterlevnad via licensierad importörpartner ([compliance-model-via-partner.md](./compliance/compliance-model-via-partner.md)) ⭐ **PRIMÄR MODELL**
- Tydliggjord affärsmodell: Winefeed som koordinator, importörpartner hanterar compliance
- Komplett processflöde (7 steg från order till dokumentation)
- Juridisk struktur och ansvarsfördelning
- API/dataflöde mot importör med kod-exempel
- Prissättning och kostnadsfördelning
- Val av importörpartner och implementationsplan
- Datamodeller för importer_partners och importer_orders
- Uppdaterade referenser i POST_OFFERT_ARCHITECTURE.md och README.md

### v1.1 - 2026-01-14 (tidigare samma dag)
- **NY:** Dokumentation för EU-import och direktleveranser ([eu-import-direct-delivery.md](./compliance/eu-import-direct-delivery.md))
- Baserat på officiellt svar från Skatteverket (ID:25MBSKV892314)
- Förtydliganden om licensieringskrav för Winefeed
- Registrering av restauranger som "Direkt leveransplatser"
- EMCS-flöde och punktskattedeklaration för EU-import
- MVP-rekommendation: Samarbete med befintliga importörer
- Uppdaterade referenser i POST_OFFERT_ARCHITECTURE.md och tax-and-regulations.md

### v1.0 - 2026-01-14
- Initial konceptuell dokumentation
- Fullständig arkitektur och datamodeller
- Integrationsspecifikationer (Payment, Logistics)
- Compliance-dokumentation (Tax & Regulations)
- Processflödesdiagram

---

## Nästa steg

### Omedelbart (vecka 1-2)

1. **Kontakta licensierad importör (Brasri AB)**
   - Email: corentin@brasri.com
   - Boka möte för att diskutera samarbete
   - Presentera Winefeed-konceptet och affärsmodell

2. **Review av dokumentationen**
   - Gå igenom compliance-model-via-partner.md med teamet
   - Förstå ansvarsfördelning och processflöde
   - Identifiera kritiska komponenter att bygga

### Kort sikt (månad 1)

3. **Utarbeta samarbetsavtal med importör**
   - Definiera ansvarsfördelning
   - Prissättning och provision (förslag: 4% för importör, 5% för Winefeed)
   - SLA (service-level agreement)
   - Konsultera jurist

4. **Definiera integration mot importör**
   - API eller email-baserat?
   - Dataformat (se compliance-model-via-partner.md)
   - Webhook för status updates
   - Test environment

5. **Teknisk feasibility för andra integrationer**
   - Verifiera Stripe/betalningspartner
   - Verifiera DHL/logistikpartner (om ej hanteras av importör)
   - Dokumentgenerering (PDF-fakturor, bokföringsunderlag)

### Medellång sikt (månad 2-3)

6. **MVP-implementation**
   - Bygg integrationslager mot importör
   - Implementera orderflöde
   - Dokumentgenerering och status-tracking
   - Restaurang-dashboard

7. **Pilot med 3-5 restauranger**
   - Rekrytera pilotrestauranger
   - Onboarding och utbildning
   - Genomför 10-20 testorders
   - Samla feedback och iterera

8. **Utvärdera och optimera**
   - Analysera resultat från pilot
   - Förbättra UX baserat på feedback
   - Förfina processer
   - Förbered för skalning

---

**🚀 Redo att bygga framtidens B2B-vinplattform!**
