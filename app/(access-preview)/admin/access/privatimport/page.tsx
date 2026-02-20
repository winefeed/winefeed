/**
 * VINKOLL ACCESS - Privatimport Guide
 *
 * /admin/access/privatimport
 *
 * SEO content page targeting "privatimport vin" searches.
 * Server-rendered with FAQ JSON-LD schema.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Wine, Search, Send, Truck, ShieldCheck, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privatimport av vin — så gör du via Vinkoll Access',
  description: 'Hitta unika viner som inte finns på Systembolaget och privatimportera enkelt via Vinkoll Access. Vi kopplar dig direkt till importörer.',
  openGraph: {
    title: 'Privatimport av vin — så gör du via Vinkoll Access',
    description: 'Hitta unika viner som inte finns på Systembolaget och privatimportera enkelt via Vinkoll Access.',
    type: 'website',
  },
};

const FAQ_ITEMS = [
  {
    question: 'Vad är privatimport av vin?',
    answer: 'Privatimport innebär att du beställer vin som inte finns i Systembolagets sortiment, via en registrerad importör. Systembolaget hanterar leveransen — du hämtar dina viner i butik precis som vanligt.',
  },
  {
    question: 'Hur fungerar Vinkoll Access?',
    answer: 'Vinkoll Access samlar viner från flera importörer på ett ställe. Du söker, hittar ett vin du gillar, och skickar en förfrågan. Importören återkommer med pris och tillgänglighet. Om du accepterar sköter importören resten via Systembolagets privatimporttjänst.',
  },
  {
    question: 'Kostar det något att använda Vinkoll Access?',
    answer: 'Nej, Vinkoll Access är helt gratis att använda. Du betalar bara för vinet du beställer, till det pris importören erbjuder. Systembolaget tar ingen extra avgift för privatimport.',
  },
  {
    question: 'Hur lång tid tar en privatimport?',
    answer: 'Om vinet finns på lager i Sverige tar det normalt 1–2 veckor. Om det behöver beställas från utlandet kan det ta 4–8 veckor. Importören meddelar uppskattad leveranstid i sitt svar.',
  },
  {
    question: 'Finns det en minimibeställning?',
    answer: 'Det varierar per importör och vin. Vissa kräver minst 6 flaskor, andra har inget minimum. Minimikvantiteten visas tydligt på varje vins sida.',
  },
  {
    question: 'Vilka viner finns på Vinkoll Access?',
    answer: 'Vi samlar viner från utvalda importörer som specialiserar sig på kvalitetsviner som inte finns i Systembolagets ordinarie sortiment. Utbudet växer kontinuerligt — allt från mogna Bordeaux till naturviner och rariteter.',
  },
  {
    question: 'Kan jag privatimportera vin utan Vinkoll?',
    answer: 'Ja, du kan kontakta importörer direkt och göra en privatimport via Systembolaget.se. Vinkoll Access gör det enklare genom att samla utbudet och hantera kontakten med importörer åt dig.',
  },
];

function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function buildBreadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Vinkoll Access', item: 'https://event.vinkoll.se/access' },
      { '@type': 'ListItem', position: 2, name: 'Privatimport av vin' },
    ],
  };
}

export default function PrivatimportPage() {
  const faqJsonLd = buildFaqJsonLd();
  const breadcrumbJsonLd = buildBreadcrumbJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Hero */}
        <header className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Privatimport av vin — så gör du via Vinkoll Access
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Det finns tusentals fantastiska viner som aldrig når Systembolagets hyllor.
            Med Vinkoll Access hittar du dem och privatimporterar enkelt via registrerade importörer.
          </p>
        </header>

        {/* How it works */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Så fungerar det</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StepCard
              icon={<Search className="h-6 w-6" />}
              step="1"
              title="Sök och utforska"
              description="Bläddra bland viner från utvalda importörer. Filtrera på typ, druva, region eller årgång."
            />
            <StepCard
              icon={<Send className="h-6 w-6" />}
              step="2"
              title="Skicka förfrågan"
              description="Hittar du något du gillar? Skicka en förfrågan direkt till importören med önskat antal."
            />
            <StepCard
              icon={<Truck className="h-6 w-6" />}
              step="3"
              title="Hämta på Systembolaget"
              description="Importören hanterar beställningen via Systembolagets privatimporttjänst. Du hämtar i din butik."
            />
          </div>
        </section>

        {/* Benefits */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Varför privatimportera via Vinkoll?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BenefitCard
              icon={<Wine className="h-5 w-5" />}
              title="Unika viner"
              description="Viner från små producenter och utvalda importörer som inte finns i Systembolagets ordinarie sortiment."
            />
            <BenefitCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Tryggt och enkelt"
              description="Allt går via Systembolagets officiella privatimporttjänst. Inga gråzoner, ingen tull att hantera själv."
            />
            <BenefitCard
              icon={<Search className="h-5 w-5" />}
              title="Samlade importörer"
              description="Istället för att kontakta importörer en och en samlar vi utbudet på ett ställe."
            />
            <BenefitCard
              icon={<Send className="h-5 w-5" />}
              title="Ingen kostnad"
              description="Vinkoll Access är gratis. Du betalar bara för vinet du beställer."
            />
          </div>
        </section>

        {/* CTA */}
        <section className="mb-16 bg-gradient-to-br from-[#722F37]/5 to-[#722F37]/10 border border-[#722F37]/15 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">Redo att hitta ditt nästa vin?</h2>
          <p className="text-muted-foreground mb-6">
            Utforska vårt utbud av privatimportviner — nytt tillkommer varje vecka.
          </p>
          <Link
            href="/admin/access/viner"
            className="inline-flex items-center gap-2 bg-[#722F37] text-white px-6 py-3 rounded-lg hover:bg-[#5a252c] transition-colors font-medium"
          >
            Utforska viner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-6">Vanliga frågor om privatimport</h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-border rounded-lg p-5">
                <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </>
  );
}

function StepCard({ icon, step, title, description }: { icon: React.ReactNode; step: string; title: string; description: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#722F37]/10 flex items-center justify-center text-[#722F37]">
          {icon}
        </div>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Steg {step}</span>
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function BenefitCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-muted/50">
      <div className="shrink-0 text-[#722F37] mt-0.5">{icon}</div>
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
