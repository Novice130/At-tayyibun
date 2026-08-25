'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader, Phone, ShieldCheck } from 'lucide-react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { authClient } from '@/lib/auth-client';
import { firebaseAuth, isFirebaseConfigured } from '@/lib/firebase-client';
import { toE164 } from '@/lib/phone';

// Phone entry + SMS code, shared by the two entry points:
//   /signup/phone   — no session yet; verifying creates the account
//   /verify-phone   — session exists; verifying attaches the number to it
//
// Firebase owns the code itself. We hand better-auth the resulting ID token,
// which its phone-number plugin treats as the OTP (see lib/phone-verify.ts).

export interface PhoneVerifyProps {
  /** true on /verify-phone: attach to the signed-in user instead of signing in. */
  attachToSession?: boolean;
  /** Prefilled number, e.g. the unverified one already on a legacy account. */
  initialPhone?: string;
  onVerified: () => void;
  /** Rendered when the number already belongs to a different account. */
  onPhoneTaken?: (phone: string) => void;
  title?: string;
  subtitle?: string;
}

type Stage = 'enter' | 'code';

const RESEND_SECONDS = 60;

export default function PhoneVerify({
  attachToSession = false,
  initialPhone = '',
  onVerified,
  onPhoneTaken,
  title = 'Verify your phone',
  subtitle = 'We use your number to keep one account per person. It is never shown on your profile.',
}: PhoneVerifyProps) {
  const [stage, setStage] = useState<Stage>('enter');
  const [phone, setPhone] = useState(initialPhone);
  const [e164, setE164] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  // The verifier touches `document`, so it can only be built after mount, and
  // it must be torn down on unmount — leaving it behind makes the next attempt
  // fail with "reCAPTCHA has already been rendered in this element".
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const verifier = new RecaptchaVerifier(firebaseAuth(), 'recaptcha-container', {
      size: 'invisible',
    });
    verifierRef.current = verifier;
    return () => {
      verifier.clear();
      verifierRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const sendCode = async (target: string) => {
    const verifier = verifierRef.current;
    if (!verifier) {
      setError('Verification is still loading. Try again in a moment.');
      return false;
    }
    const confirmation = await signInWithPhoneNumber(firebaseAuth(), target, verifier);
    confirmationRef.current = confirmation;
    setResendTimer(RESEND_SECONDS);
    return true;
  };

  const handleSend = async () => {
    setError('');
    if (!isFirebaseConfigured) {
      setError('Phone verification is not configured on this environment.');
      return;
    }
    const normalized = toE164(phone);
    if (!normalized) {
      setError('Enter a valid phone number, including the country code.');
      return;
    }
    setSending(true);
    try {
      if (await sendCode(normalized)) {
        setE164(normalized);
        setStage('code');
      }
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || sending) return;
    setError('');
    setSending(true);
    try {
      await sendCode(e164);
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    const confirmation = confirmationRef.current;
    if (!confirmation) {
      setError('That code has expired. Request a new one.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const credential = await confirmation.confirm(otpCode);
      const idToken = await credential.user.getIdToken();

      const res = await authClient.phoneNumber.verify({
        phoneNumber: e164,
        code: idToken,
        ...(attachToSession ? { updatePhoneNumber: true } : {}),
      });

      // Firebase has done its job; do not leave a second session around.
      await firebaseSignOut(firebaseAuth()).catch(() => {});

      if (res.error) {
        const code = res.error.code || '';
        if (code.includes('PHONE_NUMBER_EXIST')) {
          if (onPhoneTaken) onPhoneTaken(e164);
          else setError('That number is already linked to another account.');
          return;
        }
        setError(res.error.message || 'We could not verify that code.');
        return;
      }
      onVerified();
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-md w-full">
      <div className="card p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-4 rounded-full bg-gold-500/10 text-gold-500 ring-8 ring-gold-500/5 mb-4">
            {stage === 'enter' ? <Phone className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
          </div>
          <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            {title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {stage === 'enter' ? (
              subtitle
            ) : (
              <>
                Enter the 6-digit code sent to
                <span className="block font-medium mt-1" style={{ color: 'var(--color-text)' }}>{e164}</span>
              </>
            )}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {stage === 'enter' ? (
          <>
            <label htmlFor="phone" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              className="input w-full mb-4"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSend();
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !phone.trim()}
              className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
            >
              {sending ? <Loader className="w-5 h-5 animate-spin" /> : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-xl input"
                  value={otpCode[i] || ''}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    if (!pasted) return;
                    e.preventDefault();
                    const filled = (otpCode.slice(0, i) + pasted).slice(0, 6);
                    setOtpCode(filled);
                    const target = e.currentTarget.parentElement?.children[Math.min(filled.length, 5)] as HTMLInputElement | undefined;
                    target?.focus();
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (!val) {
                      const arr = otpCode.split(''); arr[i] = ''; setOtpCode(arr.join(''));
                      return;
                    }
                    if (val.length > 1) {
                      const filled = (otpCode.slice(0, i) + val).slice(0, 6);
                      setOtpCode(filled);
                      const target = e.target.parentElement?.children[Math.min(filled.length, 5)] as HTMLInputElement | undefined;
                      target?.focus();
                      return;
                    }
                    const arr = otpCode.split(''); arr[i] = val; setOtpCode(arr.join(''));
                    if (i < 5) (e.target.nextElementSibling as HTMLInputElement)?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpCode[i] && i > 0) {
                      ((e.target as HTMLInputElement).previousElementSibling as HTMLInputElement)?.focus();
                    }
                  }}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              onClick={handleVerify}
              disabled={verifying || otpCode.length < 6}
              className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
            >
              {verifying ? <Loader className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
            </button>

            <div className="pt-4 mt-4 border-t border-border text-center">
              <button
                onClick={handleResend}
                disabled={resendTimer > 0 || sending}
                className="text-sm font-medium text-gold-500 hover:text-gold-400 disabled:opacity-50"
              >
                {sending ? 'Sending…' : resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
              </button>
              <button
                onClick={() => { setStage('enter'); setOtpCode(''); setError(''); }}
                className="block mx-auto mt-3 text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Use a different number
              </button>
            </div>
          </>
        )}

        {/* Invisible reCAPTCHA mounts here. Must be a stable, empty node. */}
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}

/** Turn Firebase's auth/* codes into something a user can act on. */
function firebaseMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number is not valid. Include the country code.';
    case 'auth/invalid-verification-code':
      return 'That code is not right. Check it and try again.';
    case 'auth/code-expired':
      return 'That code has expired. Request a new one.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/quota-exceeded':
      return 'We cannot send codes right now. Please try again later.';
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return 'Verification could not start. Reload the page and try again.';
    default:
      return (err as { message?: string })?.message || 'Something went wrong. Please try again.';
  }
}
