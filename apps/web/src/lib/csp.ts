// Content-Security-Policy for the web app, built per request by
// src/middleware.ts with a fresh nonce. See docs/csp.md.
//
// Everything here is a pure function of its inputs so it can be unit tested
// and run in the edge runtime (no Node APIs).

export const CSP_HEADER = 'Content-Security-Policy';
export const CSP_REPORT_ONLY_HEADER = 'Content-Security-Policy-Report-Only';

// Same fallback as src/lib/firebase-client.ts. Firebase Auth frames this host.
export const DEFAULT_FIREBASE_AUTH_DOMAIN = 'at-tayyibun-e3f79.firebaseapp.com';

export interface CspOptions {
  /** Base64 nonce for this request. */
  nonce: string;
  /** true under `next dev`: React Refresh needs eval and a websocket. */
  isDev: boolean;
  /** true sends Content-Security-Policy; false (the default) sends Report-Only. */
  enforce?: boolean;
  /** NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN. */
  firebaseAuthDomain?: string;
  /** NEXT_PUBLIC_SENTRY_DSN. Gives the report-uri and the ingest origin. */
  sentryDsn?: string;
}

export interface CspHeader {
  name: typeof CSP_HEADER | typeof CSP_REPORT_ONLY_HEADER;
  value: string;
}

/**
 * CSP_ENFORCE switch. Only an explicit "true" or "1" enforces; anything else,
 * including unset, keeps the policy report-only.
 */
export function isCspEnforced(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1';
}

/** 128 random bits, base64. Web Crypto, so it works in the edge runtime. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function parseDsn(dsn: string | undefined): URL | null {
  if (!dsn) return null;
  try {
    return new URL(dsn);
  } catch {
    return null;
  }
}

/**
 * Turns the public DSN into Sentry's security endpoint so CSP violation
 * reports land in Sentry next to the app's errors. No DSN, no report-uri.
 */
export function sentryCspReportUri(dsn: string | undefined): string | null {
  const url = parseDsn(dsn);
  if (!url) return null;
  const projectId = url.pathname.replace(/^\//, '');
  if (!url.username || !projectId) return null;
  return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${url.username}`;
}

/** The DSN's ingest origin, e.g. https://o123.ingest.us.sentry.io. */
export function sentryIngestOrigin(dsn: string | undefined): string | null {
  const url = parseDsn(dsn);
  if (!url || url.protocol !== 'https:') return null;
  return `${url.protocol}//${url.host}`;
}

// A bare hostname only: anything else would let an env value inject
// directives into the header.
function safeHost(host: string | undefined): string {
  const h = (host ?? '').trim();
  return /^[a-z0-9.-]+$/i.test(h) ? h : DEFAULT_FIREBASE_AUTH_DOMAIN;
}

export function buildCsp(opts: CspOptions): CspHeader {
  const { nonce, isDev } = opts;
  const authDomain = safeHost(opts.firebaseAuthDomain);
  const reportUri = sentryCspReportUri(opts.sentryDsn);
  const sentryOrigin = sentryIngestOrigin(opts.sentryDsn);

  const directives: string[] = [
    "default-src 'self'",
    // Browsers with 'strict-dynamic' (all current ones) trust only nonced
    // scripts and what they load, and ignore 'self' and the hosts. The hosts
    // are the fallback for older browsers: Firebase's gapi loader, reCAPTCHA,
    // and Apple's sign-in JS. No 'unsafe-inline': every inline script the app
    // renders carries the nonce. Dev adds 'unsafe-eval' for React Refresh.
    [
      'script-src',
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      'https://apis.google.com',
      'https://www.google.com/recaptcha/',
      'https://www.gstatic.com/recaptcha/',
      'https://appleid.cdn-apple.com',
    ].join(' '),
    // 'unsafe-inline' stays for styles: React style={{}} props, Next's and
    // sonner's injected <style> tags, and reCAPTCHA all need it. A nonce here
    // would switch 'unsafe-inline' off, so styles get none.
    // Google Fonts is pulled in by the @import in src/app/globals.css.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // storage.googleapis.com matches images.remotePatterns; googleusercontent.com
    // is the avatar a Google sign-in leaves in user.image.
    "img-src 'self' data: blob: https://storage.googleapis.com https://*.googleusercontent.com",
    // The API is same-origin under /api. Firebase phone auth: token exchange,
    // installations and the invisible reCAPTCHA. Sentry normally goes through
    // the same-origin /monitoring tunnel; its ingest origin is the fallback.
    [
      'connect-src',
      "'self'",
      ...(isDev ? ['ws:'] : []),
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://firebaseinstallations.googleapis.com',
      'https://www.googleapis.com',
      'https://www.google.com',
      ...(sentryOrigin ? [sentryOrigin] : []),
    ].join(' '),
    // reCAPTCHA, the Firebase auth handler, and the Google/Apple sign-in pages.
    [
      'frame-src',
      'https://www.google.com',
      'https://recaptcha.google.com',
      `https://${authDomain}`,
      'https://accounts.google.com',
      'https://appleid.apple.com',
    ].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    // Google and Apple sign-in redirect away from our pages.
    "form-action 'self' https://accounts.google.com https://appleid.apple.com",
    "frame-ancestors 'none'",
  ];
  if (reportUri) directives.push(`report-uri ${reportUri}`);

  return {
    name: opts.enforce ? CSP_HEADER : CSP_REPORT_ONLY_HEADER,
    value: directives.join('; '),
  };
}
