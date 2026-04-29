import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'Alkoholskatt på vin i Sverige 2026: så räknar du | Winefeed',
  description:
    'Alkoholskatten på vin i Sverige förklarad. Aktuella satser per liter, hur skatten beräknas och hur den påverkar slutpriset på direktimporterat vin.',
  keywords: [
    'alkoholskatt vin sverige 2026',
    'punktskatt vin',
    'alkoholskatt per liter vin',
    'skatt vin import sverige',
    'alkoholskatt mousserande',
    'alkoholskatt starkvin',
  ],
  openGraph: {
    title: 'Alkoholskatt på vin i Sverige 2026',
    description:
      'Aktuella punktskatte-satser, hur skatten beräknas och hur den påverkar slutpriset på direktimporterat vin.',
    url: 'https://winefeed.se/direktimport/alkoholskatt',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'article',
  },
  alternates: { canonical: 'https://winefeed.se/direktimport/alkoholskatt' },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Alkoholskatt på vin i Sverige 2026: så räknar du',
  description:
    'Aktuella punktskatte-satser för vin i Sverige, hur skatten beräknas och hur den påverkar slutpriset.',
  datePublished: '2026-04-29',
  dateModified: '2026-04-29',
  author: { '@type': 'Organization', name: 'Winefeed' },
  publisher: {
    '@type': 'Organization',
    name: 'Winefeed',
    logo: { '@type': 'ImageObject', url: 'https://winefeed.se/winefeed-logo-light.svg' },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': 'https://winefeed.se/direktimport/alkoholskatt',
  },
  inLanguage: 'sv-SE',
};

export default function AlkoholskattPage() {
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
          Fakta · 5 min läsning
        </p>
        <h1 className="font-[family-name:var(--font-playfair)] text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-6">
          Alkoholskatt på vin i Sverige
        </h1>
        <p className="text-[18px] leading-[1.55] text-[#828181] mb-12">
          Sverige tar ut alkoholskatt (punktskatt) på allt vin som importeras eller säljs i landet. För restauranger som överväger direktimport är det här en av de stora kostnadsposterna att räkna med.
        </p>

        <Section heading="Hur fungerar alkoholskatt på vin?">
          <p>
            Alkoholskatt är en punktskatt som tas ut per liter av den importerade volymen. Den betalas av importören när vinet förs in i Sverige (eller släpps från ett skatteupplag). Slutkonsumenten, i det här fallet restaurangen, får skatten inbakad i fakturapriset.
          </p>
          <p>
            Skattesatsen varierar beroende på vintyp och alkoholhalt. Lagrum: <em>Lag (1994:1564) om alkoholskatt</em>.
          </p>
        </Section>

        <Section heading="Aktuella satser för vin (riktvärden 2025–2026)">
          <div className="overflow-x-auto bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-[#fbfaf7] text-[#828181] uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kategori</th>
                  <th className="text-left px-4 py-3 font-medium">Alkoholhalt</th>
                  <th className="text-right px-4 py-3 font-medium">Skatt per liter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(22,20,18,0.08)]">
                <tr>
                  <td className="px-4 py-3 font-medium text-[#161412]">Lättvin</td>
                  <td className="px-4 py-3 text-[#828181]">≤ 8,5 %</td>
                  <td className="px-4 py-3 text-right tabular-nums">~9 kr</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[#161412]">Stilla vin</td>
                  <td className="px-4 py-3 text-[#828181]">8,5–15 %</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">~28 kr</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[#161412]">Mousserande</td>
                  <td className="px-4 py-3 text-[#828181]">8,5–15 %</td>
                  <td className="px-4 py-3 text-right tabular-nums">~28 kr</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[#161412]">Starkvin</td>
                  <td className="px-4 py-3 text-[#828181]">15–22 %</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">~53 kr</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[#828181] mt-3">
            Riktvärden, kontrollera aktuella satser hos{' '}
            <a
              href="https://www.skatteverket.se/foretag/skatterochavdrag/punktskatter/alkoholskatt.4.34c4cf2c14d4742be4cb4b.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#722F37] underline"
            >
              Skatteverket
            </a>
            {' '}innan kalkyl används skarpt.
          </p>
        </Section>

        <Section heading="Räkna ut skatten på en flaska">
          <p>
            Skatten beräknas på flaskvolymen, inte på alkoholmängden eller priset. För en standardflaska 750 ml blir det:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Stilla vin (12 %):</strong> 0,75 L × 28 kr/L ≈ <strong>21 kr per flaska</strong></li>
            <li><strong>Mousserande (12 %):</strong> 0,75 L × 28 kr/L ≈ <strong>21 kr per flaska</strong></li>
            <li><strong>Starkvin (18 %):</strong> 0,75 L × 53 kr/L ≈ <strong>40 kr per flaska</strong></li>
          </ul>
          <p>
            Vid magnumflaskor (1,5 L) dubbleras alkoholskatten. Vid halvflaskor (375 ml) halveras den.
          </p>
        </Section>

        <Section heading="Hur påverkar skatten slutpriset?">
          <p>
            För ett typiskt direktimporterat vin med 8 EUR ex cellar-pris (cirka 92 kr i SEK) blir alkoholskatten på cirka 21 kr per flaska en av de större kostnadsposterna efter producentpriset. Den motsvarar ofta 12–18 % av slutpriset till restaurangen.
          </p>
          <p>
            Eftersom skatten är fix per liter och inte procentuell, slår den proportionellt hårdare på billiga viner. Ett vin med 4 EUR ex cellar och ett vin med 16 EUR ex cellar betalar samma skattekrona, men skatten utgör en mycket större andel av slutpriset på det billigare vinet.
          </p>
          <p>
            Det här är en av anledningarna till att direktimport ofta lönar sig bäst i mellan- och premiumsegmentet snarare än i absolut billigaste prisklassen.
          </p>
        </Section>

        <Section heading="Andra avgifter att räkna med">
          <p>Förutom alkoholskatt tillkommer:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Tullavgift</strong>: 0 % inom EU, kan tillkomma vid import från USA, Sydafrika, Australien m.fl.</li>
            <li><strong>Importörspåslag</strong>: branschuppskattning 12–25 %.</li>
            <li><strong>Moms</strong>: 25 % (avdragsgill för restaurangen).</li>
          </ul>
          <p>
            Allt detta räknas tillsammans i vår{' '}
            <Link href="/direktimport/kalkylator" className="text-[#722F37] underline hover:no-underline">
              direktimport-kalkylator
            </Link>
            , så du kan se hur slutpriset byggs upp för just ditt vin.
          </p>
        </Section>

        {/* CTA */}
        <div className="mt-12 bg-[#fbfaf7] border border-[rgba(22,20,18,0.08)] rounded-2xl p-8">
          <h2 className="font-[family-name:var(--font-playfair)] text-[26px] leading-[1.15] text-[#161412] mb-3">
            Räkna på din direktimport
          </h2>
          <p className="text-[16px] leading-[1.55] text-[#828181] mb-5">
            Vill du se hur alkoholskatten påverkar just ditt vin? Använd kalkylatorn för att räkna ut slutpriset i Sverige.
          </p>
          <Link
            href="/direktimport/kalkylator"
            className="inline-flex items-center justify-center h-[44px] px-5 rounded-[10px] bg-[#722F37] text-white text-[14px] font-medium hover:bg-[#6B1818] transition-colors"
          >
            Öppna kalkylatorn →
          </Link>
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
