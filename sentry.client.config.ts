/**
 * SENTRY CLIENT CONFIG
 *
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set sample rate for performance monitoring
  // Adjust this value in production (0.1 = 10% of transactions)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay disabled — captures user interactions (clicks, scroll, keystrokes)
  // and would require cookie consent banner under LEK § 6 a. Re-enable with explicit
  // consent flow if behavioral debugging becomes necessary.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /chrome-extension/,
    /moz-extension/,
    // Network errors that aren't actionable
    'NetworkError',
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User cancelled
    'AbortError',
    // ResizeObserver (common, not actionable)
    'ResizeObserver loop',
  ],

  // Add context
  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }
    return event;
  },
});
