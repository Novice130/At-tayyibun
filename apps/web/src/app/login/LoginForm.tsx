'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
// Sentry temporarily disabled.
// import * as Sentry from '@sentry/nextjs';
import { authClient, signIn } from '@/lib/auth-client';

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const submittingRef = useRef(false);

  const handleGoogleSignIn = async () => {
    if (googleLoading || isLoading) return;
    setGoogleLoading(true);
    setError('');
    try {
      // Full-page redirect to Google and back to /auth/callback/google.
      // On success better-auth redirects to callbackURL itself, so there is
      // nothing to await here — the page navigates away.
      await signIn.social({ provider: 'google', callbackURL: '/browse' });
    } catch (err: any) {
      setError(err?.message || 'Could not start Google sign-in. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError('');

    try {
      const { data, error: authError } = await signIn.email({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        // Better-auth returns code "EMAIL_NOT_VERIFIED" when
        // requireEmailVerification gates sign-in. Surface a friendlier
        // message; the verification email was already re-sent by the
        // server side of the sign-in attempt (better-auth default).
        const code = (authError as any).code;
        if (code === 'EMAIL_NOT_VERIFIED') {
          throw new Error(
            'Please verify your email before signing in. We just sent a new verification link to your inbox.',
          );
        }
        throw new Error(authError.message);
      }

      // With 2FA enabled there is no user on the response — the two-factor
      // plugin performs its own full-page navigation to the challenge screen.
      // Returning here avoids racing that navigation with a router.push.
      if ((data as any)?.twoFactorRedirect) {
        return;
      }

      // better-auth resolves this promise before its session store catches up
      // (the client flips its session signal on a 10ms timer, then refetches).
      // Pushing immediately lands on a page whose useSession() still reads the
      // stale null, which bounced the user back to /login — the "works on the
      // second attempt" bug. Await the session so the store is warm first.
      await authClient.getSession();

      const role = (data as any)?.user?.role;
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        router.push('/admin');
        return;
      }
      router.push('/browse');
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in. Please try again.';
      setError(msg);
      submittingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <Image
                src="/at-tayyibun-logo.png"
                alt="At-Tayyibun Logo"
                width={44}
                height={44}
                className="rounded-full"
                priority
              />
              <span className="font-heading font-bold text-xl text-gradient-gold">At-Tayyibun</span>
            </Link>
            <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Welcome Back</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Sign in to continue your search</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  required
                  className="input pl-10"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Password</label>
                <Link href="/forgot-password" className="text-sm text-gold-400 hover:text-gold-300">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input pl-10 pr-10"
                  placeholder="Your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* OAuth */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid var(--color-border)' }}></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>Or continue with</span>
              </div>
            </div>

            <div className="mt-4">
              {/* Facebook was removed rather than left in place: it had no
                  handler, no configured provider, and clicking it did nothing. */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || googleLoading}
                className="btn-secondary py-3 text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {googleLoading ? 'Redirecting…' : 'Continue with Google'}
              </button>
            </div>
          </div>

          <p className="text-center text-sm mt-8" style={{ color: 'var(--color-text-secondary)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-gold-400 hover:text-gold-300">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
