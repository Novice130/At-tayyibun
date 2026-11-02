'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Users, Inbox, Send, CheckCircle, XCircle, Clock,
  Loader, MapPin, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireSession, notifyRequestsChanged } from '@/lib/hooks';
import { Navbar } from '@/components/Navbar';
import { formatMaritalLine } from '@/lib/marital';

interface RequestProfile {
  publicId: string;
  profile: {
    firstName: string;
    gender: string;
    ethnicity: string;
    city?: string;
    state?: string;
    maritalStatus?: string | null;
    hasChildren?: boolean | null;
    childrenCount?: number | null;
  } | null;
}

interface InfoRequest {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
  contactState?: 'AVAILABLE' | 'VIEWED' | 'EXPIRED' | 'EMAILED' | null;
  requester?: RequestProfile;
  target?: RequestProfile;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
    PENDING: { icon: <Clock className="w-3.5 h-3.5" />, text: 'Pending', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    APPROVED: { icon: <CheckCircle className="w-3.5 h-3.5" />, text: 'Approved', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
    DENIED: { icon: <XCircle className="w-3.5 h-3.5" />, text: 'Declined', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    EXPIRED: { icon: <Clock className="w-3.5 h-3.5" />, text: 'Expired', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  };
  const c = config[status] || config.EXPIRED;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.className}`}>
      {c.icon} {c.text}
    </span>
  );
}

/** Mirrors the API: the signup form pre-fills the phone with a bare country code. */
function hasGuardianContact(biodata?: Record<string, unknown> | null) {
  const phone = typeof biodata?.guardianPhone === 'string' ? biodata.guardianPhone : '';
  const email = typeof biodata?.guardianEmail === 'string' ? biodata.guardianEmail.trim() : '';
  return phone.replace(/\D/g, '').length >= 7 || !!email;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RequestsPage() {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incoming, setIncoming] = useState<InfoRequest[]>([]);
  const [outgoing, setOutgoing] = useState<InfoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [guardianSaved, setGuardianSaved] = useState(false);

  const { session, loading: sessionLoading } = useRequireSession();

  useEffect(() => {
    if (session) {
      fetchRequests();
      api
        .get('/profiles/me')
        .then((me: any) => setGuardianSaved(hasGuardianContact(me?.profile?.biodata ?? me?.biodata)))
        .catch(() => setGuardianSaved(false));
    }
  }, [session]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [inData, outData] = await Promise.all([
        api.get('/requests/incoming'),
        api.get('/requests/outgoing'),
      ]);
      setIncoming(Array.isArray(inData) ? inData : []);
      setOutgoing(Array.isArray(outData) ? outData : []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (publicId: string, requestId: string) => {
    setResponding(requestId);
    try {
      await api.post('/requests', { targetPublicId: publicId });
      await fetchRequests();
      notifyRequestsChanged();
      toast.success('Request sent again.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send request');
    } finally {
      setResponding(null);
    }
  };

  const handleRespond = async (requestId: string, approved: boolean, shareSource?: 'GUARDIAN' | 'SELF') => {
    setResponding(requestId);
    try {
      await api.put(`/requests/${requestId}/respond`, {
        approved,
        shareItems: approved ? ['phone', 'email'] : undefined,
        shareSource: approved ? shareSource : undefined,
      });
      setAcceptingId(null);
      await fetchRequests();
      // The navbar badge counts pending incoming requests and otherwise only
      // refetches on navigation, so it kept showing the old number on the one
      // page where the number changes.
      notifyRequestsChanged();
      toast.success(
        approved
          ? 'Request accepted. They can now view the contact you chose, once.'
          : 'Request declined.',
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to respond');
    } finally {
      setResponding(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setResponding(requestId);
    try {
      await api.delete(`/requests/${requestId}`);
      setConfirmCancelId(null);
      await fetchRequests();
      notifyRequestsChanged();
      toast.success('Request cancelled. You can now send a new one.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel request');
    } finally {
      setResponding(null);
    }
  };

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Loader className="w-10 h-10 text-gold-500 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  const pendingIncoming = incoming.filter(r => r.status === 'PENDING');

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Navbar />

      <main id="main-content" className="max-w-3xl mx-auto px-4 pt-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Connection Requests</h1>
          {pendingIncoming.length > 0 && (
            <span className="bg-gold-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingIncoming.length} new
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 rounded-lg p-1" style={{ backgroundColor: 'var(--color-surface)' }}>
          <button
            onClick={() => setTab('incoming')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition ${
              tab === 'incoming'
                ? 'shadow-sm'
                : ''
            }`}
            style={tab === 'incoming' ? { backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' } : { color: 'var(--color-text-muted)' }}
          >
            <Inbox className="w-4 h-4" />
            Incoming ({incoming.length})
          </button>
          <button
            onClick={() => setTab('outgoing')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition ${
              tab === 'outgoing'
                ? 'shadow-sm'
                : ''
            }`}
            style={tab === 'outgoing' ? { backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' } : { color: 'var(--color-text-muted)' }}
          >
            <Send className="w-4 h-4" />
            Outgoing ({outgoing.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-10 h-10 text-gold-500 animate-spin" />
          </div>
        ) : tab === 'incoming' ? (
          incoming.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-gold-100)' }}>
                <Users className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>No incoming requests</h2>
              <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                When someone wants to connect with you, their request will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incoming.map((req) => {
                const person = req.requester;
                const profile = person?.profile;
                const maritalLine = formatMaritalLine(
                  profile?.maritalStatus ?? null,
                  profile?.hasChildren ?? null,
                  profile?.childrenCount ?? null,
                );
                return (
                  <div key={req.id} className="card p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-gradient-gold rounded-full flex items-center justify-center text-black font-bold text-lg flex-shrink-0">
                          {profile?.firstName?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/profiles/${person?.publicId}`}
                              className="font-semibold hover:text-gold-400 transition"
                            >
                              {profile?.firstName || 'Unknown'}
                            </Link>
                            <StatusBadge status={req.status} />
                          </div>
                          <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-sm flex-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                            <span>{profile?.ethnicity}</span>
                            {(profile?.city || profile?.state) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {[profile?.city, profile?.state].filter(Boolean).join(', ')}
                              </span>
                            )}
                            <span>{timeAgo(req.createdAt)}</span>
                          </div>
                          {maritalLine && (
                            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{maritalLine}</p>
                          )}
                        </div>
                      </div>

                      {req.status === 'PENDING' && (
                        <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-shrink-0">
                          <button
                            onClick={() => setAcceptingId(acceptingId === req.id ? null : req.id)}
                            disabled={responding === req.id}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1 flex-1 sm:flex-none disabled:opacity-50"
                          >
                            {responding === req.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Accept
                          </button>
                          <button
                            onClick={() => handleRespond(req.id, false)}
                            disabled={responding === req.id}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1 flex-1 sm:flex-none disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Decline
                          </button>
                        </div>
                      )}
                    </div>

                    {req.status === 'PENDING' && acceptingId === req.id && (
                      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <p className="text-sm mb-1 font-medium" style={{ color: 'var(--color-text)' }}>
                          Whose contact should they receive?
                        </p>
                        <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                          They can view it once. After that, it cannot be taken back.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleRespond(req.id, true, 'GUARDIAN')}
                            disabled={!guardianSaved || responding === req.id}
                            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            My guardian&apos;s contact
                          </button>
                          <button
                            onClick={() => handleRespond(req.id, true, 'SELF')}
                            disabled={responding === req.id}
                            className="btn-secondary text-sm disabled:opacity-50"
                          >
                            My own contact
                          </button>
                        </div>
                        {!guardianSaved && (
                          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                            No guardian contact is saved on your profile.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          outgoing.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-gold-100)' }}>
                <Send className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>No outgoing requests</h2>
              <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                Browse profiles and send a contact request to get started.
              </p>
              <Link href="/browse" className="btn-primary inline-block">
                Browse Profiles
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {outgoing.map((req) => {
                const person = req.target;
                const profile = person?.profile;
                return (
                  <div key={req.id} className="card p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-gold rounded-full flex items-center justify-center text-black font-bold text-lg flex-shrink-0">
                        {profile?.firstName?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/profiles/${person?.publicId}`}
                            className="font-semibold hover:text-gold-400 transition"
                          >
                            {profile?.firstName || 'Unknown'}
                          </Link>
                          <StatusBadge status={req.status} />
                        </div>
                        <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-sm flex-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                          <span>{profile?.ethnicity}</span>
                          {(profile?.city || profile?.state) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {[profile?.city, profile?.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                          <span>Sent {timeAgo(req.createdAt)}</span>
                        </div>
                        {req.status === 'PENDING' && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500">
                              Waiting for response...
                            </p>
                            {confirmCancelId === req.id ? (
                              <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                  Cancel this request? They will no longer see it.
                                </p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleCancel(req.id)}
                                    disabled={responding === req.id}
                                    className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 disabled:opacity-50"
                                  >
                                    {responding === req.id ? (
                                      <Loader className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <X className="w-3.5 h-3.5" />
                                    )}
                                    Yes, cancel
                                  </button>
                                  <button
                                    onClick={() => setConfirmCancelId(null)}
                                    className="px-3 py-2 rounded-lg text-xs font-medium transition"
                                    style={{ color: 'var(--color-text-muted)' }}
                                  >
                                    Keep it
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmCancelId(req.id)}
                                className="mt-2 text-xs font-medium text-red-400 hover:text-red-300 transition inline-flex items-center gap-1 py-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancel request
                              </button>
                            )}
                          </div>
                        )}
                        {req.status === 'APPROVED' && req.contactState === 'AVAILABLE' && (
                          <Link href={`/requests/${req.id}/contact`} className="btn-primary text-xs inline-block mt-2 px-3 py-2">
                            View contact details
                          </Link>
                        )}
                        {req.status === 'APPROVED' && req.contactState === 'VIEWED' && (
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            You have viewed these contact details.
                          </p>
                        )}
                        {req.status === 'APPROVED' && req.contactState === 'EXPIRED' && (
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            The contact link expired. You can send a new request from their profile.
                          </p>
                        )}
                        {req.status === 'APPROVED' && req.contactState === 'EMAILED' && (
                          <p className="text-xs text-green-400 mt-1">
                            Contact info has been sent to your email.
                          </p>
                        )}
                        {req.status === 'EXPIRED' && person?.publicId && (
                          <button
                            onClick={() => handleResend(person.publicId, req.id)}
                            disabled={responding === req.id}
                            className="btn-secondary text-xs mt-2 px-3 py-2 disabled:opacity-50"
                          >
                            Send again
                          </button>
                        )}
                        {req.status === 'DENIED' && (
                          <p className="text-xs text-gray-500 mt-1">
                            You can now send a request to another profile.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}
