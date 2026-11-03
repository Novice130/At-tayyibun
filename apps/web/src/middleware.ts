import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  buildCsp,
  CSP_HEADER,
  CSP_REPORT_ONLY_HEADER,
  generateNonce,
  isCspEnforced,
  type CspHeader,
} from './lib/csp';

const PROTECTED_PREFIXES = ['/browse', '/requests', '/profile'];

const SESSION_COOKIE_NAMES = ['__Secure-better-auth.session_token', 'better-auth.session_token'];

// The 2FA challenge page is reached during a partial better-auth session where
// get-session returns null until verifyOtp completes — allow it through.
const ADMIN_EXEMPT = ['/admin/security/challenge'];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
}

// /api is proxied to the NestJS API, which sends its own helmet CSP; a second
// policy from here would be combined with it. Same exclusion the static header
// in next.config.js had.
function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

// NEXT_PUBLIC_* are inlined at build time, so they are read by name here.
// CSP_ENFORCE is read at runtime: report-only unless it is "true" or "1".
function cspFor(nonce: string): CspHeader {
  return buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== 'production',
    enforce: isCspEnforced(process.env.CSP_ENFORCE),
    firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
}

function withCsp(response: NextResponse, csp: CspHeader): NextResponse {
  response.headers.set(csp.name, csp.value);
  return response;
}

export function middleware(request: NextRequest) {
  // Canonical redirect www.attayyibun.com -> attayyibun.com
  // Preserves protocol, cookies, and search params without cross-subdomain cookie drops.
  const host = request.headers.get('host') || '';
  if (host.startsWith('www.')) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.host = host.replace(/^www\./, '');
    canonicalUrl.port = '';
    canonicalUrl.protocol = 'https:';
    return NextResponse.redirect(canonicalUrl, { status: 301 });
  }

  const { pathname } = request.nextUrl;

  if (isApiPath(pathname)) return NextResponse.next();

  // Only this middleware may set x-admin-exempt, x-nonce or the CSP request
  // header. Anything a client sent is dropped first: x-admin-exempt would
  // switch off the admin layout's gate, and Next takes its script nonce from
  // the CSP request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-admin-exempt');
  requestHeaders.delete('x-nonce');
  requestHeaders.delete(CSP_HEADER);
  requestHeaders.delete(CSP_REPORT_ONLY_HEADER);

  // A fresh nonce per request. Next reads it from the CSP request header and
  // puts it on its own scripts; the root layout reads x-nonce for ours.
  const nonce = generateNonce();
  const csp = cspFor(nonce);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(csp.name, csp.value);

  const next = () => withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
  const redirect = (url: URL) => withCsp(NextResponse.redirect(url), csp);

  if (pathname.startsWith('/admin')) {
    if (ADMIN_EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      // Tell the server admin layout to skip the authoritative session gate:
      // the 2FA challenge page renders during a partial session where
      // get-session returns null until verifyOtp completes.
      requestHeaders.set('x-admin-exempt', '1');
      return next();
    }
    // Cheap first gate: no session cookie, no admin page. The authoritative
    // role check lives in the admin server layout (full session verification).
    if (!hasSessionCookie(request)) {
      return redirect(new URL('/login', request.url));
    }
    return next();
  }

  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!hasSessionCookie(request)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return redirect(loginUrl);
    }
  }

  return next();
}

// Static files (_next/static, _next/image, images, avatars, favicon) need no
// CSP: it only governs documents. /monitoring is the Sentry tunnel.
export const config = {
  matcher: ['/((?!_next/static|_next/image|monitoring|avatars|favicon.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp|mp4)).*)'],
};
