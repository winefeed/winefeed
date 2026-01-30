'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/ui/ErrorFallback';

/**
 * Global Error Boundary
 *
 * Catches unhandled errors in the application and displays a user-friendly error page.
 * This is the top-level error boundary for the entire app.
 *
 * Note: This does NOT catch errors in:
 * - root layout.tsx (use global-error.tsx for that)
 * - Server Components during initial render (handled by Next.js)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (and optionally to error tracking service)
    console.error('Global error boundary caught:', error);

    // TODO: Send to error tracking service (Sentry, etc.)
    // if (typeof window !== 'undefined') {
    //   Sentry.captureException(error);
    // }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Något gick fel
          </h1>
          <p className="text-gray-600">
            Vi kunde inte ladda sidan. Försök igen eller kontakta support om
            problemet kvarstår.
          </p>
        </div>

        <ErrorFallback
          error={error}
          reset={reset}
          title="Tekniskt fel"
        />

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-wine hover:underline text-sm font-medium"
          >
            Gå till startsidan
          </a>
        </div>
      </div>
    </div>
  );
}
