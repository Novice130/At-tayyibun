import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://2a74065b42da74329a1f8057003d772e@o4511251746455552.ingest.us.sentry.io/4511251751174144",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
