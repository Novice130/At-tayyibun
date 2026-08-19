'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Loader, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Navbar } from '@/components/Navbar';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      // Deliberately generic success message: never reveal whether an email
      // is registered.
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/login`,
      });
      setSent(true);
    } catch (err: any) {
      // Still show the generic message on failure — error details would leak
      // account existence. Log nothing sensitive to the user.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-32 pb-16">
        <div className="max-w-md mx-auto px-4">
          <div className="card p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-gold-100)' }}>
                <KeyRound className="w-7 h-7 text-gold-500" />
              </div>
              <h1 className="font-heading text-2xl font-bold">Forgot password</h1>
              <p className="text-secondary mt-2 text-sm">
                Enter your email and we will send you a reset link.
              </p>
            </div>

            {sent ? (
              <div className="text-center space-y-4">
                <MailCheck className="w-10 h-10 text-gold-500 mx-auto" />
                <p className="text-secondary">
                  If an account exists for that email, a reset link is on its way.
                  It expires in 1 hour.
                </p>
                <Link href="/login" className="btn-secondary inline-flex mt-4">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="fp-email" className="block text-sm font-semibold mb-1.5 text-secondary">
                    Email address
                  </label>
                  <input
                    id="fp-email"
                    className="input"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Send reset link'}
                </button>
                <p className="text-center">
                  <Link href="/login" className="text-sm text-gold-500 hover:text-gold-400">
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
