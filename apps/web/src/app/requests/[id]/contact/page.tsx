'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireSession } from '@/lib/hooks';
import { Navbar } from '@/components/Navbar';

interface SharedContact {
  name?: string;
  phone?: string;
  email?: string;
}

export default function RequestContactPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading: sessionLoading } = useRequireSession();
  const [contact, setContact] = useState<SharedContact | null>(null);
  const [error, setError] = useState('');
  const [revealing, setRevealing] = useState(false);

  // A button, not a page load: email scanners follow links, and a view is
  // single-use.
  const reveal = async () => {
    setRevealing(true);
    setError('');
    try {
      setContact(await api.post(`/requests/${encodeURIComponent(id)}/contact`));
    } catch (err: any) {
      setError(err.message || 'These contact details could not be shown.');
    } finally {
      setRevealing(false);
    }
  };

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Loader className="w-10 h-10 text-gold-500 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Navbar />
      <main id="main-content" className="max-w-xl mx-auto px-4 pt-24">
        <div className="card p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-gold-500 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
            Contact details
          </h1>

          {contact ? (
            <>
              <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Please save these now. They will not be shown again.
              </p>
              <dl className="space-y-3 text-left">
                {contact.name && (
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gold-500 flex-shrink-0" />
                    <dd className="font-medium break-all" style={{ color: 'var(--color-text)' }}>{contact.name}</dd>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gold-500 flex-shrink-0" />
                    <dd className="font-medium break-all" style={{ color: 'var(--color-text)' }}>{contact.phone}</dd>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gold-500 flex-shrink-0" />
                    <dd className="font-medium break-all" style={{ color: 'var(--color-text)' }}>{contact.email}</dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <>
              <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                These details can be viewed once. Have somewhere ready to save them before you
                continue.
              </p>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              {!error && (
                <button type="button" onClick={reveal} disabled={revealing} className="btn-primary disabled:opacity-50">
                  {revealing ? 'Loading...' : 'Show contact details'}
                </button>
              )}
            </>
          )}

          <div className="mt-6">
            <Link href="/requests" className="text-sm text-gold-400 underline">Back to requests</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
