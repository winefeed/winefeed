/** @type {import('next').NextConfig} */

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
  },
};

module.exports = nextConfig;
