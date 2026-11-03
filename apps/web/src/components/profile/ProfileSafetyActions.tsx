'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Flag, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { REPORT_DETAILS_MAX, REPORT_REASONS, ReportReasonCode, reportPayload } from '@/lib/moderation';

type Step = 'block' | 'report' | 'reported' | null;

/** Report and block a member, in the same order and wording as the mobile app. */
export function ProfileSafetyActions({ publicId, displayName }: { publicId: string; displayName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [details, setDetails] = useState('');

  const handleBlock = async () => {
    setBusy(true);
    try {
      await api.post('/blocks', { targetPublicId: publicId });
      toast.success(`${displayName} has been blocked.`);
      // The blocked person must visibly disappear, so leave their page.
      router.push('/browse');
    } catch (err: any) {
      toast.error(err?.message || 'Could not block this member. Please try again.');
      setBusy(false);
    }
  };

  const handleReport = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api.post('/reports', reportPayload(publicId, reason, details));
      setDetails('');
      setReason(null);
      setStep('reported');
    } catch (err: any) {
      toast.error(err?.message || 'Could not send your report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) setStep(null);
  };

  return (
    <>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => setStep('report')}
          className="py-2.5 px-5 rounded-lg text-sm font-medium transition inline-flex items-center gap-2 hover:text-gold-500"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Flag className="w-4 h-4" /> Report
        </button>
        <button
          type="button"
          onClick={() => setStep('block')}
          className="py-2.5 px-5 rounded-lg text-sm font-medium transition inline-flex items-center gap-2 text-red-400 hover:bg-red-600/10"
        >
          <Ban className="w-4 h-4" /> Block
        </button>
      </div>

      {step && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="safety-dialog-title"
            className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {step === 'block' && (
              <>
                <h2 id="safety-dialog-title" className="font-heading text-xl font-bold mb-3">Block this person?</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                  {displayName} will disappear from your browse and neither of you will see the other again. Any
                  pending request between you is cancelled.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} disabled={busy} className="btn-secondary">Cancel</button>
                  <button
                    type="button"
                    onClick={handleBlock}
                    disabled={busy}
                    className="py-2.5 px-5 rounded-lg text-sm font-medium inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {busy && <Loader className="w-4 h-4 animate-spin" />} Block
                  </button>
                </div>
              </>
            )}

            {step === 'report' && (
              <>
                <h2 id="safety-dialog-title" className="font-heading text-xl font-bold mb-4">Report {displayName}</h2>
                <fieldset className="space-y-2 mb-4">
                  <legend className="sr-only">Reason</legend>
                  {REPORT_REASONS.map((r) => (
                    <label key={r.code} className="flex items-center gap-3 text-sm cursor-pointer min-h-8">
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.code}
                        checked={reason === r.code}
                        onChange={() => setReason(r.code)}
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <label htmlFor="report-details" className="block text-sm font-semibold mb-1.5 text-secondary">
                  Details (optional)
                </label>
                <textarea
                  id="report-details"
                  className="input mb-1"
                  rows={3}
                  maxLength={REPORT_DETAILS_MAX}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
                <p className="text-xs text-right mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  {details.length}/{REPORT_DETAILS_MAX}
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} disabled={busy} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={handleReport} disabled={busy || !reason} className="btn-primary">
                    {busy ? <Loader className="w-4 h-4 animate-spin" /> : 'Submit Report'}
                  </button>
                </div>
              </>
            )}

            {step === 'reported' && (
              <>
                <h2 id="safety-dialog-title" className="font-heading text-xl font-bold mb-3">Report submitted</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                  Thank you. Our team reviews reports within 24 hours. Would you also like to block this person?
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className="btn-secondary">No thanks</button>
                  <button type="button" onClick={() => setStep('block')} className="btn-primary">Also block</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
