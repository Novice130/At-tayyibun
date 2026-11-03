'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { authClient, useSession } from '@/lib/auth-client';
import { PENDING_EMAIL_CHANGED, readPendingEmail } from '@/lib/email-gate';

/**
 * Shown while a phone-first member's new email waits for its confirmation
 * link (see lib/email-gate.ts). Stays until the address is confirmed: the
 * placeholder flag clears then, and so does this.
 */
export function PendingEmailBanner() {
  const { data: session } = useSession();
  const user = session?.user as { id?: string; emailIsPlaceholder?: boolean } | undefined;
  const userId = user?.id;
  const placeholder = Boolean(user?.emailIsPlaceholder);
  const [email, setEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!placeholder) {
      setEmail(null);
      return;
    }
    const load = () => setEmail(readPendingEmail(userId)?.email ?? null);
    load();
    window.addEventListener(PENDING_EMAIL_CHANGED, load);
    return () => window.removeEventListener(PENDING_EMAIL_CHANGED, load);
  }, [placeholder, userId]);

  if (!placeholder || !email) return null;

  const resend = async () => {
    setSending(true);
    try {
      const res = await authClient.changeEmail({ newEmail: email, callbackURL: '/profile' });
      if (res.error) {
        toast.error(res.error.message || 'Could not send the link. Please try again later.');
        return;
      }
      // Better Auth answers the same when the address is taken and sends nothing.
      toast.success(`If ${email} can be used, a new link is on its way.`);
    } catch {
      toast.error('Could not send the link. Please try again later.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="status"
      className="border-t border-border/50 text-xs sm:text-sm"
      style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Mail className="w-4 h-4 text-gold-500 flex-shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">
          <strong style={{ color: 'var(--color-text)' }}>Confirm your email:</strong> we sent a link to{' '}
          <span className="break-all">{email}</span>. If it does not arrive, that address may already be in use.
        </span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="font-medium text-gold-500 hover:underline disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Resend'}
          </button>
          <Link href="/profile/setup" className="font-medium text-gold-500 hover:underline">
            Change
          </Link>
        </span>
      </div>
    </div>
  );
}
