'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader } from 'lucide-react';
import PhoneVerify from '@/components/PhoneVerify';
import { authClient, useSession } from '@/lib/auth-client';

// The gate. Anyone who signed in with email or Google but has no verified phone
// lands here and cannot get past it. Accounts created before phone verification
// existed are exempt (users.phone_gate_exempt) and never reach this page.
export default function VerifyPhonePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [takenNumber, setTakenNumber] = useState<string | null>(null);

  const user = session?.user as
    | { phoneNumber?: string | null; phoneNumberVerified?: boolean }
    | undefined;

  // Prefill order: a number already on the account (a legacy row, or one the
  // user is re-verifying), then the one typed during email signup, which is
  // stashed in the profile seed rather than written to users.phone.
  const initialPhone = user?.phoneNumber || readSeededPhone();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-gold-500" />
      </div>
    );
  }

  if (!session) {
    router.replace('/login?next=/verify-phone');
    return null;
  }

  if (takenNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-md w-full card p-8 text-center">
          <h1 className="font-heading text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
            That number is already in use
          </h1>
          <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            {takenNumber} is already linked to another At-Tayyibun account. A phone
            number can only belong to one account. Sign in to that account instead,
            or verify a different number.
          </p>
          <button
            className="btn-primary w-full py-3 mb-3"
            onClick={async () => {
              await authClient.signOut();
              router.push('/signup/phone');
            }}
          >
            Sign in with that number
          </button>
          <button
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => setTakenNumber(null)}
          >
            Use a different number
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/at-tayyibun-logo.png" alt="At-Tayyibun" width={40} height={40} className="rounded-full mx-auto" priority />
        </div>

        <PhoneVerify
          attachToSession
          initialPhone={initialPhone}
          title="Verify your phone to continue"
          subtitle="One account per phone number keeps At-Tayyibun free of duplicate profiles. Your number is never shown on your profile."
          onVerified={() => router.replace('/profile/setup')}
          onPhoneTaken={(phone) => setTakenNumber(phone)}
        />

        <div className="text-center mt-6">
          <button
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={async () => {
              await authClient.signOut();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/** The phone typed during email signup, left behind by SignupForm. */
function readSeededPhone(): string {
  try {
    const raw = localStorage.getItem('pending-profile-seed');
    if (!raw) return '';
    return (JSON.parse(raw) as { phone?: string }).phone || '';
  } catch {
    return '';
  }
}
