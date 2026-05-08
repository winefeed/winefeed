import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'Integritetspolicy — Winefeed',
  description:
    'Hur Winefeed samlar in, använder och skyddar personuppgifter. GDPR-policy för Winefeeds B2B-marknadsplats.',
  alternates: { canonical: 'https://www.winefeed.se/integritetspolicy' },
};

export default function IntegritetspolicyPage() {
  return (
    <div className="bg-[#fbfaf7] min-h-screen">
      <EditorialHeader />
      <main className="max-w-[820px] mx-auto px-5 sm:px-8 py-16 md:py-24">
        <p className="text-sm text-[#828181] mb-3">Senast uppdaterad: 28 april 2026</p>
        <h1 className="font-[family-name:var(--font-playfair)] text-[40px] md:text-[52px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-8">
          Integritetspolicy
        </h1>
        <p className="text-[17px] leading-[1.65] text-[#161412] mb-10">
          Den här policyn beskriver hur Winefeed AB (&quot;Winefeed&quot;, &quot;vi&quot;) samlar in, använder och skyddar personuppgifter när du använder vår plattform på winefeed.se. Vi följer EU:s dataskyddsförordning (GDPR) och svensk dataskyddslagstiftning.
        </p>

        <Section heading="1. Personuppgiftsansvarig">
          <p>
            Winefeed AB, Stockholm, Sverige. Kontakt:{' '}
            <Link href="mailto:hej@winefeed.se" className="text-[#722F37] underline hover:text-[#6B1818]">
              hej@winefeed.se
            </Link>
            .
          </p>
        </Section>

        <Section heading="2. Vilka personuppgifter vi samlar in">
          <p>Vi samlar in följande typer av uppgifter:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Kontaktuppgifter:</strong> namn, e-postadress, telefonnummer
            </li>
            <li>
              <strong>Företagsuppgifter:</strong> företagsnamn, organisationsnummer, fakturaadress, leveransadress
            </li>
            <li>
              <strong>Kontouppgifter:</strong> inloggningsuppgifter, roll på plattformen
            </li>
            <li>
              <strong>Användardata:</strong> sökhistorik, förfrågningar, offerter, ordrar, feedback på vinmatchningar
            </li>
            <li>
              <strong>Teknisk data:</strong> IP-adress, webbläsare, enhetsinformation, sessionsdata
            </li>
            <li>
              <strong>Kommunikation:</strong> e-postmeddelanden mellan dig och Winefeed
            </li>
          </ul>
        </Section>

        <Section heading="3. Varför vi behandlar uppgifterna">
          <ul className="list-disc pl-6 space-y-2">
            <li>Tillhandahålla, drifta och utveckla tjänsten</li>
            <li>Förmedla offerter och ordrar mellan restauranger och importörer</li>
            <li>Skicka transaktionsmejl (offert-bekräftelser, orderhandlingar)</li>
            <li>Hantera fakturering av provision på genomförda affärer</li>
            <li>Förbättra matchningsalgoritmen och plattformens kvalitet</li>
            <li>Förebygga missbruk och säkerhetsincidenter</li>
            <li>Uppfylla rättsliga skyldigheter (bokföringslagen m.fl.)</li>
          </ul>
        </Section>

        <Section heading="4. Rättslig grund">
          <p>Vi behandlar dina uppgifter med stöd av:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Avtal</strong> — för att uppfylla användaravtalet med dig (registrering, förmedling, fakturering)
            </li>
            <li>
              <strong>Berättigat intresse</strong> — för att utveckla tjänsten, förebygga missbruk och kommunicera produktnyheter
            </li>
            <li>
              <strong>Rättslig förpliktelse</strong> — bokföring, skatt och liknande
            </li>
            <li>
              <strong>Samtycke</strong> — om du särskilt ger samtycke (t.ex. nyhetsbrev)
            </li>
          </ul>
        </Section>

        <Section heading="5. Vem vi delar uppgifter med">
          <p>
            Vi delar uppgifter med betrodda underleverantörer (s.k. personuppgiftsbiträden) som hjälper oss driva tjänsten:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Supabase</strong> — databas och autentisering (datacenter inom EU)
            </li>
            <li>
              <strong>Resend</strong> — leverans av e-post
            </li>
            <li>
              <strong>Sentry</strong> — felsökning och driftövervakning
            </li>
            <li>
              <strong>Upstash</strong> — cachning och hastighetsbegränsning
            </li>
            <li>
              <strong>Stripe</strong> — fakturering och betalningar (om du gör betalning genom plattformen)
            </li>
            <li>
              <strong>Vercel</strong> — webbhosting
            </li>
          </ul>
          <p>
            Vi delar inte dina uppgifter med tredje part i marknadsföringssyfte och säljer aldrig data. När en restaurang accepterar en offert delas relevanta kontakt- och leveransuppgifter med den importör som ska leverera ordern — det är en nödvändig del av tjänsten.
          </p>
        </Section>

        <Section heading="6. Lagringstid">
          <p>
            Vi behåller dina uppgifter så länge ditt konto är aktivt och därefter så länge det krävs av lag (typiskt 7 år för bokföringsmaterial). Du kan begära radering av icke-lagstadgade uppgifter när som helst.
          </p>
        </Section>

        <Section heading="7. Säkerhet">
          <p>
            Vi använder branschstandard tekniska och organisatoriska säkerhetsåtgärder: krypterad anslutning (HTTPS), begränsad åtkomst till databasen, hashade lösenord, säker driftmiljö hos våra underleverantörer.
          </p>
        </Section>

        <Section heading="8. Dina rättigheter">
          <p>Enligt GDPR har du rätt att:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Begära ut en kopia av de uppgifter vi har om dig (registerutdrag)</li>
            <li>Få felaktiga uppgifter rättade</li>
            <li>Begära radering av dina uppgifter (&quot;rätten att bli glömd&quot;)</li>
            <li>Begära begränsning av behandlingen</li>
            <li>Invända mot behandling som baseras på berättigat intresse</li>
            <li>Få ut dina uppgifter i ett portabelt format (dataportabilitet)</li>
            <li>Återkalla samtycke när behandling baseras på samtycke</li>
            <li>Klaga hos Integritetsskyddsmyndigheten (IMY) om du anser att vi behandlar dina uppgifter felaktigt</li>
          </ul>
          <p>
            För att utöva någon av dessa rättigheter, mejla{' '}
            <Link href="mailto:hej@winefeed.se" className="text-[#722F37] underline hover:text-[#6B1818]">
              hej@winefeed.se
            </Link>
            . Vi svarar inom 30 dagar.
          </p>
        </Section>

        <Section heading="9. Cookies">
          <p>
            Information om hur vi använder cookies finns på vår{' '}
            <Link href="/cookies" className="text-[#722F37] underline hover:text-[#6B1818]">
              cookiesida
            </Link>
            .
          </p>
        </Section>

        <Section heading="10. Ändringar i policyn">
          <p>
            Vi kan komma att uppdatera den här policyn när tjänsten utvecklas. Större ändringar kommunicerar vi via e-post till registrerade användare. Senaste uppdateringsdatum visas högst upp på sidan.
          </p>
        </Section>

        <Section heading="11. Kontakt">
          <p>
            Frågor om policyn eller dina personuppgifter:{' '}
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
