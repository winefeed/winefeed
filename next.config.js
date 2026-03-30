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

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.upstash.io https://www.google-analytics.com https://*.google-analytics.com https://o4510816780091392.ingest.de.sentry.io",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
    // Enable instrumentation for Sentry
    instrumentationHook: true,
  },
  async redirects() {
    return [
      {
        source: '/ior/:path*',
        destination: '/direct-import/:path*',
        permanent: true,
      },
      {
        source: '/api/ior/:path*',
        destination: '/api/direct-import/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/brasri',
        destination: '/catalog/brasri',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/(pitch|restauranger|leverantorer|signup)',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow' },
          { key: 'X-Content-Signal', value: 'ai-train=yes, search=yes, ai-input=yes' },
        ],
      },
    ];
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
