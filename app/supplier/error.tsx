'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { Home, RotateCcw, Phone } from 'lucide-react';

/**
 * Supplier Portal Error Boundary
 *
 * Catches errors within the supplier portal section.
 * Provides supplier-specific error handling and support options.
 */
export default function SupplierError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Supplier portal error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Fel i Leverantörsportalen
          </h2>
          <p className="text-muted-foreground text-sm">
            Ett fel uppstod. Om problemet kvarstår, kontakta Winefeed support.
          </p>
        </div>

        <ErrorFallback
          error={error}
          reset={reset}
          title="Leverantörsfel"
        />

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-wine hover:bg-primary/90 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Försök igen
          </button>
          <a
            href="/supplier"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Leverantörsportal
          </a>
        </div>

        <div className="mt-8 p-4 bg-muted rounded-lg border border-border">
          <h3 className="text-sm font-medium text-foreground mb-2">
            Behöver du hjälp?
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Kontakta vår support om du har problem med din leverantörsportal.
          </p>
          <a
            href="mailto:hej@winefeed.se"
            className="inline-flex items-center gap-2 text-sm text-wine hover:underline"
          >
            <Phone className="w-4 h-4" />
            hej@winefeed.se
          </a>
        </div>
      </div>
    </div>
  );
}
