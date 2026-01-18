'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RequestForm } from '@/components/request-form';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NewRequestPage() {
  const router = useRouter();
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const handleSuccess = (requestId: string) => {
    // Redirect till resultatsidan
    router.push(`/dashboard/results/${requestId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Hero Section - Compact */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Beställ vinoffert
          </h1>
          <p className="text-lg text-muted-foreground">
            Beskriv dina behov så får du förslag på 30 sekunder
          </p>
        </div>

        {/* Form Section - Main Focus */}
        <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-6 md:p-8 mb-8">
          <RequestForm onSuccess={handleSuccess} />
        </div>

        {/* EU Wine Callout - Compact */}
        <div className="bg-gradient-to-r from-accent/20 to-secondary/20 border border-accent/30 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🇪🇺</span>
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                Direktleverans från EU
              </h3>
              <p className="text-sm text-muted-foreground">
                Beställ viner direkt från franska, italienska och spanska producenter.
                Vi hanterar all regelefterlevnad, punktskatt och tullklarering.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works - Collapsible */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span className="font-medium text-foreground">Så fungerar det</span>
            </div>
            {showHowItWorks ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          <div
            className={cn(
              'grid transition-all duration-300 ease-in-out',
              showHowItWorks
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0'
            )}
          >
            <div className="overflow-hidden">
              <div className="p-4 pt-0 grid md:grid-cols-3 gap-4">
                <div className="p-4 border border-border rounded-lg">
                  <div className="text-2xl mb-2">📝</div>
                  <h4 className="font-semibold text-sm mb-1">1. Beskriv behov</h4>
                  <p className="text-xs text-muted-foreground">
                    Fyll i viner, budget och antal flaskor
                  </p>
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <div className="text-2xl mb-2">🔍</div>
                  <h4 className="font-semibold text-sm mb-1">2. Vi söker</h4>
                  <p className="text-xs text-muted-foreground">
                    Matchar mot tillgängliga viner
                  </p>
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <div className="text-2xl mb-2">💰</div>
                  <h4 className="font-semibold text-sm mb-1">3. Jämför & beställ</h4>
                  <p className="text-xs text-muted-foreground">
                    Få förslag med prisjämförelse
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
