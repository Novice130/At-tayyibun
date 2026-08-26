'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Smartphone, Key, Loader2, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { twoFactor, useSession } from '@/lib/auth-client';
import { toast } from 'sonner';

type FactorType = 'email' | 'totp' | 'backup';
type EmailOtpState = 'notSent' | 'sending' | 'sent' | 'sendFailed';

export default function MFAChallengePage() {
  const router = useRouter();
  const { data: session, refetch } = useSession();
  const [factor, setFactor] = useState<FactorType>('email');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [timer, setTimer] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  // Timer countdown for resend cooldown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // Factor switching
  const handleSelectFactor = (newFactor: FactorType) => {
    if (newFactor === factor) return;
    setFactor(newFactor);
    setCode('');
    setErrorMessage(null);
    verifyingRef.current = false;
  };

  // Explicit email code send
  const handleSendEmailOtp = useCallback(async () => {
    if (timer > 0 || sendingOtp) return;
    setSendingOtp(true);
    setErrorMessage(null);
    try {
      const { error } = await twoFactor.sendOtp();
      if (error) {
        throw error;
      }
      setOtpSent(true);
      setTimer(60);
      toast.info('Verification code sent to your email');
    } catch (err: any) {
      const msg = err.message || 'Failed to send verification code. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSendingOtp(false);
    }
  }, [timer, sendingOtp]);

  const mapVerificationError = (err: any, currentFactor: FactorType): string => {
    const message = err?.message || err?.error || '';
    const status = err?.status || err?.statusCode;

    if (status === 429 || message.toLowerCase().includes('too many') || message.toLowerCase().includes('locked')) {
      return 'Too many attempts. Your account is temporarily locked or rate limited. Please try again later.';
    }
    if (message.toLowerCase().includes('expired')) {
      return currentFactor === 'email'
        ? 'Verification code has expired. Please request a new code.'
        : 'The verification code is invalid or has expired.';
    }
    if (message.toLowerCase().includes('session') || message.toLowerCase().includes('unauthorized')) {
      return 'Your challenge session has expired. Please sign in again.';
    }
    if (currentFactor === 'email') {
      return 'Invalid email verification code. If you requested a new code, please ensure you use the latest one.';
    }
    if (currentFactor === 'totp') {
      return 'Invalid authenticator code. Please check that your device time is synchronized.';
    }
    if (currentFactor === 'backup') {
      return 'Invalid backup code. Note that each backup code can only be used once.';
    }
    return message || 'Verification failed. Please check the code and try again.';
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) return;
    if ((factor === 'email' || factor === 'totp') && cleanCode.length < 6) return;

    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      let resultError: any = null;

      if (factor === 'email') {
        const res = await twoFactor.verifyOtp({ code: cleanCode, trustDevice: true });
        resultError = res.error;
      } else if (factor === 'totp') {
        const res = await twoFactor.verifyTotp({ code: cleanCode, trustDevice: true });
        resultError = res.error;
      } else if (factor === 'backup') {
        const res = await twoFactor.verifyBackupCode({ code: cleanCode });
        resultError = res.error;
      }

      if (resultError) {
        throw resultError;
      }

      toast.success('Identity verified');
      await refetch();
      router.replace('/admin');
    } catch (err: any) {
      const friendlyMsg = mapVerificationError(err, factor);
      setErrorMessage(friendlyMsg);
      toast.error(friendlyMsg);
      verifyingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const email = session?.user?.email || 'your email';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-theme">
      <div className="max-w-md w-full animate-fade-in">
        <div className="card p-8 shadow-gold">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 rounded-full bg-gold-500/10 text-gold-500 ring-8 ring-gold-500/5">
              <ShieldCheck className="w-10 h-10" />
            </div>

            <div>
              <h1 className="text-2xl font-heading font-bold mb-2">Two-Factor Authentication</h1>
              <p className="text-secondary text-sm">
                Choose a verification method to complete admin sign-in
              </p>
            </div>

            {/* Factor Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 w-full p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-theme">
              <button
                type="button"
                onClick={() => handleSelectFactor('email')}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  factor === 'email'
                    ? 'bg-[var(--color-bg)] text-primary shadow-sm border border-[var(--color-border)]'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Mail className="w-4 h-4 mb-1" />
                Email
              </button>
              <button
                type="button"
                onClick={() => handleSelectFactor('totp')}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  factor === 'totp'
                    ? 'bg-[var(--color-bg)] text-primary shadow-sm border border-[var(--color-border)]'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Smartphone className="w-4 h-4 mb-1" />
                Authenticator
              </button>
              <button
                type="button"
                onClick={() => handleSelectFactor('backup')}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  factor === 'backup'
                    ? 'bg-[var(--color-bg)] text-primary shadow-sm border border-[var(--color-border)]'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Key className="w-4 h-4 mb-1" />
                Backup Code
              </button>
            </div>

            {errorMessage && (
              <div className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email Factor Form */}
            {factor === 'email' && (
              <div className="w-full space-y-5">
                {!otpSent ? (
                  <div className="space-y-4 py-2">
                    <p className="text-sm text-secondary">
                      Click below to send a 6-digit verification code to <span className="font-medium text-primary">{email}</span>.
                    </p>
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={sendingOtp}
                      className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
                    >
                      {sendingOtp ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sending Code...
                        </>
                      ) : (
                        <>
                          <Mail className="w-5 h-5" />
                          Send Email Code
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerify} className="w-full space-y-6">
                    <div>
                      <p className="text-xs text-secondary mb-3">
                        Enter the 6-digit code sent to <span className="font-medium text-primary">{email}</span>. (Valid for 5 minutes)
                      </p>
                      <div className="flex justify-center gap-1.5 sm:gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <input
                            key={i}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            className="w-11 sm:w-12 h-14 text-center text-xl sm:text-2xl font-bold rounded-xl p-0 m-0 leading-none bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 focus:scale-105 transition-all"
                            value={code[i] || ''}
                            onPaste={(e) => {
                              const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                              if (!pasted) return;
                              e.preventDefault();
                              const filled = (code.slice(0, i) + pasted).slice(0, 6);
                              setCode(filled);
                              const target = e.currentTarget.parentElement?.children[Math.min(filled.length, 5)] as HTMLInputElement | undefined;
                              target?.focus();
                            }}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              if (!val) {
                                const newCode = code.split('');
                                newCode[i] = '';
                                setCode(newCode.join(''));
                                return;
                              }
                              if (val.length > 1) {
                                const filled = (code.slice(0, i) + val).slice(0, 6);
                                setCode(filled);
                                const target = e.target.parentElement?.children[Math.min(filled.length, 5)] as HTMLInputElement | undefined;
                                target?.focus();
                                return;
                              }
                              const newCode = code.split('');
                              newCode[i] = val;
                              setCode(newCode.join(''));
                              if (i < 5) {
                                const next = e.target.nextElementSibling as HTMLInputElement;
                                next?.focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !code[i] && i > 0) {
                                const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement;
                                prev?.focus();
                              }
                            }}
                            autoFocus={i === 0}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || code.length < 6}
                      className="btn-primary w-full py-4 text-lg"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Verify Account'}
                    </button>

                    <div className="pt-2 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        disabled={timer > 0 || sendingOtp}
                        className="text-xs font-medium text-gold-500 hover:text-gold-400 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {sendingOtp ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {timer > 0 ? `Resend code in ${timer}s` : 'Request a new code'}
                      </button>
                      <p className="text-[11px] text-muted-foreground">
                        Requesting a new code replaces the prior code.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TOTP Factor Form */}
            {factor === 'totp' && (
              <form onSubmit={handleVerify} className="w-full space-y-6">
                <div>
                  <p className="text-xs text-secondary mb-3">
                    Enter the 6-digit code from your authenticator app
                  </p>
                  <div className="flex justify-center gap-1.5 sm:gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="w-11 sm:w-12 h-14 text-center text-xl sm:text-2xl font-bold rounded-xl p-0 m-0 leading-none bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 focus:scale-105 transition-all"
                        value={code[i] || ''}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          if (!pasted) return;
                          e.preventDefault();
                          const filled = (code.slice(0, i) + pasted).slice(0, 6);
                          setCode(filled);
                          const target = e.currentTarget.parentElement?.children[Math.min(filled.length, 5)] as HTMLInputElement | undefined;
                          target?.focus();
                        }}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (!val) {
                            const newCode = code.split('');
                            newCode[i] = '';
                            setCode(newCode.join(''));
                            return;
                          }
                          if (val.length > 1) {
                            const filled = (code.slice(0, i) + val).slice(0, 6);
                            setCode(filled);
                            const target = e.target.parentElement?.children[Math.min(filled.length, 5)] as HTMLInputElement | undefined;
                            target?.focus();
                            return;
                          }
                          const newCode = code.split('');
                          newCode[i] = val;
                          setCode(newCode.join(''));
                          if (i < 5) {
                            const next = e.target.nextElementSibling as HTMLInputElement;
                            next?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !code[i] && i > 0) {
                            const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement;
                            prev?.focus();
                          }
                        }}
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="btn-primary w-full py-4 text-lg"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Verify Authenticator'}
                </button>
              </form>
            )}

            {/* Backup Code Form */}
            {factor === 'backup' && (
              <form onSubmit={handleVerify} className="w-full space-y-6">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-medium text-secondary">Backup Code</label>
                  <input
                    type="text"
                    placeholder="Enter backup code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus
                    className="w-full h-12 px-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] font-mono text-center text-lg focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 transition-all"
                  />
                  <p className="text-[11px] text-secondary">
                    Each backup code can be used once. Enter a single code exactly as saved during setup.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="btn-primary w-full py-4 text-lg"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Verify Backup Code'}
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-theme w-full flex justify-center">
              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="text-xs text-secondary hover:text-primary flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
