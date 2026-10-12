// Sentry init for the Edge runtime (middleware and edge routes). Loaded from src/instrumentation.ts.
// An empty/unset DSN disables the SDK entirely.
import * as Sentry from '@sentry/nextjs';

function rate(value: string | undefined, fallback: number): number {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || undefined,
  release: process.env.SENTRY_RELEASE || undefined,

  sampleRate: rate(process.env.SENTRY_SAMPLE_RATE || process.env.NEXT_PUBLIC_SENTRY_SAMPLE_RATE, 1),
  tracesSampleRate: rate(
    process.env.SENTRY_TRACES_SAMPLE_RATE || process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    0.05,
  ),

  // Matrimonial site: never attach user identity or request payloads.
  // (v11 removed sendDefaultPii; dataCollection.userInfo: false is its replacement.)
  dataCollection: {
    userInfo: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    httpBodies: [],
    httpHeaders: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    cookies: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  },
});
