// Sentry temporarily disabled — was hanging Dokploy builds on 3.7 GiB VPS.
// const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;

// module.exports = withSentryConfig(nextConfig, {
//   org: "learnnovicecom",
//   project: "javascript-nextjs",
//   silent: !process.env.CI,
//   widenClientFileUpload: false,
//   tunnelRoute: "/monitoring",
//   hideSourceMaps: true,
//   webpack: {
//     treeshake: { removeDebugLogging: true },
//     automaticVercelMonitors: true,
//     reactComponentAnnotation: { enabled: true },
//   },
// });
