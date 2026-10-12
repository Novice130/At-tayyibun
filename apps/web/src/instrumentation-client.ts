// Sentry init for the browser. No Session Replay: this site holds sensitive
// personal data, so the replay integration is deliberately never added.
// An empty/unset DSN disables the SDK entirely.
import * as Sentry from '@sentry/nextjs';

function rate(value: string | undefined, fallback: number): number {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || undefined,

  sampleRate: rate(process.env.NEXT_PUBLIC_SENTRY_SAMPLE_RATE, 1),
  tracesSampleRate: rate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.05),

  // v11 removed sendDefaultPii; dataCollection.userInfo: false replaces it.
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
