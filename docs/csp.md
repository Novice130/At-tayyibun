# Content-Security-Policy (web)

The web app's CSP is built per request in `apps/web/src/middleware.ts` from
`apps/web/src/lib/csp.ts`. `next.config.js` no longer sends one; it still sends
the other security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy,
Permissions-Policy).

## How it works

- Every request gets a fresh 128-bit nonce (Web Crypto). The middleware puts
  it in the CSP and on the request as `x-nonce`, plus the CSP itself as a
  request header. Next.js reads the nonce from that request header and adds it
  to its own scripts; the root layout reads `x-nonce` for the theme and JSON-LD
  scripts. Client-sent `x-nonce` and CSP request headers are dropped first.
- `script-src` is `'self' 'nonce-…' 'strict-dynamic'` plus host fallbacks for
  older browsers. No `'unsafe-inline'`, and no `'unsafe-eval'` outside
  `next dev`.
- `style-src` keeps `'unsafe-inline'`: React `style={{}}` props, Next's and
  sonner's `<style>` tags and reCAPTCHA need it.
- Allowed hosts: Firebase Auth (identitytoolkit, securetoken,
  firebaseinstallations, www.googleapis.com, the `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  frame, apis.google.com), reCAPTCHA (www.google.com/recaptcha,
  www.gstatic.com/recaptcha, recaptcha frames), Google and Apple sign-in,
  Google Fonts, storage.googleapis.com and googleusercontent.com images, and
  the Sentry ingest host from `NEXT_PUBLIC_SENTRY_DSN`. The API is same-origin
  under `/api`.
- Violations go to Sentry through `report-uri`, derived from
  `NEXT_PUBLIC_SENTRY_DSN`. No DSN, no reports (check the browser console).
- Not covered: `/api/*` (the NestJS API sends its own helmet headers),
  `/monitoring` (Sentry tunnel), and static files the middleware matcher skips
  (`_next/static`, `_next/image`, images, avatars, favicon).

Trade-off: the root layout reads `headers()`, so every page is rendered per
request. Pages such as `/about`, `/privacy` and `/terms` used to be prerendered
at build time. A nonce needs this: prerendered HTML cannot carry a
per-request nonce. The cost is paid in report-only mode too, kept on purpose so
the reports show what enforcement would block. If the load test shows the
public pages are a bottleneck, the fallback is to read the nonce only on
member routes and keep the marketing pages static with a hash-based policy.

## The switch: `CSP_ENFORCE`

| `CSP_ENFORCE`         | Header sent                           |
| --------------------- | ------------------------------------- |
| unset, empty, other   | `Content-Security-Policy-Report-Only` |
| `true` or `1`         | `Content-Security-Policy`             |

It is read at runtime by the middleware, so changing it needs a container
restart, not a rebuild. On the Hetzner server it belongs in
`/opt/sites/attayyibun/web.env`. Report-only is the default everywhere,
production included.

## Rolling to enforce

1. Deploy as is (report-only). Check that the header is there:
   `curl -sI https://attayyibun.com | grep -i content-security-policy`.
2. Watch Sentry's CSP reports and the browser console for at least a week of
   normal traffic. Walk through the risky flows by hand: phone verification
   (reCAPTCHA), Google and Apple sign-in, theme toggle, admin 2FA.
3. Fix or allow every real violation in `apps/web/src/lib/csp.ts` (update the
   tests in `csp.test.ts`). Ignore noise from browser extensions.
4. Set `CSP_ENFORCE=true` on staging first, repeat the flows, then production.
5. To back out, unset it and restart the web container.
