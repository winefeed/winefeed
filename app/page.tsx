import Link from "next/link";
import { WinefeedLogo } from "@/components/ui/WinefeedLogo";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 px-8 py-5 flex justify-between items-center bg-cream/95 backdrop-blur-md z-50 border-b border-wine-dark/10">
        <WinefeedLogo size="md" />
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/restauranger"
            className="text-wine-black-2 hover:text-wine-dark text-sm font-medium transition-colors"
          >
            För restauranger
          </Link>
          <Link
            href="/leverantorer"
            className="text-wine-black-2 hover:text-wine-dark text-sm font-medium transition-colors"
          >
            För leverantörer
          </Link>
          <Link
            href="#cta"
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
      </header>

      {/* Hero Section */}
      <section className="min-h-screen grid grid-cols-1 lg:grid-cols-2 pt-20">
        {/* Hero Content */}
        <div className="px-6 lg:px-16 py-16 lg:py-24 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-wine-dark/10 text-wine-dark px-4 py-2 rounded-full text-sm font-medium w-fit mb-6">
            <span>Endast för restauranger & vinbarer</span>
          </div>

          <h1 className="font-serif text-4xl lg:text-[3.5rem] font-semibold leading-tight text-wine-black-1 mb-6">
            B2B-plattformen för{" "}
            <span className="text-wine-dark">professionella vininköp</span>
          </h1>

          <p className="text-lg text-wine-black-2 leading-relaxed mb-8 max-w-lg">
            Winefeed är en sluten marknadsplats som kopplar samman svenska
            restauranger, hotell och vinbarer med utvalda vinleverantörer i
            Europa. Inte för privatpersoner.
          </p>

          <div className="flex flex-wrap gap-4 mb-12">
            <Link
              href="/signup"
              className="bg-wine-dark text-white px-8 py-4 rounded-lg font-semibold hover:bg-wine-medium transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-wine-dark/30 inline-flex items-center gap-2"
            >
              Ansök om företagskonto
              <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link
              href="#how-it-works"
              className="bg-transparent text-wine-black-1 px-8 py-4 rounded-lg font-semibold border-2 border-cream-dark hover:border-wine-dark hover:text-wine-dark transition-all inline-flex items-center gap-2"
            >
              Se hur det fungerar
            </Link>
          </div>

          <div className="flex gap-12">
            <div className="flex flex-col">
              <span className="font-serif text-4xl font-bold text-wine-dark">
                150+
              </span>
              <span className="text-sm text-wine-black-2">
                Europeiska leverantörer
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-4xl font-bold text-wine-dark">
                3000+
              </span>
              <span className="text-sm text-wine-black-2">
                Viner i sortimentet
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-4xl font-bold text-wine-dark">
                B2B
              </span>
              <span className="text-sm text-wine-black-2">
                Endast för företag
              </span>
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="bg-gradient-to-br from-wine-dark to-wine-deep relative overflow-hidden flex items-center justify-center min-h-[400px] lg:min-h-0">
          <div className="absolute inset-0 hero-pattern opacity-50" />

          {/* Floating Card */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-80 relative z-10 animate-float">
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

            <div className="mb-4">
              <p className="text-xs text-wine-black-2 uppercase tracking-wider mb-2">
                3 leverantörer har detta vin
              </p>

              <div className="space-y-2">
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
            </div>

            <button className="w-full bg-wine-dark text-white py-3 rounded-lg font-semibold text-sm hover:bg-wine-medium transition-colors">
              Begär offert från alla
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="font-serif text-4xl font-semibold mb-4">
              Varför professionella vinköpare väljer Winefeed
            </h2>
            <p className="text-wine-black-2 text-lg leading-relaxed">
              Slipp mejlkarusellen med leverantörer. En plattform byggd för
              restauranger, hotell och vinbarer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark rounded-xl flex items-center justify-center text-2xl mb-6">
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
                letar efter – eller upptäck något nytt.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark rounded-xl flex items-center justify-center text-2xl mb-6">
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

            {/* Feature 3 */}
            <div className="bg-cream p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="w-16 h-16 bg-wine-dark rounded-xl flex items-center justify-center text-2xl mb-6">
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
                Skicka en förfrågan och få svar från flera leverantörer. Välj
                det bästa erbjudandet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 px-8 bg-cream">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl font-semibold">
              Så fungerar det
            </h2>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-8">
            {/* Step 1 */}
            <div className="flex-1 text-center relative">
              <div className="w-12 h-12 bg-wine-dark text-white rounded-full flex items-center justify-center font-serif text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">
                Ansök om konto
              </h3>
              <p className="text-wine-black-2 text-sm leading-relaxed">
                Gratis för restauranger, hotell och vinbarer. Vi verifierar ditt
                företag.
              </p>
              <div className="hidden md:block absolute right-0 top-6 text-2xl text-wine-light">
                &rarr;
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex-1 text-center relative">
              <div className="w-12 h-12 bg-wine-dark text-white rounded-full flex items-center justify-center font-serif text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">
                Sök & utforska
              </h3>
              <p className="text-wine-black-2 text-sm leading-relaxed">
                Bläddra bland viner eller sök specifikt.
              </p>
              <div className="hidden md:block absolute right-0 top-6 text-2xl text-wine-light">
                &rarr;
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex-1 text-center relative">
              <div className="w-12 h-12 bg-wine-dark text-white rounded-full flex items-center justify-center font-serif text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">
                Begär offert
              </h3>
              <p className="text-wine-black-2 text-sm leading-relaxed">
                Välj viner och skicka förfrågan.
              </p>
              <div className="hidden md:block absolute right-0 top-6 text-2xl text-wine-light">
                &rarr;
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex-1 text-center">
              <div className="w-12 h-12 bg-wine-dark text-white rounded-full flex items-center justify-center font-serif text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">
                Få svar & beställ
              </h3>
              <p className="text-wine-black-2 text-sm leading-relaxed">
                Jämför svar och lägg order direkt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="cta"
        className="py-24 px-8 bg-gradient-to-br from-wine-dark to-wine-deep text-white text-center"
      >
        <h2 className="font-serif text-4xl font-semibold mb-4">
          Driver du restaurang, hotell eller vinbar?
        </h2>
        <p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">
          Ansök om konto och få tillgång till Europas bästa vinleverantörer. Vi
          verifierar alla företag.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-white text-wine-dark px-8 py-4 rounded-lg font-semibold hover:-translate-y-0.5 hover:shadow-xl transition-all"
          >
            Ansök om företagskonto
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
            href="/restauranger"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            För restauranger
          </Link>
          <Link
            href="/leverantorer"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            För leverantörer
          </Link>
          <Link
            href="mailto:hej@winefeed.se"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            Kontakt
          </Link>
          <Link
            href="#"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            Integritetspolicy
          </Link>
        </div>
      </footer>
    </div>
  );
}
