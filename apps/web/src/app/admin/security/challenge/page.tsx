'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Loader2, RefreshCw } from 'lucide-react';
import { twoFactor, useSession } from '@/lib/auth-client';
import { toast } from 'sonner';

export default function MFAChallengePage() {
  const router = useRouter();
  const { data: session, refetch } = useSession();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(0);
  const otpSentRef = useRef(false);

  const handleResend = useCallback(async () => {
    if (timer > 0 || resending) return;
    setResending(true);
    try {
      const { error } = await twoFactor.sendOtp();
      if (error) throw error;
      toast.info('Verification code sent to your email');
      setTimer(60);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send code. Please try again later.');
    } finally {
      setResending(false);
    }
  }, [timer, resending]);

  // Send OTP once on mount. During the partial 2FA flow `/auth/get-session`
  // returns null, so don't gate on session — the verify endpoint reads the
  // partial cookie better-auth set during sign-in.
  useEffect(() => {
    if (otpSentRef.current) return;
    otpSentRef.current = true;
    handleResend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;

    setLoading(true);
    try {
      const { data, error } = await twoFactor.verifyOtp({ code });
      if (error) throw error;

      toast.success('Identity verified');
      await refetch();
      router.replace('/admin');
    } catch (err: any) {
      toast.error(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-theme">
      <div className="max-w-md w-full animate-fade-in">
        <div className="card p-8 shadow-gold">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 rounded-full bg-gold-500/10 text-gold-500 ring-8 ring-gold-500/5">
              <ShieldCheck className="w-10 h-10" />
            </div>
            
            <div>
              <h1 className="text-2xl font-heading font-bold mb-2">Security Verification</h1>
              <p className="text-secondary text-sm">
                Enter the 6-digit verification code sent to
                <span className="block font-medium text-primary">{session?.user?.email}</span>
              </p>
            </div>

            <form onSubmit={handleVerify} className="w-full space-y-6">
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    className="w-12 h-14 text-center text-2xl font-bold rounded-xl input focus:scale-105 transition-transform"
                    value={code[i] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!/^\d*$/.test(val)) return;
                      const newCode = code.split('');
                      newCode[i] = val.slice(-1);
                      const finalCode = newCode.join('');
                      setCode(finalCode);
                      
                      // Auto focus next or submit
                      if (val && i < 5) {
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

              <button 
                type="submit" 
                disabled={loading || code.length < 6}
                className="btn-primary w-full py-4 text-lg"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Verify Account'}
              </button>
            </form>

            <div className="pt-4 border-t border-theme w-full flex flex-col items-center gap-3">
              <button 
                onClick={handleResend}
                disabled={timer > 0 || resending}
                className="text-sm font-medium text-gold-500 hover:text-gold-400 disabled:opacity-50 flex items-center gap-2"
              >
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {timer > 0 ? `Resend code in ${timer}s` : 'Resend verification code'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
