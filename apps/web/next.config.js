const { withSentryConfig } = require("@sentry/nextjs");

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

module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "learnnovicecom",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#map-sourcemaps-to-sentry-release
  widenClientFileUpload: true,

  // If you're using a project-specific auth token, you can set it here:
  // authToken: process.env.SENTRY_AUTH_TOKEN,

  // Automatically annotate React components to show their full name in breadcrumbs and profiling spans;
  // see https://docs.sentry.io/platforms/javascript/guides/nextjs/features/component-names/
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // See https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#tunnel-requests
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router config route handlers.)
  // See https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#vercel-cron-monitors
  automaticVercelMonitors: true,
});
