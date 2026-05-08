import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'Direktimport av vin för restauranger | Winefeed',
  description:
    'Allt du behöver veta om direktimport av vin från europeiska producenter till svenska restauranger. Kalkylator, alkoholskatt, processen och hur Winefeed kopplar er till importörer.',
  keywords: [
    'direktimport vin',
    'privatimport vin restaurang',
    'importera vin sverige',
    'vin från europa restaurang',
    'alkoholskatt vin sverige',
  ],
  openGraph: {
    title: 'Direktimport av vin för restauranger',
    description:
      'Allt om direktimport av vin: kalkylator, alkoholskatt, process och praktiska frågor.',
    url: 'https://winefeed.se/direktimport',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'website',
  },
  alternates: { canonical: 'https://www.winefeed.se/direktimport' },
};

const resources = [
  {
    href: '/direktimport/kalkylator',
    title: 'Direktimport-kalkylator',
    description:
      'Räkna ut totalkostnaden i SEK för ett vin från europeisk producent, inklusive alkoholskatt, importörspåslag och moms.',
    badge: 'Verktyg',
  },
  {
    href: '/direktimport/guide',
    title: 'Komplett guide till direktimport',
    description:
      'Steg-för-steg-genomgång av hur direktimport fungerar för svenska restauranger. Aktörer, juridik, kostnader, leveranstid och vanliga fallgropar.',
    badge: 'Guide',
  },
  {
    href: '/direktimport/alkoholskatt',
    title: 'Alkoholskatt på vin i Sverige',
    description:
      'Aktuella punktskatte-satser, hur skatten beräknas per liter, och hur den påverkar slutpriset på direktimporterat vin.',
    badge: 'Fakta',
  },
];

export default function DirektimportIndexPage() {
  return (
    <div className="bg-[#fbfaf7] min-h-screen">
      <EditorialHeader />
      <main className="max-w-[1280px] mx-auto px-5 sm:px-8 py-12 md:py-16">
        <div className="mb-12 max-w-[68ch]">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#722F37] font-semibold mb-3">
            Direktimport av vin
          </p>
          <h1 className="font-[family-name:var(--font-playfair)] text-[40px] md:text-[60px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-5">
            Vin från producent till <em className="italic text-[#722F37]">svensk restaurang</em>
          </h1>
          <p className="text-[18px] leading-[1.55] text-[#161412]">
            Direktimport innebär att en restaurang köper vin direkt från en producent i ett annat land, med en svensk importör som hanterar tull, alkoholskatt och leverans. Här samlar vi verktyg och fakta som hjälper dig fatta beslut innan du skickar förfrågan.
          </p>
        </div>

        {/* Resources grid */}
        <div className="grid md:grid-cols-3 gap-5 mb-20">
          {resources.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="group block bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl p-7 hover:border-[#722F37] hover:shadow-[0_8px_24px_rgba(74,26,31,0.06)] transition-all"
            >
              <span className="inline-block text-[10px] uppercase tracking-[0.18em] text-[#722F37] font-semibold mb-4">
                {r.badge}
              </span>
              <h2 className="font-[family-name:var(--font-playfair)] text-[26px] leading-[1.15] text-[#161412] mb-3 group-hover:text-[#722F37] transition-colors">
                {r.title}
              </h2>
              <p className="text-[15px] leading-[1.55] text-[#828181] m-0">{r.description}</p>
              <span className="inline-block mt-5 text-[14px] text-[#722F37] font-medium group-hover:underline">
                Läs mer →
              </span>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <section className="max-w-[820px] mx-auto">
          <div className="bg-[#4A1A1F] text-white rounded-2xl p-8 md:p-10 text-center">
            <h2 className="font-[family-name:var(--font-playfair)] text-[28px] md:text-[36px] leading-[1.1] mb-3">
              Hitta rätt vin via Winefeed
            </h2>
            <p className="text-[16px] leading-[1.6] text-white/80 mb-6 max-w-[60ch] mx-auto">
              Skicka en förfrågan, jämför offerter från flera importörer, beställ direkt. Vi sköter logistiken, alkoholskatt och dokumentation. Gratis att registrera, gratis att begära offert.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-[48px] px-6 rounded-[10px] bg-white text-[#722F37] text-[15px] font-medium hover:bg-white/90 transition-colors"
              >
                Skapa restaurangkonto
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
