'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  
  const success = searchParams.get('success') === 'true';
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  useEffect(() => {
    if (success && token) {
      // Store token and redirect to browse
      localStorage.setItem('accessToken', token);
      setStatus('success');
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/browse');
      }, 2000);
    } else if (error) {
      setStatus('error');
    } else {
      // No params, show waiting message
      setStatus('loading');
    }
  }, [success, token, error, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <Image
            src="/logo.png"
            alt="At-Tayyibun Logo"
            width={48}
            height={48}
            className="rounded-full"
          />
          <span className="font-heading font-bold text-xl text-gradient-gold">At-Tayyibun</span>
        </Link>

        {status === 'loading' && (
          <div className="card p-8">
            <Loader className="w-16 h-16 text-gold-500 mx-auto mb-4 animate-spin" />
            <h1 className="font-heading text-2xl font-bold mb-2">Verifying Email...</h1>
            <p className="text-gray-400">Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="card p-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold mb-2">Email Verified!</h1>
            <p className="text-gray-400 mb-4">
              Your email has been verified successfully. Redirecting you to browsing...
            </p>
            <Link href="/browse" className="btn-primary inline-block">
              Continue to Browse
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="card p-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold mb-2">Verification Failed</h1>
            <p className="text-gray-400 mb-4">
              {error === 'expired' 
                ? 'The verification link has expired. Please request a new one.'
                : 'Invalid verification link. Please check your email and try again.'}
            </p>
            <Link href="/signup" className="btn-secondary inline-block">
              Back to Sign Up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
