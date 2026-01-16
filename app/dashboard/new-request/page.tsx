'use client';

import { useRouter } from 'next/navigation';
import { RequestForm } from '@/components/request-form';

export default function NewRequestPage() {
  const router = useRouter();

  const handleSuccess = (requestId: string) => {
    // Redirect till resultatsidan
    router.push(`/dashboard/results/${requestId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🍷</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Winefeed</h1>
              <p className="text-sm text-primary-foreground/80">Offertförfrågningar för restauranger</p>
              <p className="text-sm text-primary-foreground/70 mt-0.5">Hitta rätt vin till rätt pris – utan att ringa runt</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Trust Signal */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground">
            Utvecklad för restauranger – för menybyten, säsonger och vinuppdateringar
          </p>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Få offert på vin – anpassad för din restaurang
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Beskriv dina behov så genomsöker Winefeed marknaden och tar fram relevanta vinförslag med tydlig prisjämförelse.
          </p>
        </div>

        {/* Form Section - Moved Up */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Beställ offert
              </h3>
              <p className="text-muted-foreground">
                Beskriv vilka viner du söker så får du förslag på 30 sekunder
              </p>
            </div>
            <RequestForm onSuccess={handleSuccess} />
          </div>
        </div>

        {/* EU Wine Callout */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-gradient-to-r from-accent/20 to-secondary/20 border border-accent/30 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <span className="text-4xl">🇪🇺</span>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Nu även med direktleverans från EU
                </h3>
                <p className="text-muted-foreground mb-3">
                  Beställ viner direkt från franska, italienska och spanska producenter – levererat direkt till din restaurang. Vi samarbetar med licensierade importörer som hanterar all regelefterlevnad, punktskatt och tullklarering.
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-secondary">✓</span>
                    <span>Direktleverans från vingård till restaurang</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-secondary">✓</span>
                    <span>Transparent prissättning inkl. skatter och frakt</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-secondary">✓</span>
                    <span>All compliance hanteras av licensierad importör</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits - Moved Down */}
        <div className="max-w-5xl mx-auto mb-8">
          <h3 className="text-center text-xl font-semibold text-foreground mb-6">
            Så fungerar det
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">📝</div>
            <h3 className="font-semibold text-lg mb-2">1. Du beskriver behovet</h3>
            <p className="text-sm text-muted-foreground">
              Fyll i vilka viner du söker, budget, antal flaskor och eventuella specialkrav
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-semibold text-lg mb-2">2. Winefeed genomsöker marknaden</h3>
            <p className="text-sm text-muted-foreground">
              Vi matchar dina behov mot tillgängliga viner från licensierade leverantörer
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="font-semibold text-lg mb-2">3. Du jämför förslag & pris</h3>
            <p className="text-sm text-muted-foreground">
              Få vinförslag med prisjämförelse och kontakta leverantörer direkt
            </p>
          </div>
        </div>
      </div>

        {/* Footer Note */}
        <div className="max-w-3xl mx-auto">
          <div className="p-6 bg-muted/30 border border-border rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Så fungerar Winefeed</p>
                <p className="mb-3">
                  Winefeed är en teknisk och administrativ mellanhand som koordinerar vinleveranser mellan restauranger, licensierade importörer och producenter. Vi säljer inte vin själva och hanterar inga alkohollicenser.
                </p>
                <p className="text-xs">
                  <strong>För EU-viner:</strong> Vi samarbetar med godkända importörer som hanterar all regelefterlevnad, punktskatt, EMCS-dokumentation och tullklarering. Vinet levereras direkt från producent till din restaurang.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
