import { Wine, ArrowRight, Check, AlertTriangle, XCircle, Mail, Clock, FileText, Shield, Users, TrendingUp, Calendar, Target } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';

/**
 * PILOT PITCH PAGE
 *
 * /pitch
 *
 * Public landing page for importer pilot outreach.
 * Clean, professional, scannable.
 */

export const metadata: Metadata = {
  title: 'Vinimport utan friktion',
  description: 'Sluta jaga Excel-filer och mejltrådar. Winefeed ger dig och dina restaurangkunder ett gemensamt flöde från offert till leverans – med compliance-status i realtid.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Winefeed – Från offert till leverans utan friktion',
    description: 'En plattform för hela vinflödet. Restaurang, leverantör och importör ser samma status i realtid.',
    url: 'https://winefeed.se/pitch',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'website',
    images: [
      {
        url: '/og-pilot.png',
        width: 1200,
        height: 630,
        alt: 'Winefeed – Från offert till leverans utan friktion',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Winefeed – Från offert till leverans utan friktion',
    description: 'En plattform för hela vinflödet. Restaurang, leverantör och importör ser samma status i realtid.',
    images: ['/og-pilot.png'],
  },
};

export default function PitchPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-wine text-white">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Wine className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold">Winefeed</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
            Från offert till leverans
            <br />
            <span className="text-white/80">– med full kontroll på compliance och ansvar</span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl">
            En plattform för hela vinflödet. Restaurang, leverantör och importör ser samma status i realtid.
          </p>
        </div>
      </header>

      {/* Problem Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Problemet</h2>
          <p className="text-gray-600 mb-8">Så ser det ut idag när en restaurang vill ha vin från en europeisk producent.</p>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {[
                  { step: 'Förfrågan', reality: 'Mail fram och tillbaka, oklara specs' },
                  { step: 'Offert', reality: 'Excel-fil, manuell prissättning, svårt att jämföra' },
                  { step: 'Order', reality: 'Kopierat från offerten, ofta fel' },
                  { step: 'Import', reality: 'Vem ansvarar? Vilka dokument saknas? När kommer DDL-beslutet?' },
                  { step: 'Leverans', reality: '"Var är mitt vin?" – ingen vet' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 w-32">{row.step}</td>
                    <td className="px-6 py-4 text-gray-600">{row.reality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-900 font-medium">
              För importören innebär detta att varje affär kräver manuellt arbete, ständig uppföljning och hög risk för fel.
            </p>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lösningen</h2>
          <p className="text-gray-600 mb-8">Winefeed: En plattform, hela flödet</p>

          {/* Flow Diagram */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
            {[
              { title: 'REQUEST', subtitle: 'Restaurang beskriver sitt behov' },
              { title: 'OFFER', subtitle: 'Leverantör svarar med konkret offert' },
              { title: 'ORDER', subtitle: 'Bekräftad av båda parter' },
              { title: 'IMPORT CASE', subtitle: 'IOR hanterar compliance' },
            ].map((step, i) => (
              <div key={i} className="flex items-center">
                <div className="bg-wine text-white rounded-lg p-4 text-center min-w-[140px]">
                  <div className="font-bold text-sm">{step.title}</div>
                  <div className="text-xs text-white/70 mt-1">{step.subtitle}</div>
                </div>
                {i < 3 && (
                  <ArrowRight className="h-5 w-5 text-gray-300 mx-2 hidden md:block" />
                )}
              </div>
            ))}
          </div>

          <div className="bg-wine/5 border border-wine/20 rounded-lg p-6 text-center">
            <p className="text-wine font-semibold text-lg">
              Alla parter ser samma status i realtid – restaurang, leverantör och importör.
              <br />
              <span className="font-normal">Inget faller mellan stolarna.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Before/After Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Före och efter</h2>

          <div className="space-y-4">
            {[
              { moment: 'Skicka förfrågan', before: 'Mail till 5 leverantörer, vänta på svar', after: '1 klick → rätt leverantörer får den automatiskt' },
              { moment: 'Få offert', before: 'Excel-bilagor, olika format, svårt att jämföra', after: 'Strukturerade offerter, jämförbar data' },
              { moment: 'Bekräfta order', before: 'Kopiera-klistra, riskerar fel', after: 'Offert → Order med ett klick, inga fel' },
              { moment: 'Compliance-status', before: '"Har vi DDL? Vilka dokument saknas?"', after: 'Tydlig status i realtid', hasIcons: true },
              { moment: 'Spårbarhet', before: 'Mail-trådar, vem sa vad?', after: 'Komplett historik, alla händelser loggade' },
            ].map((row, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
                <div className="font-semibold text-gray-900 mb-3">{row.moment}</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <XCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Före</div>
                      <div className="text-gray-600 text-sm">{row.before}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Efter</div>
                      <div className="text-gray-600 text-sm">
                        {row.after}
                        {row.hasIcons && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <Check className="h-3 w-3" /> OK
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              <AlertTriangle className="h-3 w-3" /> Saknas
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="h-3 w-3" /> Blockerad
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilot Results Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vad piloten har visat</h2>
          <p className="text-gray-600 mb-8">Pilot Loop 2.0 – Live sedan januari 2025</p>

          {/* Before/After KPI Cards (mobile-friendly) */}
          <div className="grid gap-4 mb-8">
            {[
              { kpi: 'Tid till första offert', before: '2–5 arbetsdagar', after: 'Samma dag' },
              { kpi: 'Manuell dataöverföring', before: '4–6 steg per order', after: '0 steg (automatiskt)' },
              { kpi: 'Compliance-synlighet', before: 'Mejl/telefon', after: 'Realtid i dashboard' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="font-medium text-gray-900 mb-3">{item.kpi}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Före</div>
                    <div className="text-gray-600 text-sm">{item.before}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Efter</div>
                    <div className="text-green-700 font-medium text-sm">{item.after}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 text-center mb-8">
            Baserat på 15+ offerter och 8 ordrar under piloten. Mätt via plattformens loggdata.
          </p>

          <blockquote className="bg-wine/5 border-l-4 border-wine rounded-r-lg p-6">
            <p className="text-lg text-gray-700 italic">
              &ldquo;Jag ser direkt vad som saknas och vem som måste agera. Inga överraskningar i tullen.&rdquo;
            </p>
            <footer className="mt-3 text-sm text-gray-500">— Importör i piloten</footer>
          </blockquote>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Vad detta betyder för dig som importör</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: TrendingUp,
                title: 'Mindre manuellt arbete',
                items: ['Sluta kopiera data mellan system', 'Sluta jaga dokument via mail', 'Sluta svara på "var är min leverans?"']
              },
              {
                icon: Shield,
                title: 'Färre fel',
                items: ['Strukturerad data från start', 'Validering innan order bekräftas', 'Compliance-checkar innan det är för sent']
              },
              {
                icon: Users,
                title: 'Nöjdare restauranger',
                items: ['De ser att något händer', 'De vet vem som ansvarar', 'De får sina leveranser i tid']
              },
              {
                icon: FileText,
                title: 'Trygghet i compliance',
                items: ['DDL-status synlig för alla parter', 'Dokument samlade på ett ställe', 'Spårbarhet om Tullverket frågar']
              },
            ].map((benefit, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-wine/10 rounded-lg flex items-center justify-center">
                    <benefit.icon className="h-5 w-5 text-wine" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{benefit.title}</h3>
                </div>
                <ul className="space-y-2">
                  {benefit.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Är Winefeed något för dig?</h2>
          <p className="text-gray-600 mb-6">Winefeed passar importörer som...</p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {[
              { text: 'Hanterar många småorder från restauranger' },
              { text: 'Jobbar med flera EU-producenter' },
              { text: 'Lägger för mycket tid på mejl och Excel' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Winefeed Is Not */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Vad Winefeed inte är</h2>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {[
              { title: 'Inte ett nytt affärssystem', desc: 'Ni behåller era befintliga verktyg' },
              { title: 'Inte ett lager- eller ERP-verktyg', desc: 'Vi hanterar flödet, inte lagersaldot' },
              { title: 'Inte en marknadsplats', desc: 'Vi tar inte över kundrelationen' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4">
                <div className="font-medium text-gray-900 mb-1">{item.title}</div>
                <div className="text-sm text-gray-600">{item.desc}</div>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-700 font-medium">
            Winefeed är ett operativt flöde ovanpå era befintliga processer.
          </p>
        </div>
      </section>

      {/* Why Now */}
      <section className="py-16 px-6 bg-wine text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Varför pilot nu?</h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Regelverk skärps, fler små producenter vill in på marknaden, och kraven på spårbarhet ökar.
            Manuella arbetssätt skalar inte längre.
          </p>
          <p className="mt-4 font-semibold text-white/90">
            Winefeed är byggt för just den här verkligheten.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-50 rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pilot-erbjudande</h2>
            <p className="text-gray-600 mb-8">Vi söker 2–3 importörer för utökad pilot</p>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Vad vi erbjuder</h3>
                <ul className="space-y-2">
                  {[
                    'Full uppsättning av plattformen',
                    'Onboarding av era producenter (5–10 st)',
                    'Direktkontakt med utvecklingsteamet',
                    'Ni påverkar produktens riktning'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <Check className="h-4 w-4 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Vad vi behöver</h3>
                <ul className="space-y-2">
                  {[
                    '1–2 timmar för uppsättning',
                    'Ärlig feedback under piloten',
                    '5–10 restaurangkunder att testa med'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <ArrowRight className="h-4 w-4 text-wine" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 text-center">
              <span className="text-green-800 font-semibold">Kostnad under pilot: Gratis</span>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-gray-200 pt-8">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                <a
                  href="mailto:hej@winefeed.se?subject=Intresserad%20av%20Winefeed-pilot&body=Hej%2C%0A%0AJag%20%C3%A4r%20intresserad%20av%20Winefeed-piloten.%0A%0A"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-wine hover:bg-wine-hover text-white rounded-xl transition-colors font-semibold text-lg shadow-lg hover:shadow-xl"
                >
                  <Mail className="h-5 w-5" />
                  Kontakta oss
                </a>
                <a
                  href="https://calendly.com/winefeed/pilot-demo?utm_source=pitch&utm_campaign=importer_pilot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-wine border-2 border-wine rounded-xl transition-colors font-semibold text-lg"
                >
                  <Calendar className="h-5 w-5" />
                  Boka 20 min demo
                </a>
              </div>

              <p className="text-center text-sm text-gray-500 mb-8">
                Pilotplatser: 2–3 st &bull; Start: inom 2 veckor &bull; Ingen IT-integration första steget
              </p>

              {/* Next Steps */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-center">Så kommer du igång</h3>
                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                  {[
                    { step: '1', text: '20 min demo', desc: 'Vi visar plattformen' },
                    { step: '2', text: 'Flödesmappning', desc: '30 min – vi förstår era behov' },
                    { step: '3', text: 'Pilotstart', desc: 'Igång inom 2 veckor' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-10 h-10 bg-wine text-white rounded-full flex items-center justify-center font-bold mb-2">
                          {item.step}
                        </div>
                        <div className="font-medium text-gray-900">{item.text}</div>
                        <div className="text-xs text-gray-500">{item.desc}</div>
                      </div>
                      {i < 2 && <ArrowRight className="h-5 w-5 text-gray-300 hidden md:block" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mini FAQ */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Vanliga frågor</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { q: 'Vad krävs av oss?', a: '1–2 timmar för uppsättning, sedan ärlig feedback. Vi sköter resten.' },
              { q: 'Hur snabbt kan vi vara igång?', a: 'Inom 2 veckor från första möte. Ingen IT-integration krävs i steg 1.' },
              { q: 'Vad kostar piloten?', a: 'Gratis. Vi vill validera värdet innan vi sätter pris.' },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Wine className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">Winefeed</span>
          </div>
          <p className="text-gray-400 mb-6">Vinhandel utan friktion</p>

          <div className="mb-6">
            <a
              href="mailto:hej@winefeed.se"
              className="inline-flex items-center gap-2 px-6 py-3 bg-wine hover:bg-wine-hover rounded-lg transition-colors font-medium"
            >
              <Mail className="h-5 w-5" />
              hej@winefeed.se
            </a>
          </div>

          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Winefeed
          </p>
        </div>
      </footer>
    </div>
  );
}
