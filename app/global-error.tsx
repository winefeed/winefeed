'use client';

/**
 * GLOBAL ERROR BOUNDARY
 *
 * This catches errors in the root layout.tsx file.
 * It must define its own <html> and <body> tags since the root layout is broken.
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="sv">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#111827' }}>
              Något gick fel
            </h1>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Ett oväntat fel uppstod. Försök ladda om sidan.
            </p>
            <button
              onClick={() => reset()}
              style={{
                backgroundColor: '#722F37',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Försök igen
            </button>
            <div style={{ marginTop: '1rem' }}>
              <a
                href="/"
                style={{ color: '#722F37', textDecoration: 'none', fontSize: '0.875rem' }}
              >
                Gå till startsidan
              </a>
            </div>
            {error.digest && (
              <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                Fel-ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
