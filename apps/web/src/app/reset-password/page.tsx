'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Navbar } from '@/components/Navbar';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing reset token. Please request a new link.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const client = authClient as any;
      let resetError = null;

      if (typeof client.resetPassword === 'function') {
        const res = await client.resetPassword({
          newPassword: password,
          token,
        });
        resetError = res?.error;
      } else {
        const res = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newPassword: password,
            token,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Failed to reset password');
        }
      }

      if (resetError) throw resetError;

      toast.success('Password successfully reset. You can now sign in.');
      router.push('/login');
    } catch (err: any) {
      setError(err.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4">
      <div className="card p-8">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--color-gold-100)' }}
          >
            <KeyRound className="w-7 h-7 text-gold-500" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Set a new password</h1>
          <p className="text-secondary mt-2 text-sm">
            Choose a strong password for your account.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg text-sm bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="rp-password"
              className="block text-sm font-semibold mb-1.5 text-secondary"
            >
              New password
            </label>
            <input
              id="rp-password"
              className="input"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label
              htmlFor="rp-confirm"
              className="block text-sm font-semibold mb-1.5 text-secondary"
            >
              Confirm password
            </label>
            <input
              id="rp-confirm"
              className="input"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || !token}
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Reset password'}
          </button>
          {!token && (
            <p className="text-center">
              <Link
                href="/forgot-password"
                className="text-sm text-gold-500 hover:text-gold-400"
              >
                Request a new reset link
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-32 pb-16">
        <Suspense
          fallback={
            <div className="flex justify-center items-center py-16">
              <Loader className="w-6 h-6 animate-spin text-gold-500" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
