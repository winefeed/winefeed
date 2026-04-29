import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';
import { Calculator } from './Calculator';

export const metadata: Metadata = {
  title: 'Direktimport-kalkylator: vad blir slutpriset på vinet i Sverige? | Winefeed',
  description:
    'Räkna ut slutpriset i Sverige för ett vin från europeisk producent, inklusive alkoholskatt, importörspåslag och moms. Kostnadsfritt verktyg från Winefeed.',
  keywords: [
    'direktimport vin kostnad',
    'privatimport vin pris',
    'alkoholskatt vin sverige',
    'EUR till SEK vin',
    'vin import kalkylator',
    'restaurang direktimport',
    'vinimport från frankrike kostnad',
    'importera vin från europa',
    'vad kostar vinimport sverige',
  ],
  openGraph: {
    title: 'Direktimport-kalkylator för vin | Winefeed',
    description:
      'Räkna ut slutpriset i Sverige för ett vin från europeisk producent, inklusive alkoholskatt, importörspåslag och moms.',
    url: 'https://winefeed.se/direktimport/kalkylator',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Direktimport-kalkylator för vin',
    description:
      'Räkna ut totalkostnaden för direktimport av vin från europeisk producent.',
  },
  alternates: {
    canonical: 'https://winefeed.se/direktimport/kalkylator',
  },
};

const faqItems = [
  {
    q: 'Vad är direktimport av vin?',
    a: 'Direktimport innebär att en restaurang köper vin direkt från en producent i ett annat land istället för via en svensk grossist. Vinet importeras till Sverige av en partihandlare (importör med svenskt partihandelstillstånd), som sköter alkoholskatt, dokumentation och leverans. Restaurangen betalar producentpris, importörspåslag och avgifter, ofta totalt sett billigare än motsvarande vin via grossistmarknaden.',
  },
  {
    q: 'Vad ingår i totalkostnaden för direktimport?',
    a: 'Producentens pris (EUR ex cellar) + frakt till Sverige + svensk alkoholskatt (punktskatt per liter) + importörens påslag + 25 % moms. Tullavgift inom EU är vanligen 0 men kan tillkomma vid import från tredjeland.',
  },
  {
    q: 'Hur stor är alkoholskatten på vin i Sverige?',
    a: 'Alkoholskatten varierar med vintyp och alkoholhalt. För stilla vin med 8,5–15 % alkohol är skatten ungefär 28 kr per liter (2025–2026 års satser). Mousserande beskattas i samma kategori. Starkvin 15–22 % är dyrare, omkring 53 kr per liter. Verifiera aktuella satser hos Skatteverket.',
  },
  {
    q: 'Vad är ett rimligt importörspåslag?',
    a: 'Branschuppskattning ligger ofta mellan 12 och 25 %, beräknat på pris efter frakt plus punktskatt. Importörens slutgiltiga pris sätts dock i deras offert och kan variera baserat på volym, exklusivitet och relation. Kalkylatorn använder 15 % som default. Det är bara en uppskattning.',
  },
  {
    q: 'Behöver restaurangen ett eget tillstånd för direktimport?',
    a: 'Restaurangen behöver fortfarande ett serveringstillstånd enligt alkohollagen för att servera vinet. Själva importen sköts av en partner med partihandelstillstånd. Restaurangen behöver inte importera själv. På Winefeed agerar svenska importörer som mellanled, så processen blir densamma som vanlig fakturering från grossist.',
  },
  {
    q: 'Vilken valutakurs ska jag räkna med?',
    a: 'Använd dagskursen från Riksbanken (EUR till SEK). Importörer brukar lägga in en marginal för valutarisk i sitt påslag, så små svängningar mellan beräkning och faktiskt offert är normala.',
  },
  {
    q: 'När är direktimport värt det jämfört med svensk grossist?',
    a: 'Direktimport blir ofta lönsamt vid små producenter som inte är representerade i Sverige, eller vid större volymer (helkollin, hela leveranser) där fasta kostnader fördelas. För enstaka flaskor eller redan etablerade producenter på den svenska marknaden är skillnaden ofta liten. Använd kalkylatorn för att jämföra mot grossistens pris.',
  },
  {
    q: 'Hur lång leveranstid har direktimport?',
    a: 'Vanligen 7–14 dagar från order till leverans, jämfört med 1–3 dagar för svensk grossist. Planera därför direktimport för viner som inte behövs akut. Säsongsvariationer och tullhanteringen i Sverige kan påverka.',
  },
];

const calculatorJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Direktimport-kalkylator',
  description:
    'Räkna ut totalkostnaden för direktimport av vin från europeisk producent till Sverige, inklusive alkoholskatt, importörspåslag och moms.',
  url: 'https://winefeed.se/direktimport/kalkylator',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'SEK',
  },
  inLanguage: 'sv-SE',
  publisher: {
    '@type': 'Organization',
    name: 'Winefeed',
    url: 'https://winefeed.se',
  },
};

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Så räknar du ut totalkostnaden för direktimport av vin',
  description:
    'Steg-för-steg-guide för att räkna ut slutpriset i Sverige för ett vin från europeisk producent.',
  totalTime: 'PT5M',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Hämta producentens pris',
      text: 'Be producenten om ex cellar-pris i EUR per flaska, samt frakt till Sverige.',
    },
    {
      '@type': 'HowToStep',
      name: 'Ange vinets data',
      text: 'Fyll i kategori (stilla, mousserande, starkvin), alkoholhalt och flaskstorlek.',
    },
    {
      '@type': 'HowToStep',
      name: 'Justera marginal och valuta',
      text: 'Använd default 15 % importörspåslag och dagskursen EUR/SEK, eller justera under Avancerat.',
    },
    {
      '@type': 'HowToStep',
      name: 'Läs av totalkostnaden',
      text: 'Kalkylatorn visar pris per flaska och total ordersumma inklusive alkoholskatt och moms.',
    },
    {
      '@type': 'HowToStep',
      name: 'Skicka förfrågan',
      text: 'Använd resultatet som riktpris och skicka förfrågan via Winefeed för en bindande offert.',
    },
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

export default function DirektimportKalkylatorPage() {
  return (
    <div className="bg-[#fbfaf7] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <EditorialHeader />
      <main className="max-w-[1280px] mx-auto px-5 sm:px-8 py-12 md:py-16">
        <div className="mb-10 max-w-[68ch]">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#722F37] font-semibold mb-3">
            Verktyg · gratis att använda
          </p>
          <h1 className="font-[family-name:var(--font-playfair)] text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-4">
            Vad blir slutpriset på vinet <em className="italic text-[#722F37]">i Sverige?</em>
          </h1>
          <p className="text-[17px] leading-[1.6] text-[#828181]">
            Hittat en producent du vill importera direkt från? Räkna ut totalkostnaden innan du skickar förfrågan. Vi räknar med allt: producentpris, frakt, alkoholskatt, importörspåslag och moms.
          </p>
        </div>

        <Calculator />

        {/* Förklarande sektioner — för SEO och pedagogik */}
        <section className="mt-20 max-w-[820px]">
          <h2 className="font-[family-name:var(--font-playfair)] text-[32px] md:text-[40px] leading-[1.1] text-[#161412] mb-6">
            Så fungerar direktimport av vin till Sverige
          </h2>
          <p className="text-[17px] leading-[1.65] text-[#161412] mb-6">
            När en restaurang köper vin direkt från en europeisk producent byggs slutpriset upp i flera steg innan flaskan står på bordet. Att veta vad varje steg lägger till hjälper dig att jämföra mot grossistens pris och ta rätt beslut för ditt sortiment.
          </p>
          <div className="space-y-6">
            <CostBlock
              title="Producentpris (ex cellar)"
              body="Producentens nettopris per flaska, oftast i EUR. Det är priset producenten fakturerar sin svenska importör innan transport."
            />
            <CostBlock
              title="Frakt till Sverige"
              body="Fraktkostnaden fördelas per flaska. Vid hela kollin (12 flaskor) blir den låg per flaska. Vid blandade beställningar blir den ofta något högre. Posten täcker både EU-transport och svensk distribution till restaurangen."
            />
            <CostBlock
              title="Svensk alkoholskatt (punktskatt)"
              body="Sverige tar ut alkoholskatt per liter på allt vin som importeras. Stilla vin (8,5–15 %) ligger på cirka 28 kr per liter, starkvin (15–22 %) på cirka 53 kr per liter. Skatten betalas vid införsel och bakas in i importörens fakturapris."
            />
            <CostBlock
              title="Importörspåslag"
              body="Den svenska importören tar ett påslag på pris efter frakt plus punktskatt. Branschuppskattningen ligger på 12–25 %, men varierar beroende på volym, exklusivitet och importörens kostnadsstruktur. Importören sätter sitt slutpris i den offert du får."
            />
            <CostBlock
              title="Moms (25 %)"
              body="Momsen på vin och sprit är 25 %. Den är normalt avdragsgill för restaurangen, vilket innebär att den faktiska kostnaden är priset exklusive moms."
            />
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20 max-w-[820px]">
          <h2 className="font-[family-name:var(--font-playfair)] text-[32px] md:text-[40px] leading-[1.1] text-[#161412] mb-6">
            Vanliga frågor om direktimport
          </h2>
          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <details
                key={i}
                className="group bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl p-6"
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <h3 className="font-[family-name:var(--font-playfair)] text-[20px] md:text-[22px] text-[#161412] leading-[1.3] m-0">
                    {item.q}
                  </h3>
                  <span className="text-[#722F37] text-2xl leading-none transition-transform group-open:rotate-45 select-none">
                    +
                  </span>
                </summary>
                <p className="text-[16px] leading-[1.65] text-[#161412] mt-4 m-0">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-20 max-w-[820px]">
          <p className="text-[15px] text-[#828181] mb-4 italic">Räknat färdigt? Nästa steg är att skicka förfrågan.</p>
          <div className="bg-[#4A1A1F] text-white rounded-2xl p-8 md:p-10">
            <h2 className="font-[family-name:var(--font-playfair)] text-[28px] md:text-[36px] leading-[1.1] mb-3">
              Från kalkyl till offert
            </h2>
            <p className="text-[16px] leading-[1.6] text-white/80 mb-6 max-w-[60ch]">
              Winefeed kopplar svenska restauranger med europeiska producenter via etablerade importörer. Du får
              offert med bindande totalpris, slipper hantera tull och alkoholskatt själv, och kan jämföra
              flera importörer för samma vin.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-[48px] px-6 rounded-[10px] bg-white text-[#722F37] text-[15px] font-medium hover:bg-white/90 transition-colors"
              >
                Skapa restaurangkonto (gratis)
              </Link>
              <Link
                href="/restauranger"
                className="inline-flex items-center justify-center h-[48px] px-6 rounded-[10px] bg-transparent text-white border border-white/40 text-[15px] font-medium hover:border-white hover:bg-white/8 transition-colors"
              >
                Läs mer om Winefeed
              </Link>
            </div>
          </div>
        </section>
      </main>
      <EditorialFooter />
    </div>
  );
}

function CostBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-[#722F37] pl-5">
      <h3 className="font-[family-name:var(--font-playfair)] text-[22px] text-[#161412] mb-2">{title}</h3>
      <p className="text-[16px] leading-[1.6] text-[#828181] m-0">{body}</p>
    </div>
  );
}
