import Link from "next/link";
import { Metadata } from "next";
import { WinefeedLogo } from "@/components/ui/WinefeedLogo";
import { MobileNav } from "@/components/ui/MobileNav";

export const metadata: Metadata = {
  title: "För leverantörer - Nå nya restaurangkunder via Winefeed",
  description:
    "Winefeed kopplar importörer med restauranger som söker nya viner. Ta emot förfrågningar, svara med offert. 4 % success fee — gratis att lista sig.",
  keywords: ["vinimportör", "vinleverantör", "restaurangkunder", "sälja vin B2B", "vin grossist", "horeca leverantör", "vinförmedling"],
  openGraph: {
    title: "Winefeed för leverantörer - Nå restauranger som söker vin",
    description:
      "Gratis att lista sig. Ta emot förfrågningar från restauranger och svara med offert. 4 % success fee på accepterade ordrar.",
    url: "https://winefeed.se/leverantorer",
    siteName: "Winefeed",
    locale: "sv_SE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Winefeed för leverantörer - Nå restauranger som söker vin",
    description:
      "Gratis att lista sig. Ta emot förfrågningar och svara med offert. 4 % success fee.",
  },
  alternates: {
    canonical: "https://winefeed.se/leverantorer",
  },
};

const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Winefeed för leverantörer",
  url: "https://winefeed.se/leverantorer",
  description:
    "Winefeed kopplar importörer och vinleverantörer med restauranger som aktivt söker nya viner. Ta emot förfrågningar, svara med offert och leverera.",
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

export default function LeverantorerPage() {
  return (
    <div className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 px-4 sm:px-8 py-5 flex justify-between items-center bg-cream/95 backdrop-blur-md z-50 border-b border-wine-dark/10">
        <Link href="/">
          <WinefeedLogo size="md" />
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/restauranger"
            className="text-wine-black-2 hover:text-wine-dark text-sm font-medium transition-colors"
          >
            För restauranger
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
            { href: "/restauranger", label: "För restauranger" },
            { href: "/", label: "Om oss" },
          ]}
        />
      </header>

      {/* Hero */}
      <section className="min-h-[70vh] grid grid-cols-1 lg:grid-cols-2 pt-20">
        <div className="px-6 lg:px-16 py-16 lg:py-24 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-wine-dark/10 text-wine-dark px-4 py-2 rounded-full text-sm font-medium w-fit mb-6">
            <span>För importörer & vinleverantörer</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[3.5rem] font-semibold leading-tight text-wine-black-1 mb-6">
            Nå nya{" "}
            <span className="text-wine-dark">restaurangkunder</span>
          </h1>

          <p className="speakable text-lg text-wine-black-2 leading-relaxed mb-8 max-w-lg">
            Restauranger söker aktivt efter nya viner på Winefeed. Lista ditt
            sortiment, ta emot förfrågningar och svara med offert — helt utan
            kallringning.
          </p>

          <div className="flex flex-wrap gap-4 mb-12">
            <Link
              href="/signup"
              className="bg-wine-dark text-white px-8 py-4 rounded-lg font-semibold hover:bg-wine-medium transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-wine-dark/30 inline-flex items-center gap-2"
            >
              Bli leverantör
              <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link
              href="/pitch"
              className="bg-transparent text-wine-black-1 px-8 py-4 rounded-lg font-semibold border-2 border-cream-dark hover:border-wine-dark hover:text-wine-dark transition-all inline-flex items-center gap-2"
            >
              Läs detaljerad pitch
            </Link>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="bg-gradient-to-br from-wine-dark to-wine-deep relative overflow-hidden flex items-center justify-center min-h-[400px] lg:min-h-0">
          <div className="absolute inset-0 hero-pattern opacity-50" />
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-80 mx-4 sm:mx-0 relative z-10">
            <div className="mb-4 pb-4 border-b border-cream-dark">
              <p className="text-xs text-wine-black-2 uppercase tracking-wider mb-1">
                Ny förfrågan
              </p>
              <h3 className="font-serif text-lg font-semibold">
                Restaurang Södermalm
              </h3>
              <p className="text-sm text-wine-black-2">
                Söker: Barolo, Barbaresco &bull; 6–12 flaskor
              </p>
            </div>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <span className="text-sm">Matchar ditt sortiment</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <span className="text-sm">Kvalificerad restaurangkund</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <span className="text-sm">Leverans till Stockholm</span>
              </div>
            </div>
            <button className="w-full bg-wine-dark text-white py-3 rounded-lg font-semibold text-sm hover:bg-wine-medium transition-colors">
              Svara med offert
            </button>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-4">
              Så fungerar det för leverantörer
            </h2>
            <p className="text-wine-black-2 text-lg leading-relaxed">
              Från förfrågan till leverans — utan manuellt arbete.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 bg-wine-dark text-white rounded-full flex items-center justify-center font-serif text-2xl font-bold mb-6">
                1
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Ta emot förfrågningar
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Restauranger som söker viner som matchar ditt sortiment skickar
                förfrågningar direkt till dig.
              </p>
            </div>

            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 bg-wine-dark text-white rounded-full flex items-center justify-center font-serif text-2xl font-bold mb-6">
                2
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Svara med offert
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Skicka en strukturerad offert med priser och leveransvillkor.
                Restaurangen kan jämföra och välja.
              </p>
            </div>

            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 bg-wine-dark text-white rounded-full flex items-center justify-center font-serif text-2xl font-bold mb-6">
                3
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Leverera
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Bekräftad order, tydliga villkor, full spårbarhet. Fokusera på
                vinerna — vi hanterar flödet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Business Model */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-cream">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-4">
              Transparent affärsmodell
            </h2>
            <p className="speakable text-wine-black-2 text-lg leading-relaxed">
              Du betalar bara när det blir affär.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <span className="font-serif text-5xl sm:text-6xl font-bold text-wine-dark">
                4%
              </span>
              <p className="text-wine-black-2 text-lg mt-2">
                success fee på accepterade offerter
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {[
                {
                  label: "Lista sig & ta emot förfrågningar",
                  value: "Gratis",
                },
                { label: "Minimiavgift per order", value: "149 kr" },
                { label: "Maxavgift per order", value: "1 995 kr" },
                { label: "Fakturering", value: "Månadsvis i efterskott" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-3 border-b border-cream-dark last:border-0"
                >
                  <span className="text-wine-black-2">{item.label}</span>
                  <span className="font-semibold text-wine-black-1">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-cream rounded-xl p-4 text-center">
              <p className="text-sm text-wine-black-2">
                Winefeed tar betalt för <strong>introduktionen</strong>.
                Följande ordrar direkt mellan importör och restaurang är
                avgiftsfria.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-4">
              Fördelar för leverantörer
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Kvalificerade leads
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Restaurangerna som kontaktar dig söker aktivt efter just dina
                viner. Ingen kallringning.
              </p>
            </div>

            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Mindre admin
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Strukturerade förfrågningar och offerter. Slipp kopiera data
                mellan mejl och Excel.
              </p>
            </div>

            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
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
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-semibold mb-3">
                Nöjdare kunder
              </h3>
              <p className="text-wine-black-2 leading-relaxed">
                Restaurangerna ser status i realtid, vet vem som ansvarar och
                får sina leveranser i tid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-gradient-to-br from-wine-dark to-wine-deep text-white text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-4">
          Bli leverantör på Winefeed
        </h2>
        <p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">
          Det är gratis att lista sig. Du betalar bara när det blir affär.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-white text-wine-dark px-8 py-4 rounded-lg font-semibold hover:-translate-y-0.5 hover:shadow-xl transition-all"
          >
            Registrera dig
          </Link>
          <Link
            href="/pitch"
            className="bg-transparent text-white px-8 py-4 rounded-lg font-semibold border-2 border-white/30 hover:border-white hover:bg-white/10 transition-all"
          >
            Läs detaljerad pitch
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-8 bg-wine-black-1 text-white flex flex-col md:flex-row justify-between items-center">
        <div className="font-serif text-xl font-semibold mb-4 md:mb-0">
          Winefeed
        </div>
        <div className="flex gap-8">
          <Link
            href="/restauranger"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            För restauranger
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
