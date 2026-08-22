'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import PhoneVerify from '@/components/PhoneVerify';

// Phone-first signup. Verifying the number *is* the account creation: the
// better-auth phone-number plugin creates the row and sets the session cookie,
// so there is nothing to submit afterwards. The profile wizard collects the
// email and everything else.
export default function PhoneSignupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/at-tayyibun-logo.png" alt="At-Tayyibun" width={40} height={40} className="rounded-full" priority />
            <span className="font-heading font-bold text-xl text-gradient-gold">At-Tayyibun</span>
          </Link>
        </div>

        <PhoneVerify
          title="Sign up with your phone"
          subtitle="We'll text you a code. Your number keeps one account per person and is never shown on your profile."
          onVerified={() => router.push('/profile/setup')}
          onPhoneTaken={() => router.push('/login?phone=taken')}
        />

        <p className="text-center text-sm mt-6" style={{ color: 'var(--color-text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" className="text-gold-400 hover:text-gold-300">Sign in</Link>
        </p>
        <p className="text-center text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          Prefer email?{' '}
          <Link href="/signup" className="text-gold-400 hover:text-gold-300">Sign up with email</Link>
        </p>
      </div>
    </div>
  );
}
