'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { LEGAL } from '@/lib/legal';

export default function SuspendedPage() {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // A suspended member cannot reach the profile page, where this normally lives.
  const deleteAccount = async () => {
    if (confirm !== 'DELETE' || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete('/users/me');
      await fetch('/auth/sign-out', { method: 'POST' }).catch(() => {});
      router.push('/login');
      router.refresh();
    } catch {
      setError('Failed to delete account. Please sign in again and retry, or email us.');
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="max-w-xl mx-auto px-4 space-y-6">
          <div className="card p-8 text-center">
            <ShieldAlert className="w-10 h-10 text-gold-500 mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold mb-3">Your account is suspended</h1>
            <p className="text-secondary mb-2">
              You cannot use At-Tayyibun while suspended, and your profile is hidden from other
              members.
            </p>
            <p className="text-secondary">
              To ask about this, email{' '}
              <a href={`mailto:${LEGAL.contactEmail}`} className="text-gold-400 underline">
                {LEGAL.contactEmail}
              </a>
              . See our <Link href="/terms" className="text-gold-400 underline">Terms of Use</Link>.
            </p>
          </div>

          <div className="card p-8">
            <h2 className="font-heading text-lg font-semibold mb-2">Delete your account</h2>
            <p className="text-secondary text-sm mb-4">
              This is permanent. Type DELETE to confirm.
            </p>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input w-full mb-3"
              aria-label="Type DELETE to confirm"
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              type="button"
              onClick={deleteAccount}
              disabled={confirm !== 'DELETE' || deleting}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete my account'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
