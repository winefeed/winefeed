/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

// Parse allowed origins from environment variable or use defaults
const getAllowedOrigins = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const origins = ['localhost:3000'];

  if (appUrl) {
    try {
      const url = new URL(appUrl);
      origins.push(url.host);
    } catch {
      // Invalid URL, ignore
    }
  }

  return origins;
};

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
    // Enable instrumentation for Sentry
    instrumentationHook: true,
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Only upload source maps in production builds
  silent: true,

  // Suppresses source map uploading logs during build
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Upload source maps to Sentry (requires SENTRY_AUTH_TOKEN)
  // Set to false if you don't want to upload source maps
  sourceMaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
};

// Wrap with Sentry only if DSN is configured
module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
