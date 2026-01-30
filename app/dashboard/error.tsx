'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { Home, RotateCcw } from 'lucide-react';

/**
 * Dashboard Error Boundary
 *
 * Catches errors within the dashboard section and displays a user-friendly error page
 * while keeping the rest of the app functional.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Fel i Dashboard
          </h2>
          <p className="text-gray-600 text-sm">
            Ett fel uppstod när vi försökte ladda dashboard-innehållet.
          </p>
        </div>

        <ErrorFallback
          error={error}
          reset={reset}
          title="Dashboard-fel"
        />

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-wine hover:bg-wine-hover rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Ladda om
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
