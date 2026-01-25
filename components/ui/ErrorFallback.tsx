'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  showDetails?: boolean;
}

/**
 * Reusable error fallback component for error boundaries
 *
 * Usage:
 * - In error.tsx files: <ErrorFallback error={error} reset={reset} />
 * - Standalone: <ErrorFallback error={error} title="Custom Title" />
 */
export function ErrorFallback({
  error,
  reset,
  title = 'Ett fel uppstod',
  showDetails = process.env.NODE_ENV === 'development',
}: ErrorFallbackProps) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 text-lg">{title}</h3>
          <p className="text-red-700 mt-2">{error.message}</p>

          {showDetails && error.digest && (
            <p className="text-red-500 text-sm mt-2">
              Fel-ID: {error.digest}
            </p>
          )}

          {showDetails && error.stack && (
            <details className="mt-4">
              <summary className="text-red-600 text-sm cursor-pointer hover:underline">
                Visa tekniska detaljer
              </summary>
              <pre className="mt-2 p-3 bg-red-100 rounded text-xs text-red-800 overflow-x-auto whitespace-pre-wrap">
                {error.stack}
              </pre>
            </details>
          )}

          {reset && (
            <button
              onClick={reset}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Försök igen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact error display for inline use
 */
export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
