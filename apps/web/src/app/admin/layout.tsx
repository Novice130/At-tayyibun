import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import AdminShell from './layout.client';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

/**
 * Server-side admin gate. Unlike the cookie-presence check in middleware.ts,
 * this performs the authoritative better-auth session verification (signature
 * + expiry + DB) before any admin markup is rendered.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  // Set by middleware for the 2FA challenge page, which renders during a
  // partial better-auth session (get-session returns null until verifyOtp).
  if (hdrs.get('x-admin-exempt') === '1') {
    return <>{children}</>;
  }

  const session = await auth.api
    .getSession({ headers: hdrs })
    .catch(() => null);

  if (!session) {
    redirect('/login');
  }
  const role = (session.user as Record<string, unknown>)?.role;
  if (typeof role !== 'string' || !ADMIN_ROLES.has(role)) {
    redirect('/browse');
  }

  return <AdminShell>{children}</AdminShell>;
}
