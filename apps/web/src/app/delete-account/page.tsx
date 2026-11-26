'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LogIn, Mail, ShieldAlert, Smartphone, Trash2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { LEGAL } from '@/lib/legal';

export default function DeleteAccountPage() {
  const { data: session, isPending } = useSession();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (confirmText !== 'DELETE' || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete('/users/me');
      await fetch('/auth/sign-out', { method: 'POST' }).catch(() => {});
      setDeleted(true);
    } catch (err: any) {
      setError(
        err?.message || 'Failed to delete your account. Please sign in again and retry, or email us.',
      );
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <div className="text-center mb-8">
            <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              Delete <span className="text-gradient-gold">Account</span>
            </h1>
            <p className="text-secondary max-w-xl mx-auto">
              Permanently delete your At-Tayyibun account and personal data from the mobile app,
              directly on this page, or by contacting support.
            </p>
          </div>

          {/* Interactive web deletion (signed-in) or request options (signed-out) */}
          <div className="card p-6 sm:p-8">
            {deleted ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="w-10 h-10 text-gold-500 mx-auto" />
                <h2 className="font-heading text-2xl font-semibold">Account deleted</h2>
                <p className="text-secondary">
                  Your At-Tayyibun account and profile data have been permanently deleted.
                </p>
                <div className="pt-2">
                  <Link href="/" className="btn-primary inline-flex">
                    Return Home
                  </Link>
                </div>
              </div>
            ) : isPending ? (
              <p className="text-secondary text-sm">Checking your session...</p>
            ) : session ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Trash2 className="w-6 h-6 text-red-400" />
                  <h2 className="font-heading text-xl font-semibold">
                    Delete your account now
                  </h2>
                </div>
                <p className="text-secondary text-sm">
                  Signed in as <strong>{session.user?.email}</strong>. Deletion is immediate and
                  cannot be undone. Type <strong>DELETE</strong> below to confirm.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  aria-label="Type DELETE to confirm"
                  className="input w-full"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={confirmText !== 'DELETE' || deleting}
                  className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-5 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {deleting ? 'Deleting account...' : 'Permanently delete my account'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <LogIn className="w-6 h-6 text-gold-500" />
                  <h2 className="font-heading text-xl font-semibold">
                    Delete from the web
                  </h2>
                </div>
                <p className="text-secondary">
                  Sign in to delete your account immediately on this page, or email us from the
                  address registered on your account if you can no longer sign in.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href="/login?next=/delete-account" className="btn-primary inline-flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Sign in to delete immediately
                  </Link>
                  <a
                    href={`mailto:${LEGAL.contactEmail}?subject=Account%20Deletion%20Request`}
                    className="btn border border-border hover:border-gold-500/60 inline-flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4 text-gold-500" />
                    Email {LEGAL.contactEmail}
                  </a>
                </div>
                <p className="text-muted text-sm">
                  We confirm the request came from the account&apos;s owner, then delete the account
                  within 7 days.
                </p>
              </div>
            )}
          </div>

          {/* In-app deletion instructions */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Smartphone className="w-6 h-6 text-gold-500" />
              <h2 className="font-heading text-xl font-semibold">How to delete in the mobile app</h2>
            </div>
            <ol className="list-decimal pl-5 text-secondary space-y-2">
              <li>Open At-Tayyibun and sign in to your account.</li>
              <li>
                Go to the <strong>Profile</strong> tab and scroll to <strong>Danger Zone</strong>{' '}
                (if your account is suspended, the delete option appears directly on the suspended
                screen).
              </li>
              <li>
                Tap <strong>Delete account</strong>, confirm, and type <strong>DELETE</strong>.
              </li>
            </ol>
          </div>

          {/* Exact data deleted vs retained */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-gold-500" />
              <h2 className="font-heading text-xl font-semibold">
                What is deleted and what is kept
              </h2>
            </div>

            <div className="text-secondary space-y-2">
              <p className="font-medium text-primary">Deleted immediately and permanently:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Your account record, profile, photos, encrypted last name, bio, biodata, and
                  guardian contact details.
                </li>
                <li>
                  All contact requests, skip reasons, messages, block records, and email campaign
                  entries linked to your account.
                </li>
                <li>
                  All active sessions, linked Google/Apple sign-in records, two-factor settings,
                  and mobile push notification tokens. If Sign in with Apple was linked, we also
                  revoke the Apple authorization token.
                </li>
                <li>
                  Your phone number&apos;s record at our verification provider (Firebase
                  Authentication).
                </li>
              </ul>
            </div>

            <div className="text-secondary space-y-2 pt-2">
              <p className="font-medium text-primary">Retained after deletion:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  A log entry recording that an account was deleted. It holds the account&apos;s
                  random internal ID and the time, not your name, email or phone number. Kept
                  indefinitely as a security record.
                </li>
                <li>
                  Safety and moderation reports submitted by or about the account, with the link to
                  your account removed. Kept as long as needed to keep members safe.
                </li>
                <li>
                  Our database provider&apos;s (Neon) restore history, which can hold deleted data
                  for up to 7 days before it expires automatically.
                </li>
                <li>
                  Emails we already sent you stay in your own inbox; we cannot recall them.
                </li>
              </ul>
            </div>

            <p className="text-muted text-sm pt-2">
              Read our full{' '}
              <Link href="/privacy" className="text-gold-400 underline">
                Privacy Policy
              </Link>{' '}
              or contact{' '}
              <a href={`mailto:${LEGAL.contactEmail}`} className="text-gold-400 underline">
                {LEGAL.contactEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
