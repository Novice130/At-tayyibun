'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Mail,
  Smartphone,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Copy,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { twoFactor, useSession } from '@/lib/auth-client';
import { toast } from 'sonner';

type Step = 'selection' | 'email-verify' | 'backup-codes';

export default function MFASetupPage() {
  const router = useRouter();
  const { data: session, isPending, refetch } = useSession();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('selection');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [resendTimer, setResendTimer] = useState(0);

  const user = session?.user as any;
  const isEnabled = user?.twoFactorEnabled;

  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'ENABLE' | 'DISABLE' | null>(null);

  const handleEnableEmail = () => {
    setPendingAction('ENABLE');
    setShowPasswordModal(true);
  };

  const handleDisable = () => {
    setPendingAction('DISABLE');
    setShowPasswordModal(true);
  };

  const startResendCooldown = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const confirmPasswordAction = async () => {
    if (!password) {
      toast.error('Password is required');
      return;
    }

    setLoading(true);
    try {
      if (pendingAction === 'ENABLE') {
        const { data, error } = await twoFactor.enable({ password });
        if (error) throw error;

        const codes = (data as any)?.backupCodes ?? [];
        setBackupCodes(codes);

        const sendRes = await twoFactor.sendOtp();
        if (sendRes.error) throw sendRes.error;

        toast.info('Verification code sent to your email');
        startResendCooldown();
        setShowPasswordModal(false);
        setPassword('');
        setPendingAction(null);
        setStep('email-verify');
      } else if (pendingAction === 'DISABLE') {
        const { error } = await twoFactor.disable({ password });
        if (error) throw error;
        toast.success('MFA disabled');
        setShowPasswordModal(false);
        setPassword('');
        setPendingAction(null);
        await refetch();
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to ${pendingAction?.toLowerCase()} MFA`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length < 6) return;

    setLoading(true);
    try {
      const { error } = await twoFactor.verifyOtp({ code });
      if (error) throw error;

      toast.success('MFA enabled with Email OTP');
      await refetch();
      setStep(backupCodes.length > 0 ? 'backup-codes' : 'selection');
      setCode('');
    } catch (err: any) {
      toast.error(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    try {
      const { error } = await twoFactor.sendOtp();
      if (error) throw error;
      toast.info('New code sent to your email');
      startResendCooldown();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      toast.success('Backup codes copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const finishBackupCodes = () => {
    setBackupCodes([]);
    setStep('selection');
  };

  if (isPending) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-10 animate-fade-in">
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => (step === 'selection' ? router.back() : setStep('selection'))}
          className="p-2 rounded-full hover:bg-surface-hover transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-heading font-bold text-gradient-gold">Security Settings</h1>
          <p className="text-secondary">
            Protect your administrative account with Multi-Factor Authentication
          </p>
        </div>
      </div>

      {step === 'selection' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div
              className="card p-6 border-l-4"
              style={{ borderLeftColor: isEnabled ? '#10b981' : 'var(--color-text-muted)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div
                    className={`p-3 rounded-xl ${isEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-surface-hover text-muted'}`}
                  >
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">MFA Status: {isEnabled ? 'Enabled' : 'Disabled'}</h3>
                    <p className="text-secondary mt-1">
                      {isEnabled
                        ? 'Your account is protected with an extra layer of security.'
                        : 'Add an extra layer of protection to your account by enabling MFA.'}
                    </p>
                  </div>
                </div>
                {isEnabled && (
                  <button
                    onClick={handleDisable}
                    disabled={loading}
                    className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    Disable MFA
                  </button>
                )}
              </div>
            </div>

            {!isEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card-hover p-6 flex flex-col items-center text-center group">
                  <div className="p-4 rounded-full bg-gold-500/10 text-gold-500 mb-4 group-hover:scale-110 transition-transform">
                    <Mail className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-lg mb-2">Email OTP</h4>
                  <p className="text-sm text-secondary mb-6 flex-1">
                    Receive a unique 6-digit code via your registered email every time you sign in.
                  </p>
                  <button onClick={handleEnableEmail} disabled={loading} className="btn-primary w-full">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Setup Email MFA'}
                  </button>
                </div>

                <div className="card p-6 flex flex-col items-center text-center opacity-60">
                  <div className="p-4 rounded-full bg-surface-hover text-muted mb-4">
                    <Smartphone className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-lg mb-2">Authenticator App</h4>
                  <p className="text-sm text-secondary mb-6 flex-1">
                    Use apps like Google Authenticator or Authy to generate secure verification codes.
                  </p>
                  <button disabled className="btn-secondary w-full cursor-not-allowed">
                    Coming Soon
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card p-6 bg-gold-500/5 border-gold-500/20">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-500" />
                Why enable MFA?
              </h4>
              <ul className="text-sm space-y-3 text-secondary">
                <li className="flex gap-2">
                  <span className="text-gold-500">•</span>
                  <span>Prevents unauthorized access even if your password is compromised.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold-500">•</span>
                  <span>Required for access to highly sensitive admin tools.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold-500">•</span>
                  <span>Industry standard for enterprise-grade security.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {step === 'email-verify' && (
        <div className="max-w-md mx-auto">
          <div className="card p-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="p-4 rounded-full bg-gold-500/10 text-gold-500 ring-8 ring-gold-500/5">
                <Mail className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-2xl font-heading font-bold mb-2">Verify your email</h2>
                <p className="text-secondary text-sm">
                  Enter the 6-digit code sent to
                  <span className="block font-medium text-primary">{session?.user?.email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="w-full space-y-6">
                <div className="flex justify-center gap-1.5 sm:gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className="w-11 sm:w-12 h-14 text-center text-xl sm:text-2xl font-bold rounded-xl p-0 m-0 leading-none bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 focus:scale-105 transition-all"
                      value={code[i] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!/^\d*$/.test(val)) return;
                        const chars = code.split('');
                        chars[i] = val.slice(-1);
                        setCode(chars.join(''));
                        if (val && i < 5) {
                          (e.target.nextElementSibling as HTMLInputElement | null)?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !code[i] && i > 0) {
                          (
                            (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement | null
                          )?.focus();
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
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Verify & Enable MFA'}
                </button>
              </form>

              <button
                onClick={handleResendOtp}
                disabled={resendTimer > 0 || loading}
                className="text-sm font-medium text-gold-500 hover:text-gold-400 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend verification code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'backup-codes' && (
        <div className="max-w-xl mx-auto">
          <div className="card p-8 space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-amber-300 mb-1">Save these backup codes now</p>
                <p className="text-secondary">
                  Each code can be used once to sign in if you lose access to your email. You will not be able to
                  see them again.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((c) => (
                <div key={c} className="p-3 rounded-lg bg-surface-hover text-center tracking-wider">
                  {c}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={copyBackupCodes} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <Copy className="w-4 h-4" />
                Copy all
              </button>
              <button onClick={finishBackupCodes} className="btn-primary flex-1">
                I have saved my codes
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="card w-full max-w-md p-6 sm:p-8 animate-in zoom-in-95 duration-200 shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="p-3 rounded-full bg-gold-500/10 text-gold-500 mb-4">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold font-heading">
                {pendingAction === 'ENABLE' ? 'Enable MFA' : 'Disable MFA'}
              </h3>
              <p className="text-secondary mt-2">
                Please enter your password to confirm{' '}
                {pendingAction === 'ENABLE' ? 'enabling' : 'disabling'} multi-factor authentication.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-secondary">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-gold-500 transition-colors placeholder:text-muted"
                  onKeyDown={(e) => e.key === 'Enter' && confirmPasswordAction()}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPassword('');
                    setPendingAction(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPasswordAction}
                  disabled={loading || !password}
                  className="btn-primary flex-1 flex justify-center items-center"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
