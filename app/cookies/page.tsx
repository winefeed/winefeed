import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'Cookies — Winefeed',
  description:
    'Hur Winefeed använder cookies och liknande tekniker. Lista över cookies och hur du hanterar dem.',
  alternates: { canonical: 'https://winefeed.se/cookies' },
};

export default function CookiesPage() {
  return (
    <div className="bg-[#fbfaf7] min-h-screen">
      <EditorialHeader />
      <main className="max-w-[820px] mx-auto px-5 sm:px-8 py-16 md:py-24">
        <p className="text-sm text-[#828181] mb-3">Senast uppdaterad: 28 april 2026</p>
        <h1 className="font-[family-name:var(--font-playfair)] text-[40px] md:text-[52px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-8">
          Cookies
        </h1>
        <p className="text-[17px] leading-[1.65] text-[#161412] mb-10">
          När du besöker winefeed.se använder vi cookies och liknande tekniker för att tjänsten ska fungera och för att kunna driva den säkert. Vi använder inte cookies för marknadsföring eller tracking mellan webbplatser.
        </p>

        <Section heading="Vad är cookies?">
          <p>
            En cookie är en liten textfil som webbplatsen sparar i din webbläsare. Den används för att komma ihåg vem du är mellan sidladdningar och för att hålla saker som inloggningssessioner och inställningar.
          </p>
        </Section>

        <Section heading="Vilka cookies vi använder">
          <p>Vi använder enbart cookies som är nödvändiga för att tjänsten ska fungera:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Session/autentisering</strong> — håller dig inloggad. Krävs för att kunna använda dashboarden och göra beställningar.
            </li>
            <li>
              <strong>CSRF-skydd</strong> — skyddar mot förfalskade förfrågningar. Krävs för säkerhet.
            </li>
            <li>
              <strong>Funktionella inställningar</strong> — t.ex. utkast på en pågående förfrågan, sparas i din webbläsare så du inte tappar arbete.
            </li>
          </ul>
        </Section>

        <Section heading="Tredjepartstjänster">
          <p>
            Vi använder följande tredjepartstjänster som kan sätta egna cookies eller liknande tekniker:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Sentry</strong> — felsökning. Sätter en sessions-ID för att korrelera fel med specifika sessioner. Ingen personidentifierande data delas.
            </li>
            <li>
              <strong>Vercel</strong> — webbhosting. Kan använda säkerhets- och prestandacookies.
            </li>
          </ul>
          <p>
            Vi använder inte Google Analytics, Facebook Pixel eller liknande spårningsverktyg.
          </p>
        </Section>

        <Section heading="Hur du hanterar cookies">
          <p>
            Du kan när som helst rensa eller blockera cookies via din webbläsares inställningar. Notera dock att tjänsten inte kommer att fungera fullt ut om du blockerar de cookies vi använder för inloggning och säkerhet.
          </p>
          <p>
            Vägledning för de vanligaste webbläsarna:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <a
                href="https://support.google.com/chrome/answer/95647"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#722F37] underline hover:text-[#6B1818]"
              >
                Chrome
              </a>
            </li>
            <li>
              <a
                href="https://support.mozilla.org/sv/kb/aktivera-och-inaktivera-kakor"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#722F37] underline hover:text-[#6B1818]"
              >
                Firefox
              </a>
            </li>
            <li>
              <a
                href="https://support.apple.com/sv-se/guide/safari/sfri11471/mac"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#722F37] underline hover:text-[#6B1818]"
              >
                Safari
              </a>
            </li>
            <li>
              <a
                href="https://support.microsoft.com/sv-se/microsoft-edge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#722F37] underline hover:text-[#6B1818]"
              >
                Edge
              </a>
            </li>
          </ul>
        </Section>

        <Section heading="Mer information">
          <p>
            Hela vår hantering av personuppgifter beskrivs i{' '}
            <Link href="/integritetspolicy" className="text-[#722F37] underline hover:text-[#6B1818]">
              integritetspolicyn
            </Link>
            .
          </p>
          <p>
            Frågor om cookies:{' '}
            <Link href="mailto:hej@winefeed.se" className="text-[#722F37] underline hover:text-[#6B1818]">
              hej@winefeed.se
            </Link>
            .
          </p>
        </Section>
      </main>
      <EditorialFooter />
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] text-[#161412] mb-4">
        {heading}
      </h2>
      <div className="text-[16px] leading-[1.65] text-[#161412] space-y-4">{children}</div>
    </section>
  );
}
