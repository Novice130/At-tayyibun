const { withSentryConfig } = require('@sentry/nextjs/config');

const isProd = process.env.NODE_ENV === 'production';

// Same fallback as src/lib/firebase-client.ts. Firebase Auth frames this host.
const firebaseAuthDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'at-tayyibun-e3f79.firebaseapp.com';

// Turns the public DSN into Sentry's security endpoint so CSP violation
// reports land in Sentry next to the app's errors. No DSN, no report-uri.
function sentryCspReportUri() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !projectId) return null;
    return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${url.username}`;
  } catch {
    return null;
  }
}
const cspReportUri = sentryCspReportUri();

// Built from what the browser actually loads. Sentry goes through the
// same-origin /monitoring tunnel, so it needs no entry of its own.
// 'unsafe-inline' scripts are needed because Next.js injects inline scripts
// and we do not use nonces. Dev adds 'unsafe-eval' and ws: for React Refresh.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://www.google.com https://www.gstatic.com https://apis.google.com`,
  // Google Fonts is pulled in by the @import in src/app/globals.css.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // storage.googleapis.com matches images.remotePatterns; googleusercontent.com
  // is the avatar a Google sign-in leaves in user.image.
  "img-src 'self' data: blob: https://storage.googleapis.com https://*.googleusercontent.com",
  // Firebase phone auth: token exchange plus the invisible reCAPTCHA.
  `connect-src 'self'${isProd ? '' : ' ws:'} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://www.google.com`,
  `frame-src https://www.google.com https://recaptcha.google.com https://${firebaseAuthDomain}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  cspReportUri && `report-uri ${cspReportUri}`,
]
  .filter(Boolean)
  .join('; ');

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
  // Report-only for now. Once Sentry (or the browser console) has shown no
  // real violations for a while, rename this to Content-Security-Policy.
  { key: 'Content-Security-Policy-Report-Only', value: csp },
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
