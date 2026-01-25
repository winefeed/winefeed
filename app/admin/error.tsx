'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { Home, RotateCcw, Shield } from 'lucide-react';

/**
 * Admin Section Error Boundary
 *
 * Catches errors within the admin section.
 * Shows more technical details since admin users are typically more technical.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin section error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Fel i Admin-sektionen
          </h2>
          <p className="text-gray-600 text-sm">
            Ett oväntat fel uppstod i administratörsgränssnittet.
          </p>
        </div>

        <ErrorFallback
          error={error}
          reset={reset}
          title="Admin-fel"
          showDetails={true}
        />

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7B1E1E] hover:bg-[#6B1818] rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Försök igen
          </button>
          <a
            href="/admin"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Admin-översikt
          </a>
        </div>

        {error.digest && (
          <div className="mt-6 p-3 bg-gray-100 rounded-lg text-center">
            <p className="text-xs text-gray-500">
              Referera till fel-ID vid felsökning:{' '}
              <code className="font-mono bg-gray-200 px-1 py-0.5 rounded">
                {error.digest}
              </code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
