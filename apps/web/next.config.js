const { withSentryConfig } = require('@sentry/nextjs/config');

const isProd = process.env.NODE_ENV === 'production';

// Content-Security-Policy is not set here: src/middleware.ts builds it per
// request with a fresh script nonce (src/lib/csp.ts, docs/csp.md).
const securityHeaders = [
  // Matches the API's helmet value minus `preload`: the domain is not on the
  // preload list, and asking for it is hard to undo.
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()',
  },
];

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
  // /api is proxied to the NestJS API, which sets its own helmet headers;
  // adding ours there would send duplicates. /monitoring is the Sentry tunnel.
  async headers() {
    return [
      {
        source: '/((?!api/|api$|monitoring).*)',
        headers: securityHeaders,
      },
    ];
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
