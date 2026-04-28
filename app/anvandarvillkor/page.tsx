import { Metadata } from 'next';
import Link from 'next/link';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export const metadata: Metadata = {
  title: 'Användarvillkor — Winefeed',
  description:
    'Användarvillkor för Winefeeds B2B-marknadsplats för svenska restauranger och vinimportörer.',
  alternates: { canonical: 'https://winefeed.se/anvandarvillkor' },
};

export default function AnvandarvillkorPage() {
  return (
    <div className="bg-[#fbfaf7] min-h-screen">
      <EditorialHeader />
      <main className="max-w-[820px] mx-auto px-5 sm:px-8 py-16 md:py-24">
        <p className="text-sm text-[#828181] mb-3">Senast uppdaterad: 28 april 2026</p>
        <h1 className="font-[family-name:var(--font-playfair)] text-[40px] md:text-[52px] leading-[1.05] tracking-[-0.022em] text-[#161412] mb-8">
          Användarvillkor
        </h1>
        <p className="text-[17px] leading-[1.65] text-[#161412] mb-10">
          De här villkoren reglerar din användning av Winefeed (&quot;Tjänsten&quot;), en B2B-marknadsplats som drivs av Winefeed AB (&quot;Winefeed&quot;, &quot;vi&quot;). Genom att skapa ett konto eller använda Tjänsten godkänner du dessa villkor.
        </p>

        <Section heading="1. Tjänsten">
          <p>
            Winefeed är en förmedlingsplattform där svenska restauranger, hotell och vinbarer kan hitta viner och skicka förfrågningar till vinimportörer. Vinimportörer kan i sin tur ta emot förfrågningar, lämna offerter och leverera direkt till restaurangen.
          </p>
          <p>
            <strong>Winefeed är en förmedlare, inte säljare eller köpare.</strong> Avtalet om köp och leverans sluts direkt mellan restaurangen och importören. Winefeed ansvarar inte för varorna, leveranstid, betalning eller andra åtaganden mellan parterna.
          </p>
        </Section>

        <Section heading="2. Användarkonton">
          <p>
            För att använda Tjänsten krävs ett konto. Du intygar att uppgifter du lämnar är korrekta och att du har behörighet att binda det företag du representerar.
          </p>
          <p>
            Du ansvarar för att hålla dina inloggningsuppgifter säkra och att inte dela dem med obehöriga. Misstänker du att kontot har komprometterats — meddela oss omedelbart.
          </p>
          <p>
            Restauranger måste ha giltigt serveringstillstånd enligt alkohollagen för att kunna acceptera offerter. Importörer måste ha giltigt partihandelstillstånd. Vi förbehåller oss rätten att verifiera detta innan transaktioner tillåts.
          </p>
        </Section>

        <Section heading="3. Användning">
          <p>Du förbinder dig att:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Bara använda Tjänsten för legitima affärsändamål</li>
            <li>Inte försöka kringgå säkerhetsmekanismer eller komma åt data du inte har behörighet till</li>
            <li>Inte skicka spam, falska förfrågningar eller missbruka broadcast-funktionen</li>
            <li>Inte ladda upp innehåll som strider mot lag eller tredjepartsrättigheter</li>
            <li>Följa svensk alkohollagstiftning och relevanta branschregler</li>
          </ul>
          <p>
            Vi förbehåller oss rätten att stänga av konton som missbrukar tjänsten, utan ersättning till användaren.
          </p>
        </Section>

        <Section heading="4. Avgifter">
          <p>
            Det är kostnadsfritt att registrera sig och använda Tjänsten. Winefeed tar en provision (&quot;success fee&quot;) på 4 % av accepterade ordrar mellan restaurang och importör, med ett lägsta belopp om 149 kr och ett högsta belopp om 1 995 kr per order.
          </p>
          <p>
            Provisionen faktureras månadsvis i efterskott till importören. Provisionen avser introduktionen — efterföljande beställningar mellan samma restaurang och importör är avgiftsfria.
          </p>
          <p>
            Avgiftsnivåer kan ändras med 30 dagars varsel via e-post.
          </p>
        </Section>

        <Section heading="5. Innehåll och ansvar">
          <p>
            Importörer ansvarar för att produktinformation (namn, pris, vintage, lagerstatus) är korrekt. Restauranger ansvarar för att förfrågningar är seriösa och att de har avsikt att slutföra affären om en passande offert lämnas.
          </p>
          <p>
            Winefeed ansvarar inte för felaktig produktinformation, leveransförseningar, kvalitetsbrister eller betalningstvister mellan restaurang och importör.
          </p>
        </Section>

        <Section heading="6. Immateriella rättigheter">
          <p>
            Winefeeds varumärke, design, källkod och databasens struktur tillhör Winefeed AB. Du får använda Tjänsten enligt dessa villkor men inte kopiera, modifiera eller skrapa innehåll utan vårt skriftliga godkännande.
          </p>
          <p>
            Innehåll du laddar upp (bilder, beskrivningar, prislistor) förblir ditt. Genom att ladda upp ger du Winefeed en licens att visa innehållet på plattformen i syfte att leverera Tjänsten.
          </p>
        </Section>

        <Section heading="7. Ansvarsbegränsning">
          <p>
            Tjänsten tillhandahålls &quot;i befintligt skick&quot;. Vi strävar efter hög tillgänglighet men garanterar inte att Tjänsten alltid är felfri eller tillgänglig.
          </p>
          <p>
            Winefeeds totala ansvar mot dig är, oavsett grund, begränsat till vad du betalat till Winefeed under de senaste 12 månaderna. Vi ansvarar inte för indirekta skador, utebliven vinst, datatapp eller följdskador.
          </p>
        </Section>

        <Section heading="8. Personuppgifter">
          <p>
            Hur vi behandlar personuppgifter beskrivs i vår{' '}
            <Link href="/integritetspolicy" className="text-[#722F37] underline hover:text-[#6B1818]">
              integritetspolicy
            </Link>
            .
          </p>
        </Section>

        <Section heading="9. Uppsägning">
          <p>
            Du kan när som helst säga upp ditt konto genom att kontakta oss. Påbörjade transaktioner och uppstådda provisionsavgifter ska slutföras innan kontot stängs.
          </p>
          <p>
            Vi kan säga upp avtalet med 30 dagars varsel, eller omedelbart vid väsentligt avtalsbrott från din sida.
          </p>
        </Section>

        <Section heading="10. Ändringar">
          <p>
            Vi kan komma att uppdatera dessa villkor. Större ändringar kommunicerar vi via e-post med minst 30 dagars varsel. Fortsatt användning efter ändringen innebär att du godkänner de nya villkoren.
          </p>
        </Section>

        <Section heading="11. Tillämplig lag och tvist">
          <p>
            Svensk lag tillämpas. Tvister ska i första hand lösas genom dialog. Om det inte lyckas avgörs tvisten av allmän domstol med Stockholms tingsrätt som första instans.
          </p>
        </Section>

        <Section heading="12. Kontakt">
          <p>
            Frågor om villkoren:{' '}
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
