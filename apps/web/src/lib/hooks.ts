'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from './api';
import { authClient, useSession } from './auth-client';

/**
 * Gate a page on an authenticated session.
 *
 * Replaces the `if (!isPending && !session) router.push('/login')` pattern that
 * was copy-pasted across the app. That pattern bounced freshly-signed-in users
 * straight back to /login: better-auth resolves `signIn.email` first and only
 * flips its session signal on a 10ms timer, so a page mounting in that window
 * reads a stale `{ data: null, isPending: false }`. `isPending` is also not a
 * reliable boot flag — the client recomputes it as `data === null` on every
 * refetch, so it is false during a settled-but-null state.
 *
 * Instead of trusting the cached atom, re-verify against the server once before
 * redirecting.
 */
export function useRequireSession() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [verifying, setVerifying] = useState(true);
  // Result of the explicit re-check. Held locally rather than relying on the
  // hook's atom picking it up, so the page can render either way.
  const [verifiedSession, setVerifiedSession] = useState<unknown>(null);
  const redirected = useRef(false);

  useEffect(() => {
    if (session) {
      setVerifying(false);
      return;
    }
    if (isPending) return;

    let cancelled = false;
    const bounce = () => {
      if (redirected.current) return;
      redirected.current = true;
      router.replace('/login');
    };

    authClient
      .getSession()
      .then((res) => {
        if (cancelled) return;
        setVerifying(false);
        if (res?.data) {
          setVerifiedSession(res.data);
          return;
        }
        bounce();
      })
      .catch(() => {
        if (cancelled) return;
        setVerifying(false);
        bounce();
      });

    return () => {
      cancelled = true;
    };
  }, [session, isPending, router]);

  const effectiveSession = session ?? verifiedSession;
  return { session: effectiveSession as typeof session, loading: isPending || verifying };
}

interface IncomingRequestRow {
  id: string;
  status: string;
}

/**
 * Count of pending incoming requests, for the Requests nav badge.
 * Refetches on navigation so the badge clears once the user acts on them.
 */
export function useIncomingRequestCount() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) {
      setCount(0);
      return;
    }
    try {
      const rows = await api.get('/requests/incoming');
      if (Array.isArray(rows)) {
        setCount((rows as IncomingRequestRow[]).filter((r) => r.status === 'PENDING').length);
      }
    } catch {
      // Badge is non-critical — leave the previous count on failure.
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  return { count, refresh };
}
