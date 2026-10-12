const { withSentryConfig } = require('@sentry/nextjs/config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // firebase-admin pulls in gRPC/protobuf native deps. Bundling them breaks the
  // build; leave it external so it is required at runtime from node_modules.
  serverExternalPackages: ['firebase-admin'],
  images: {
    remotePatterns: [
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

// Source maps are uploaded only when SENTRY_AUTH_TOKEN is present (CI passes it
// as a BuildKit secret). Without it the build skips Sentry's upload and release
// calls silently. The runtime SDK is configured in sentry.*.config.ts and
// src/instrumentation*.ts, and is disabled when no DSN is set.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

module.exports = withSentryConfig(nextConfig, {
  org: 'learnnovicecom',
  project: process.env.SENTRY_PROJECT || 'attayyibun-web',
  authToken: sentryAuthToken,
  silent: !process.env.CI,
  telemetry: false,
  // Events go through the same origin so ad-blockers do not drop them.
  // /monitoring is excluded from src/middleware.ts's matcher.
  tunnelRoute: '/monitoring',
  release: {
    name: process.env.SENTRY_RELEASE || undefined,
    create: Boolean(sentryAuthToken),
    finalize: Boolean(sentryAuthToken),
    setCommits: false,
  },
  sourcemaps: { disable: !sentryAuthToken },
  // A Sentry outage or bad token must never fail the image build.
  errorHandler: (err) => {
    console.warn(`[sentry] build step skipped: ${err.message}`);
  },
  // Session Replay is never enabled, so drop its code from the client bundle.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
