/**
 * SENTRY SERVER CONFIG
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set sample rate for performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Filter out noisy errors
  ignoreErrors: [
    // Expected errors
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],

  // Add context to server errors
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }

    // Add extra context for debugging
    const error = hint.originalException;
    if (error && typeof error === 'object' && 'message' in error) {
      event.fingerprint = [String(error.message)];
    }

    return event;
  },
});
