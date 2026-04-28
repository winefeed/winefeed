import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'Om oss — Winefeed',
  description:
    'Winefeed är en sluten B2B-marknadsplats där svenska restauranger hittar vin och importörer hittar köpare. Source & Serve.',
  alternates: { canonical: 'https://winefeed.se/om-oss' },
  openGraph: {
    title: 'Om Winefeed — Source & Serve',
    description:
      'Sluten B2B-marknadsplats för restauranger och importörer. Byggd i Stockholm.',
    url: 'https://winefeed.se/om-oss',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'website',
  },
};

export default function OmOssPage() {
  return (
    <div className="bg-[#fbfaf7] min-h-screen">
      <EditorialHeader />
      <main className="max-w-[820px] mx-auto px-5 sm:px-8 py-16 md:py-24">
        <h1 className="font-[family-name:var(--font-playfair)] text-[44px] md:text-[60px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-6">
          Vinlistan möter <em className="italic text-[#722F37]">marknaden.</em>
        </h1>
        <p className="font-[family-name:var(--font-playfair)] italic text-[20px] leading-[1.5] text-[#161412] mb-12 max-w-[58ch]">
          Winefeed är en sluten B2B-marknadsplats där svenska restauranger hittar vin — och importörer hittar köpare. Source &amp; Serve.
        </p>

        <Section heading="Varför">
          <p>
            Vininköp inom Horeca har länge skett via mejl, telefon och relationer. Det fungerar — när du redan har leverantörerna. Men en sommelier som vill prova en mindre Bourgogne-producent eller en restaurangchef som söker bästa pris på Tempranillo idag har fortfarande inget centralt verktyg. Winefeed är det verktyget.
          </p>
          <p>
            Restauranger söker efter stil, tillfälle eller budget. Importörer offerterar mot förfrågan. Båda parter slipper mejlkarusellen.
          </p>
        </Section>

        <Section heading="Hur vi tjänar pengar">
          <p>
            Det är gratis att lista sig som importör och gratis att skicka förfrågan som restaurang. Winefeed tar 4 % i provision på accepterade ordrar (lägst 149 kr, högst 1 995 kr per order). Vi tjänar bara när affären faktiskt händer.
          </p>
        </Section>

        <Section heading="Var vi finns">
          <p>
            Winefeed AB är registrerat i Stockholm. Vi är ett litet team som lyssnar mer än vi pratar. Har du synpunkter, idéer eller vill testa plattformen — hör av dig direkt.
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t border-[rgba(22,20,18,0.12)]">
          <p className="text-sm text-[#828181] mb-4">Kontakt</p>
          <Link
            href="mailto:hej@winefeed.se"
            className="text-[#722F37] underline hover:text-[#6B1818] text-lg"
          >
            hej@winefeed.se
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
      <h2 className="font-[family-name:var(--font-playfair)] text-[28px] md:text-[32px] text-[#161412] mb-4">
        {heading}
      </h2>
      <div className="text-[17px] leading-[1.65] text-[#161412] space-y-4">{children}</div>
    </section>
  );
}
