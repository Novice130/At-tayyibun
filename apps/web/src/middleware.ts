import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/browse', '/requests', '/profile'];

const SESSION_COOKIE_NAMES = ['__Secure-better-auth.session_token', 'better-auth.session_token'];

// The 2FA challenge page is reached during a partial better-auth session where
// get-session returns null until verifyOtp completes — allow it through.
const ADMIN_EXEMPT = ['/admin/security/challenge'];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (ADMIN_EXEMPT.some((p) => pathname.startsWith(p))) {
      // Tell the server admin layout to skip the authoritative session gate:
      // the 2FA challenge page renders during a partial session where
      // get-session returns null until verifyOtp completes.
      const res = NextResponse.next();
      res.headers.set('x-admin-exempt', '1');
      return res;
    }
    // Cheap first gate: no session cookie, no admin page. The authoritative
    // role check lives in the admin server layout (full session verification).
    if (!hasSessionCookie(request)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!hasSessionCookie(request)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/browse/:path*', '/requests/:path*', '/profile/:path*'],
};

