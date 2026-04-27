import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'För importörer — Nå svenska restauranger via Winefeed',
  description:
    'Winefeed kopplar importörer med svenska restauranger som söker nya viner. Ta emot förfrågningar, svara med offert. 4 % success-fee på accepterade ordrar — gratis att lista sig.',
  keywords: ['vinimportör', 'vinleverantör', 'restaurangkunder', 'sälja vin B2B', 'vin grossist', 'horeca leverantör'],
  openGraph: {
    title: 'Winefeed för importörer — Nå restauranger som söker vin',
    description:
      'Gratis att lista sig. Ta emot förfrågningar från restauranger och svara med offert. 4 % success-fee på accepterade ordrar.',
    url: 'https://winefeed.se/leverantorer',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Winefeed för importörer — Nå restauranger som söker vin',
    description: 'Gratis att lista sig. Ta emot förfrågningar och svara med offert. 4 % success-fee.',
  },
  alternates: {
    canonical: 'https://winefeed.se/leverantorer',
  },
};

const webPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Winefeed för importörer',
  url: 'https://winefeed.se/leverantorer',
  description:
    'Winefeed kopplar importörer med svenska restauranger som aktivt söker nya viner. Ta emot förfrågningar, svara med offert och leverera.',
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

export default function LeverantorerPage() {
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
                  För importörer
                </span>
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#828181] font-medium">Source &amp; Serve</span>
              </div>
              <h1
                className="font-[family-name:var(--font-playfair)] font-normal leading-[0.98] tracking-[-0.022em] max-w-[16ch]"
                style={{ fontSize: 'clamp(48px, 6vw, 76px)' }}
              >
                Möt restauranger <em className="italic text-[#722F37]">redo att köpa.</em>
              </h1>
              <p className="speakable font-[family-name:var(--font-playfair)] italic text-[22px] leading-[1.45] max-w-[60ch]">
                Verifierade svenska restauranger lägger förfrågningar — du svarar med offert. Du betalar bara när det blir affär. 4 % success-fee. Inga prenumerationer, ingen onboarding-avgift.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/signup?role=supplier"
                  className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-[#722F37] text-white text-[15px] font-medium hover:bg-[#6B1818] transition-colors"
                >
                  Ansök som importör
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-white text-[#722F37] border border-[#d8d4d3] text-[15px] font-medium hover:border-[#722F37] transition-colors"
                >
                  Så funkar det
                </a>
              </div>
              <div className="flex flex-wrap gap-x-12 gap-y-5 mt-6">
                <Stat num="4 %" label="Success-fee" />
                <Stat num="149 kr" label="Min-fee per order" />
                <Stat num="1 995 kr" label="Max-fee per order" />
              </div>
            </div>

            {/* Visual: incoming request mockup */}
            <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-3xl p-8 lg:p-10 shadow-[0_4px_16px_rgba(22,20,18,0.04)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#828181] font-medium mb-3">Inkommande förfrågan</p>
              <div className="font-[family-name:var(--font-playfair)] italic text-[22px] leading-[1.4] text-[#161412] mb-3">
                &ldquo;Mineralisk Riesling till provningsmenyn, 24 fl, leverans v.18.&rdquo;
              </div>
              <p className="text-sm text-[#828181] mb-6">Restaurang X · Stockholm · verifierad</p>
              <div className="border-t border-[#d8d4d3] pt-5 flex flex-col gap-3">
                <Row left="Stil" right="Mineralisk · torr · medium" />
                <Row left="Antal" right="24 flaskor" />
                <Row left="Leverans" right="vecka 18" />
                <Row left="Budget" right="≤ 220 kr / fl" emphasis />
              </div>
              <button className="w-full mt-6 inline-flex items-center justify-center h-11 rounded-[10px] bg-[#722F37] text-white text-sm font-medium hover:bg-[#6B1818] transition-colors">
                Skicka offert
              </button>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <div className="border-y border-[rgba(22,20,18,0.08)] bg-white py-7">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 flex flex-wrap items-center gap-x-14 gap-y-5 justify-between">
            <TrustItem num="Gratis" label="att lista sig & ta emot förfrågningar" />
            <TrustItem num="4 %" label="success-fee · bara på accepterade" />
            <TrustItem num="Månadsvis" label="fakturering i efterskott" />
            <TrustItem num="Verifierade" label="endast restauranger med tillstånd" />
          </div>
        </div>

        {/* WHY */}
        <section className="py-24 md:py-30 bg-[#fbfaf7]">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
            <div className="text-center max-w-[720px] mx-auto mb-16 flex flex-col gap-4 items-center">
              <p className="text-xs uppercase tracking-[0.22em] text-[#722F37] font-medium m-0">Varför Winefeed</p>
              <h2
                className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em]"
                style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
              >
                Sluta jaga, börja svara.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ValueCard
                title="Bara verifierade köpare"
                body="Vi godkänner manuellt — bara restauranger, hotell och vinbarer med giltigt serveringstillstånd. Ingen kall outreach behövs."
              />
              <ValueCard
                title="Strukturerade förfrågningar"
                body="Restaurangen specificerar stil, budget och kvantitet i förväg. Du svarar på samma format. Inga otydliga mejltrådar."
              />
              <ValueCard
                title="Du betalar bara när du säljer"
                body="4 % success-fee på accepterade offerter. Min 149 kr, max 1 995 kr per order. Faktureras månadsvis i efterskott."
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
                Tre steg från katalog till affär.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Step
                num="1."
                title="Lägg upp ditt sortiment"
                body="Importera prislista — eller låt oss hjälpa till. Du syns för verifierade restauranger i hela Sverige, sökbar på druva, region och stil."
              />
              <Step
                num="2."
                title="Få förfrågningar att svara på"
                body="Restauranger lägger förfrågningar — du får dem direkt i inkorgen. Svara med offert, provflaska eller pass om det inte passar."
              />
              <Step
                num="3."
                title="Betala bara när du säljer"
                body="4 % success-fee på accepterade offerter. Inga prenumerationer, ingen onboarding-avgift. Faktura kommer månadsvis i efterskott."
              />
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="py-24 bg-[#4A1A1F] text-white">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] font-medium m-0 text-[#f1b4b0]">Pris</p>
              <h2
                className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em] mt-4 max-w-[16ch] text-white"
                style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
              >
                Fyra procent. Inget annat.
              </h2>
              <p className="text-[17px] leading-[1.6] mt-5 max-w-[44ch] text-white/[0.78]">
                Ingen kostnad för att vara ansluten. Ingen prenumeration. Inga setup-avgifter. Du betalar bara success-fee på offerter som restaurangen accepterar.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/15 rounded-2xl overflow-hidden">
              <BreakdownItem label="Att lista sig" value="Gratis" desc="Skapa konto, lägg upp katalog, ta emot förfrågningar." />
              <BreakdownItem
                label="Per accepterad offert"
                value={
                  <>
                    <em className="italic">4 %</em> fee
                  </>
                }
                desc="Av netto-ordersumma ex moms."
              />
              <BreakdownItem label="Min-fee" value="149 kr" desc="Lägsta success-fee per order, oavsett ordervärde." />
              <BreakdownItem label="Max-fee" value="1 995 kr" desc="Taket. På större orders blir success-fee under 4 %." />
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-24 md:py-30 bg-[#fbfaf7] text-center">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 max-w-[760px] flex flex-col gap-7 items-center">
            <p className="text-xs uppercase tracking-[0.22em] text-[#722F37] font-medium m-0">Kom igång</p>
            <h2
              className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em] max-w-[18ch]"
              style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
            >
              Vi är ett litet team — hör av er.
            </h2>
            <p className="text-[17px] leading-[1.6] max-w-[52ch] text-[#828181]">
              Är ni etablerad importör med katalog redo att lista? Eller en producent som söker svensk distribution? Ansök så återkommer vi inom dagen.
            </p>
            <div className="flex gap-3 flex-wrap justify-center mt-2">
              <Link
                href="/signup?role=supplier"
                className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-[#722F37] text-white text-[15px] font-medium hover:bg-[#6B1818] transition-colors"
              >
                Ansök som importör
              </Link>
              <a
                href="mailto:hej@winefeed.se"
                className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-white text-[#722F37] border border-[#d8d4d3] text-[15px] font-medium hover:border-[#722F37] transition-colors"
              >
                Maila oss
              </a>
            </div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#828181] font-medium mt-4">
              Frågor? Maila <a href="mailto:hej@winefeed.se" className="text-[#722F37]">hej@winefeed.se</a>
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

function ValueCard({ title, body }: { title: string; body: string }) {
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

function BreakdownItem({ label, value, desc }: { label: string; value: React.ReactNode; desc: string }) {
  return (
    <div className="bg-[#4A1A1F] p-7">
      <span className="text-[11px] uppercase tracking-[0.22em] text-white/55 font-medium block mb-2.5">{label}</span>
      <div className="font-[family-name:var(--font-playfair)] text-[36px] leading-none text-[#f1b4b0]">{value}</div>
      <p className="text-[13px] text-white/65 mt-2 leading-[1.5] m-0">{desc}</p>
    </div>
  );
}
