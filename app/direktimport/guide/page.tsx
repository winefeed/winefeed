import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'Direktimport av vin: komplett guide för svenska restauranger | Winefeed',
  description:
    'Steg-för-steg-guide för restauranger som vill direktimportera vin från europeiska producenter. Aktörer, juridik, kostnader, leveranstid och vanliga fallgropar.',
  keywords: [
    'direktimport vin guide',
    'privatimport vin steg för steg',
    'importera vin sverige',
    'köpa vin direkt från producent',
    'vin från frankrike restaurang',
    'partihandelstillstånd vin',
  ],
  openGraph: {
    title: 'Direktimport av vin: komplett guide för restauranger',
    description:
      'Steg-för-steg-guide för restauranger som vill direktimportera vin från Europa.',
    url: 'https://winefeed.se/direktimport/guide',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'article',
  },
  alternates: { canonical: 'https://www.winefeed.se/direktimport/guide' },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Direktimport av vin: komplett guide för svenska restauranger',
  description:
    'Steg-för-steg-guide för restauranger som vill direktimportera vin från europeiska producenter.',
  image: 'https://winefeed.se/og-direktimport-guide.png',
  datePublished: '2026-04-29',
  dateModified: '2026-04-29',
  author: { '@type': 'Organization', name: 'Winefeed' },
  publisher: {
    '@type': 'Organization',
    name: 'Winefeed',
    logo: { '@type': 'ImageObject', url: 'https://winefeed.se/winefeed-logo-light.svg' },
  },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://winefeed.se/direktimport/guide' },
  inLanguage: 'sv-SE',
};

export default function GuidePage() {
  return (
    <div className="bg-[#fbfaf7] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <EditorialHeader />
      <main className="max-w-[820px] mx-auto px-5 sm:px-8 py-12 md:py-16">
        <Link
          href="/direktimport"
          className="inline-block text-[13px] text-[#722F37] hover:underline mb-6"
        >
          ← Direktimport
        </Link>

        <p className="text-[11px] uppercase tracking-[0.22em] text-[#722F37] font-semibold mb-3">
          Guide · 8 min läsning
        </p>
        <h1 className="font-[family-name:var(--font-playfair)] text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-6">
          Direktimport av vin: komplett guide för svenska restauranger
        </h1>
        <p className="text-[18px] leading-[1.55] text-[#828181] mb-12">
          Att köpa vin direkt från en europeisk producent kan ge bättre marginaler, unika viner och starkare relationer. Men processen är inte uppenbar för den som inte gjort det förut. Här är hur det faktiskt fungerar.
        </p>

        <Section heading="Vad är direktimport av vin?">
          <p>
            Direktimport innebär att en restaurang köper vin direkt från en producent i ett annat land, istället för via en svensk grossist som mellanhand. Vinet importeras till Sverige av en partihandlare med svenskt partihandelstillstånd, som hanterar alkoholskatt, dokumentation och leverans till restaurangen.
          </p>
          <p>
            För restaurangen påverkar det främst pris och utbud. Eftersom den klassiska grossistmarginalen tas bort kan slutpriset bli lägre. Utbudet öppnas också upp mot mindre producenter som inte är representerade på den svenska marknaden.
          </p>
        </Section>

        <Section heading="Vilka aktörer är inblandade?">
          <p>Tre parter samverkar i en direktimportaffär:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Producenten</strong>: vinmakaren i ursprungslandet, som säljer ex cellar (från sitt lager) i euro.
            </li>
            <li>
              <strong>Importören</strong>: den svenska partihandlaren med partihandelstillstånd. Ansvarar för transport, alkoholskatt, tull, dokumentation och faktura till restaurangen.
            </li>
            <li>
              <strong>Restaurangen</strong>: köpare med serveringstillstånd. Beställer från importören, betalar enligt offert.
            </li>
          </ul>
          <p>
            Restaurangen behöver alltså inte ett eget partihandelstillstånd. Importen sker alltid via en partner som har det formella ansvaret.
          </p>
        </Section>

        <Section heading="Steg-för-steg: hur en direktimport går till">
          <ol className="list-decimal pl-6 space-y-3">
            <li>
              <strong>Hitta producenten.</strong> Antingen via en plattform som Winefeed, via mässor (Wine Paris, ProWein, Vinitaly) eller via egen research. Be om prislista i euro och ex cellar-priser.
            </li>
            <li>
              <strong>Räkna på totalkostnaden.</strong> Producentpriset är bara början. Frakt, alkoholskatt, importörspåslag och moms tillkommer. Använd vår{' '}
              <Link href="/direktimport/kalkylator" className="text-[#722F37] underline hover:no-underline">
                direktimport-kalkylator
              </Link>
              {' '}för att uppskatta slutpriset.
            </li>
            <li>
              <strong>Skicka förfrågan via importör.</strong> Importören kontrollerar att producenten kan leverera, räknar på frakt och kollin, och svarar med en bindande offert.
            </li>
            <li>
              <strong>Bekräfta order och leverans.</strong> När du accepterar offerten beställer importören från producenten, hanterar transport och alkoholbeskattning, och levererar till din restaurang.
            </li>
            <li>
              <strong>Faktura och betalning.</strong> Importören fakturerar restaurangen som vid vanlig grossistförsäljning. Betalningsvillkor brukar vara 20–30 dagar netto.
            </li>
          </ol>
        </Section>

        <Section heading="Vad ingår i kostnaden?">
          <p>Slutpriset till restaurangen är summan av:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Producentens ex cellar-pris</strong> i EUR per flaska.</li>
            <li><strong>Frakt</strong> till Sverige, ofta uttryckt per flaska eller per kolli.</li>
            <li><strong>Alkoholskatt</strong> (punktskatt). Cirka 28 kr per liter för stilla vin 8,5–15 % alkohol.</li>
            <li><strong>Importörspåslag</strong>. Branschuppskattning 12–25 %.</li>
            <li><strong>25 % moms</strong> (avdragsgill för restaurangen).</li>
          </ul>
          <p>
            Tullavgift inom EU är vanligen 0 % på vin. Vid import från tredjeland (USA, Sydafrika, Australien etc.) kan tullavgift och CN-deklaration tillkomma.
          </p>
        </Section>

        <Section heading="När är direktimport värt det?">
          <p>Direktimport blir oftast lönsamt vid:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Mindre producenter</strong> som inte finns hos svensk grossist. Här är direktimport ofta enda vägen.</li>
            <li><strong>Större volymer</strong> där fasta kostnader (frakt, dokumentation) fördelas på fler flaskor.</li>
            <li><strong>Långsiktiga relationer</strong> där restaurangen vill bygga ett unikt sortiment som konkurrenter inte kan kopiera.</li>
          </ul>
          <p>
            För enstaka flaskor eller vid producenter som redan finns på svenska marknaden är direktimport sällan värt komplexiteten. Då räcker det att ringa grossisten.
          </p>
        </Section>

        <Section heading="Leveranstid och planering">
          <p>
            Direktimport tar normalt 7–14 dagar från beställning till leverans, jämfört med 1–3 dagar för svensk grossist. Anledningen är att vinet ofta måste hämtas från producenten, samlas i container, transporteras till Sverige och tullbehandlas.
          </p>
          <p>
            Planera därför direktimport för viner som inte behövs akut. För säsongsmenyer och evenemang: lägg ordern minst tre veckor innan.
          </p>
        </Section>

        <Section heading="Vanliga fallgropar">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Räkna inte bara ex cellar-priset.</strong> Producentens 8 euro per flaska blir snabbt 130 kr i Sverige efter alla pålägg. Använd kalkylatorn innan du jämför mot grossist.
            </li>
            <li>
              <strong>Glöm inte minimivolymer.</strong> Många producenter säljer bara hela kollin eller paletter. Importören kan ibland slå ihop ordrar med andra restauranger.
            </li>
            <li>
              <strong>Räkna med valutarisk.</strong> EUR-kursen kan röra sig 5–10 % mellan offert och leverans. Importören brukar ta höjd för det i sitt påslag.
            </li>
            <li>
              <strong>Verifiera importörens partihandelstillstånd.</strong> Restaurangens köp får bara ske från en partner med giltigt tillstånd. På Winefeed är alla anslutna importörer verifierade.
            </li>
          </ul>
        </Section>

        <Section heading="Hur Winefeed förenklar direktimport">
          <p>
            Winefeed kopplar svenska restauranger med europeiska producenter via etablerade importörer. Du beskriver vad du söker (region, druva, prisspann) och plattformen matchar mot importörer som antingen har vinet på lager eller kan sourcea det direkt från producent.
          </p>
          <p>
            Du får offert med bindande totalpris, slipper hantera tull och alkoholskatt själv, och kan jämföra flera importörer för samma vin. Det är gratis att registrera och gratis att begära offert. Winefeed tar 4 % i provision på accepterade ordrar, bara när affären faktiskt händer.
          </p>
        </Section>

        {/* CTA */}
        <div className="mt-12 bg-[#4A1A1F] text-white rounded-2xl p-8 md:p-10">
          <h2 className="font-[family-name:var(--font-playfair)] text-[28px] md:text-[34px] leading-[1.1] mb-3">
            Räkna eller registrera
          </h2>
          <p className="text-[16px] leading-[1.6] text-white/80 mb-6">
            Använd kalkylatorn för att uppskatta kostnad innan du börjar. Eller skapa konto och börja jämföra offerter direkt.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/direktimport/kalkylator"
              className="inline-flex items-center justify-center h-[48px] px-6 rounded-[10px] bg-white text-[#722F37] text-[15px] font-medium hover:bg-white/90 transition-colors"
            >
              Öppna kalkylatorn
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-[48px] px-6 rounded-[10px] bg-transparent text-white border border-white/40 text-[15px] font-medium hover:border-white hover:bg-white/8 transition-colors"
            >
              Skapa restaurangkonto
            </Link>
          </div>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-[family-name:var(--font-playfair)] text-[28px] md:text-[34px] leading-[1.15] text-[#161412] mb-4">
        {heading}
      </h2>
      <div className="text-[17px] leading-[1.65] text-[#161412] space-y-4">{children}</div>
    </section>
  );
}
