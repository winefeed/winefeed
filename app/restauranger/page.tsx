import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'För restauranger — Sök vin, jämför offerter, beställ',
  description:
    'Winefeed hjälper restauranger, hotell och vinbarer att hitta rätt vin. Sök bland 500+ viner med tyngdpunkt på direktimport från Europa, jämför offerter från importörer och välj det som passar.',
  keywords: ['vin restaurang', 'vininköp', 'vinleverantör', 'jämför vinpriser', 'begär offert vin', 'B2B vin', 'horeca vin'],
  openGraph: {
    title: 'Winefeed för restauranger — Professionella vininköp',
    description:
      'Slipp mejlkarusellen. Sök, jämför och beställ vin direkt från importörer via Winefeed.',
    url: 'https://winefeed.se/restauranger',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Winefeed för restauranger — Professionella vininköp',
    description: 'Slipp mejlkarusellen. Sök, jämför och beställ vin direkt från importörer.',
  },
  alternates: {
    canonical: 'https://winefeed.se/restauranger',
  },
};

const webPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Winefeed för restauranger',
  url: 'https://winefeed.se/restauranger',
  description:
    'Winefeed hjälper restauranger, hotell och vinbarer att hitta rätt vin. Sök bland 500+ viner med tyngdpunkt på direktimport från Europa, jämför offerter från importörer och välj det som passar.',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Winefeed',
    url: 'https://winefeed.se',
  },
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', 'h2', '.speakable'],
  },
};

export default function RestaurangerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <div className="bg-[#fbfaf7] text-[#161412] font-[family-name:var(--font-inter)]">
        <EditorialHeader />

        {/* HERO */}
        <section className="py-16 md:py-24">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 bg-[#f2e2b6] text-[#722F37] py-1.5 px-3.5 rounded-full text-xs font-medium tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#722F37]" />
                  För restauranger
                </span>
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#828181] font-medium">Source &amp; Serve</span>
              </div>
              <h1
                className="font-[family-name:var(--font-playfair)] font-normal leading-[0.98] tracking-[-0.022em] max-w-[18ch]"
                style={{ fontSize: 'clamp(48px, 6vw, 76px)' }}
              >
                Vinlistan möter sin <em className="italic text-[#722F37]">importör.</em>
              </h1>
              <p className="speakable font-[family-name:var(--font-playfair)] italic text-[22px] leading-[1.45] max-w-[60ch]">
                Sök bland 500+ viner — direktimport från europeiska producenter och utbud från svenska specialistimportörer. Begär offert, jämför svar, välj. Slipp mejlkarusellen.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-[#722F37] text-white text-[15px] font-medium hover:bg-[#6B1818] transition-colors"
                >
                  Skapa restaurangkonto
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-white text-[#722F37] border border-[#d8d4d3] text-[15px] font-medium hover:border-[#722F37] transition-colors"
                >
                  Så funkar det
                </a>
              </div>
              <div className="flex flex-wrap gap-x-12 gap-y-5 mt-6">
                <Stat num="615" label="Aktiva viner" />
                <Stat num="213" label="Producenter" />
                <Stat num="519" label="Direktimporterade" />
              </div>
            </div>

            {/* Visual: search prompt mockup */}
            <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-3xl p-8 lg:p-10 shadow-[0_4px_16px_rgba(22,20,18,0.04)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#828181] font-medium mb-3">Exempel på förfrågan</p>
              <div className="font-[family-name:var(--font-playfair)] italic text-[22px] leading-[1.4] text-[#161412] mb-6">
                &ldquo;Chablis under 200 kr ex moms för aperitiven, minst 12 flaskor, helst med leverans inom veckan.&rdquo;
              </div>
              <div className="border-t border-[#d8d4d3] pt-5 flex flex-col gap-3">
                <Row left="3 importörer matchar" right="svar inom 24h" />
                <Row left="Bästa offert" right="178 kr / fl · franco" emphasis />
                <Row left="Andra offerten" right="185 kr / fl · 5 dgr" />
                <Row left="Tredje offerten" right="192 kr / fl · provflaska" />
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <div className="border-y border-[rgba(22,20,18,0.08)] bg-white py-7">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 flex flex-wrap items-center gap-x-14 gap-y-5 justify-between">
            <TrustItem num="615" label="aktiva viner" />
            <TrustItem num="213" label="producenter" />
            <TrustItem num="95" label="Saint-Émilion Grand Cru" />
            <TrustItem num="Gratis" label="för restauranger · alltid" />
          </div>
        </div>

        {/* PROBLEM → SOLUTION */}
        <section className="py-24 md:py-30 bg-[#fbfaf7]">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
            <div className="text-center max-w-[720px] mx-auto mb-16 flex flex-col gap-4 items-center">
              <p className="text-xs uppercase tracking-[0.22em] text-[#722F37] font-medium m-0">Det gamla sättet</p>
              <h2
                className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em]"
                style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
              >
                Vininköp ska inte vara en heltidssyssla.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ProblemCard
                title="För många kontakter"
                body="Att hålla reda på 15 importörers prislistor — manuellt — är inte sommelier-arbete. Det är admin."
              />
              <ProblemCard
                title="Svårt att jämföra"
                body="Varje importör har sitt eget format, sina egna villkor. Ingen färdig vy för pris × leveranstid × MOQ."
              />
              <ProblemCard
                title="Saker faller mellan stolarna"
                body="Mail i fel inkorg, glömda offerter, ofullständiga prisbilder. Förfrågan dör ofta i tråden."
              />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="py-24 md:py-30 bg-[#f2e2b6]">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
            <div className="text-center max-w-[720px] mx-auto mb-16 flex flex-col gap-4 items-center">
              <p className="text-xs uppercase tracking-[0.22em] text-[#722F37] font-medium m-0">Så funkar det</p>
              <h2
                className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em]"
                style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
              >
                Tre steg till rätt vin.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Step
                num="1."
                title="Beskriv vad du söker"
                body="Stil, tillfälle, budget, antal flaskor. Eller filtrera direkt på druva, region, pris och färg — 615 viner i katalogen."
              />
              <Step
                num="2."
                title="Få offerter inom dygnet"
                body="Importörerna offererar — du jämför pris, leveranstid och provflaska sida vid sida. Inget mejlande, ingen prislistor-jakt."
              />
              <Step
                num="3."
                title="Acceptera och beställ"
                body="Ett klick. Importören levererar direkt till dig — vi sköter administrationen. Faktura kommer från importören, som vanligt."
              />
            </div>
          </div>
        </section>

        {/* QUOTE */}
        <section className="py-24 md:py-30 bg-[#fbfaf7]">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
            <blockquote
              className="m-0 max-w-[880px] mx-auto text-center font-[family-name:var(--font-playfair)] leading-[1.25] tracking-[-0.01em] text-[#161412]"
              style={{ fontSize: 'clamp(28px, 3vw, 42px)' }}
            >
              <span className="block text-[80px] text-[#f1b4b0] leading-[0.4] h-10 mb-6">&ldquo;</span>
              Vi sparar 4 timmar i veckan på <em className="italic text-[#722F37]">offerthantering</em> — och hittar bättre priser. Det här borde funnits för länge sedan.
            </blockquote>
            <p className="text-center mt-8 text-sm text-[#828181]">
              <strong className="text-[#161412] font-medium">Sommelier</strong> · Stockholmsrestaurang · anonym
            </p>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-24 md:py-30 bg-[#4A1A1F] text-white text-center">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 max-w-[760px] flex flex-col gap-7 items-center">
            <p className="text-xs uppercase tracking-[0.22em] font-medium m-0 text-[#f1b4b0]">Kom igång</p>
            <h2
              className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em] max-w-[18ch] text-white"
              style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
            >
              Verifierat företagskonto<br />på under fem minuter.
            </h2>
            <p className="text-[17px] leading-[1.6] max-w-[52ch] text-white/[0.78]">
              Vi godkänner manuellt — bara restauranger, hotell och vinbarer. Inga privatpersoner, inga skuggkonton. Gratis att registrera, gratis att söka, gratis att begära offert.
            </p>
            <div className="flex gap-3 flex-wrap justify-center mt-2">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-white text-[#722F37] text-[15px] font-medium hover:bg-white/90 transition-colors"
              >
                Skapa restaurangkonto
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-transparent text-white border border-white/40 text-[15px] font-medium hover:border-white hover:bg-white/8 transition-colors"
              >
                Logga in
              </Link>
            </div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#f1b4b0] font-medium mt-4">
              Frågor? Maila <a href="mailto:hej@winefeed.se" className="underline">hej@winefeed.se</a>
            </p>
            <p className="text-[13px] text-white/70 mt-3">
              Funderar på direktimport?{' '}
              <Link href="/direktimport/kalkylator" className="text-white underline hover:text-[#f1b4b0]">
                Räkna ut totalkostnaden
              </Link>
              {' '}innan du registrerar dig.
            </p>
          </div>
        </section>

        <EditorialFooter />
      </div>
    </>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div>
      <span className="font-[family-name:var(--font-playfair)] text-[44px] leading-none text-[#722F37] block">{num}</span>
      <div className="text-[13px] text-[#828181] mt-1.5">{label}</div>
    </div>
  );
}

function TrustItem({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-[family-name:var(--font-playfair)] text-[28px] text-[#722F37]">{num}</span>
      <span className="text-[13px] text-[#828181]">{label}</span>
    </div>
  );
}

function Row({ left, right, emphasis }: { left: string; right: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={emphasis ? 'text-[#161412] font-medium' : 'text-[#828181]'}>{left}</span>
      <span
        className={
          emphasis
            ? 'font-mono font-semibold text-[#6B1818] bg-[#f1b4b0] px-2 py-0.5 rounded-md text-[13px]'
            : 'font-mono text-[#722F37] text-[13px]'
        }
      >
        {right}
      </span>
    </div>
  );
}

function ProblemCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl p-8 flex flex-col gap-3">
      <h3 className="font-[family-name:var(--font-playfair)] text-2xl text-[#161412]">{title}</h3>
      <p className="text-[15px] leading-[1.55] text-[#828181] m-0">{body}</p>
    </div>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl p-8 flex flex-col gap-3.5">
      <div className="font-[family-name:var(--font-playfair)] text-[88px] leading-[0.9] text-[#722F37] tracking-[-0.03em]">
        {num}
      </div>
      <h4 className="font-[family-name:var(--font-playfair)] text-2xl text-[#161412]">{title}</h4>
      <p className="text-[15px] leading-[1.55] text-[#828181] m-0">{body}</p>
    </div>
  );
}
