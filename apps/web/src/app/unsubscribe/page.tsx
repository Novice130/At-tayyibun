'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader, MailX } from 'lucide-react';
import { api } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

function UnsubscribeContent() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [error, setError] = useState('');

  // A button, not on page load: mail scanners open links, and must not opt anyone out.
  const handleConfirm = async () => {
    setState('working');
    try {
      await api.post('/unsubscribe', { token });
      setState('done');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setState('failed');
    }
  };

  if (!token) {
    return (
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Please use the unsubscribe link at the bottom of the email you received. If that does not work,{' '}
        <Link href="/contact" className="text-gold-500 hover:text-gold-400">contact us</Link>.
      </p>
    );
  }
  if (state === 'done') {
    return (
      <p style={{ color: 'var(--color-text-secondary)' }}>
        You are unsubscribed from At-Tayyibun campaign emails. You will still get messages about your account, such as
        password resets and contact requests.
      </p>
    );
  }
  return (
    <>
      <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
        Stop receiving At-Tayyibun campaign emails? You will still get messages about your account.
      </p>
      {state === 'failed' && (
        <div className="p-3 mb-4 rounded-lg text-sm bg-red-500/10 border border-red-500/20 text-red-500">{error}</div>
      )}
      <button type="button" onClick={handleConfirm} disabled={state === 'working'} className="btn-primary w-full">
        {state === 'working' ? <Loader className="w-5 h-5 animate-spin" /> : 'Unsubscribe'}
      </button>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-32 pb-16">
        <div className="max-w-md mx-auto px-4">
          <div className="card p-8 text-center">
            <MailX className="w-10 h-10 text-gold-500 mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold mb-4">Email preferences</h1>
            <Suspense fallback={<Loader className="w-6 h-6 text-gold-500 animate-spin mx-auto" />}>
              <UnsubscribeContent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
