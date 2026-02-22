import Link from "next/link";
import { Metadata } from "next";
import { WinefeedLogo } from "@/components/ui/WinefeedLogo";
import { MobileNav } from "@/components/ui/MobileNav";

export const metadata: Metadata = {
  title: "För restauranger - Sök, jämför och beställ vin från importörer",
  description:
    "Winefeed hjälper restauranger, hotell och vinbarer att hitta rätt vin. Sök bland tusentals viner, jämför priser och begär offert från flera leverantörer samtidigt.",
  keywords: ["vin restaurang", "vininköp", "vinleverantör", "jämför vinpriser", "begär offert vin", "B2B vin", "horeca vin"],
  openGraph: {
    title: "Winefeed för restauranger - Professionella vininköp",
    description:
      "Slipp mejlkarusellen. Sök, jämför och beställ vin direkt från importörer via Winefeed.",
    url: "https://winefeed.se/restauranger",
    siteName: "Winefeed",
    locale: "sv_SE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Winefeed för restauranger - Professionella vininköp",
    description:
      "Slipp mejlkarusellen. Sök, jämför och beställ vin direkt från importörer.",
  },
  alternates: {
    canonical: "https://winefeed.se/restauranger",
  },
};

const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Winefeed för restauranger",
  url: "https://winefeed.se/restauranger",
  description:
    "Winefeed hjälper restauranger, hotell och vinbarer att hitta rätt vin. Sök bland tusentals viner, jämför priser och begär offert från flera leverantörer samtidigt.",
  isPartOf: {
    "@type": "WebSite",
    name: "Winefeed",
    url: "https://winefeed.se",
  },
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "h2", ".speakable"],
  },
};

export default function RestaurangerPage() {
  return (
    <div className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 px-8 py-5 flex justify-between items-center bg-cream/95 backdrop-blur-md z-50 border-b border-wine-dark/10">
        <Link href="/">
          <WinefeedLogo size="md" />
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/leverantorer"
            className="text-wine-black-2 hover:text-wine-dark text-sm font-medium transition-colors"
          >
            För leverantörer
          </Link>
          <Link
            href="/"
            className="text-wine-black-2 hover:text-wine-dark text-sm font-medium transition-colors"
          >
            Om oss
          </Link>
          <Link
            href="/login"
            className="bg-wine-dark text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-wine-medium transition-colors"
          >
            Logga in
          </Link>
        </nav>
        <MobileNav
          links={[
            { href: "/leverantorer", label: "För leverantörer" },
            { href: "/", label: "Om oss" },
          ]}
        />
      </header>

      {/* Hero */}
      <section className="min-h-[70vh] grid grid-cols-1 lg:grid-cols-2 pt-20">
        <div className="px-6 lg:px-16 py-16 lg:py-24 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-wine-dark/10 text-wine-dark px-4 py-2 rounded-full text-sm font-medium w-fit mb-6">
            <span>För restauranger, hotell & vinbarer</span>
          </div>

          <h1 className="font-serif text-4xl lg:text-[3.5rem] font-semibold leading-tight text-wine-black-1 mb-6">
            Hitta rätt vin{" "}
            <span className="text-wine-dark">till din restaurang</span>
          </h1>

          <p className="speakable text-lg text-wine-black-2 leading-relaxed mb-8 max-w-lg">
            Sök bland tusentals viner från svenska importörer, jämför priser och
            begär offert — allt på ett ställe. Slipp mejlkarusellen.
          </p>

          <div className="flex flex-wrap gap-4 mb-12">
            <Link
              href="/signup"
              className="bg-wine-dark text-white px-8 py-4 rounded-lg font-semibold hover:bg-wine-medium transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-wine-dark/30 inline-flex items-center gap-2"
            >
              Skapa konto gratis
              <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link
              href="#sa-fungerar-det"
              className="bg-transparent text-wine-black-1 px-8 py-4 rounded-lg font-semibold border-2 border-cream-dark hover:border-wine-dark hover:text-wine-dark transition-all inline-flex items-center gap-2"
            >
              Se hur det fungerar
            </Link>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="bg-gradient-to-br from-wine-dark to-wine-deep relative overflow-hidden flex items-center justify-center min-h-[400px] lg:min-h-0">
          <div className="absolute inset-0 hero-pattern opacity-50" />
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-80 relative z-10">
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-cream-dark">
              <div className="w-12 h-[70px] bg-gradient-to-b from-wine-light to-wine-dark rounded relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-gold rounded-sm" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold">
                  Barolo DOCG 2019
                </h3>
                <p className="text-sm text-wine-black-2">
                  Piedmont, Italien &bull; Giuseppe Rinaldi
                </p>
              </div>
            </div>
            <p className="text-xs text-wine-black-2 uppercase tracking-wider mb-2">
              3 leverantörer har detta vin
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center py-2 border-b border-cream">
                <span className="text-sm font-medium">Vino Italia AB</span>
                <span className="font-semibold text-wine-dark bg-wine-dark/10 px-2 py-1 rounded">
                  285 kr
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-cream">
                <span className="text-sm font-medium">Nordic Wine Import</span>
                <span className="font-semibold text-wine-dark">312 kr</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium">Europa Viner</span>
                <span className="font-semibold text-wine-dark">295 kr</span>
              </div>
            </div>
            <button className="w-full bg-wine-dark text-white py-3 rounded-lg font-semibold text-sm hover:bg-wine-medium transition-colors">
              Begär offert från alla
            </button>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="font-serif text-4xl font-semibold mb-4">
              Slipp mejlkarusellen
            </h2>
            <p className="speakable text-wine-black-2 text-lg leading-relaxed">
              Att köpa vin till restaurangen borde inte kräva tiotals mejl,
              telefonsamtal och Excel-filer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark/10 rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-wine-dark"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Mejl fram och tillbaka
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Varje ny leverantör innebär ett nytt mejlflöde. Förfrågningar
                faller mellan stolarna.
              </p>
            </div>

            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark/10 rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-wine-dark"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Svårt att jämföra priser
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Offerter kommer i olika format — PDF, Excel, mejltext. Omöjligt
                att jämföra snabbt.
              </p>
            </div>

            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark/10 rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-wine-dark"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Tar för lång tid
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Från första förfrågan till leverans — varje steg kräver manuell
                uppföljning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-8 bg-cream">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="font-serif text-4xl font-semibold mb-4">
              Allt du behöver för dina vininköp
            </h2>
            <p className="text-wine-black-2 text-lg leading-relaxed">
              En plattform byggd för restauranger, hotell och vinbarer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Sök bland tusentals viner
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Filtrera på druva, region, pris och stil. Hitta exakt det du
                letar efter — eller upptäck något nytt.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Jämför priser direkt
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Se vilka leverantörer som har samma vin och jämför priser,
                fraktkostnader och leveranstider.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                En offert, flera svar
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Skicka en förfrågan och få svar från flera leverantörer. Välj det
                bästa erbjudandet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="sa-fungerar-det" className="py-24 px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl font-semibold">
              Så fungerar det
            </h2>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-8">
            {[
              {
                step: "1",
                title: "Skapa konto",
                desc: "Gratis för restauranger, hotell och vinbarer. Vi verifierar ditt företag.",
              },
              {
                step: "2",
                title: "Sök & utforska",
                desc: "Bläddra bland viner eller sök specifikt. Filtrera på druva, region och stil.",
              },
              {
                step: "3",
                title: "Begär offert",
                desc: "Välj viner och skicka förfrågan till en eller flera leverantörer.",
              },
              {
                step: "4",
                title: "Få svar & beställ",
                desc: "Jämför offerter och lägg order direkt i plattformen.",
              },
            ].map((item, i) => (
              <div key={i} className="flex-1 text-center relative">
                <div className="w-12 h-12 bg-wine-dark text-white rounded-full flex items-center justify-center font-serif text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-serif text-xl font-semibold mb-2">
                  {item.title}
                </h3>
                <p className="text-wine-black-2 text-sm leading-relaxed">
                  {item.desc}
                </p>
                {i < 3 && (
                  <div className="hidden md:block absolute right-0 top-6 text-2xl text-wine-light">
                    &rarr;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-8 bg-gradient-to-br from-wine-dark to-wine-deep text-white text-center">
        <h2 className="font-serif text-4xl font-semibold mb-4">
          Börja hitta rätt vin idag
        </h2>
        <p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">
          Det är gratis att skapa konto. Sök bland tusentals viner och begär
          offert direkt.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-white text-wine-dark px-8 py-4 rounded-lg font-semibold hover:-translate-y-0.5 hover:shadow-xl transition-all"
          >
            Skapa konto gratis
          </Link>
          <Link
            href="mailto:hej@winefeed.se"
            className="bg-transparent text-white px-8 py-4 rounded-lg font-semibold border-2 border-white/30 hover:border-white hover:bg-white/10 transition-all"
          >
            Kontakta oss
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 bg-wine-black-1 text-white flex flex-col md:flex-row justify-between items-center">
        <div className="font-serif text-xl font-semibold mb-4 md:mb-0">
          Winefeed
        </div>
        <div className="flex gap-8">
          <Link
            href="/leverantorer"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            För leverantörer
          </Link>
          <Link
            href="/"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            Om oss
          </Link>
          <Link
            href="mailto:hej@winefeed.se"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            Kontakt
          </Link>
        </div>
      </footer>
    </div>
  );
}
