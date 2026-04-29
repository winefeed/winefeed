import { Metadata } from 'next';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';
import { Calculator } from './Calculator';

export const metadata: Metadata = {
  title: 'Direktimport-kalkylator — vad kostar vinet landat i Sverige? | Winefeed',
  description:
    'Räkna ut totalkostnaden för direktimport av vin från en europeisk producent: producentpris, frakt, alkoholskatt, importörspåslag och moms. Kostnadsfritt verktyg från Winefeed.',
  keywords: [
    'direktimport vin kostnad',
    'privatimport vin pris',
    'alkoholskatt vin',
    'EUR till SEK vin',
    'vin import kalkylator',
    'restaurang direktimport',
  ],
  openGraph: {
    title: 'Direktimport-kalkylator för vin | Winefeed',
    description:
      'Räkna ut vad ett vin kostar landat i Sverige från europeisk producent — inklusive alkoholskatt, importörspåslag och moms.',
    url: 'https://winefeed.se/direktimport/kalkylator',
    siteName: 'Winefeed',
    locale: 'sv_SE',
    type: 'website',
  },
  alternates: {
    canonical: 'https://winefeed.se/direktimport/kalkylator',
  },
};

export default function DirektimportKalkylatorPage() {
  return (
    <div className="bg-[#fbfaf7] min-h-screen">
      <EditorialHeader />
      <main className="max-w-[1280px] mx-auto px-5 sm:px-8 py-12 md:py-16">
        <div className="mb-10 max-w-[68ch]">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#722F37] font-semibold mb-3">
            Verktyg · gratis att använda
          </p>
          <h1 className="font-[family-name:var(--font-playfair)] text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-4">
            Vad kostar vinet <em className="italic text-[#722F37]">landat i Sverige?</em>
          </h1>
          <p className="text-[17px] leading-[1.6] text-[#828181]">
            Hittat en producent du vill köpa direkt från? Räkna ut totalkostnaden — producentpris, frakt, alkoholskatt, importörspåslag och moms — innan du skickar förfrågan.
          </p>
        </div>
        <Calculator />
      </main>
      <EditorialFooter />
    </div>
  );
}
