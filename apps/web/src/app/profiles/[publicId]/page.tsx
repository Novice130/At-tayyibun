'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowLeft, MapPin, User, Loader, Lock, Send, X, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireSession } from '@/lib/hooks';
import { Navbar } from '@/components/Navbar';

interface ProfileData {
  publicId: string;
  firstName: string | null;
  age: number;
  gender: string;
  ethnicity: string;
  city?: string | null;
  state?: string | null;
  avatarUrl: string;
  bio?: string;
  membershipTier?: string;
  profileComplete?: boolean;
  isFullView?: boolean;
}

interface ActiveRequest {
  id: string;
  status: string;
  target: {
    publicId: string;
    profile: { firstName: string | null } | null;
  };
}

export default function ProfileDetailPage() {
  const params = useParams();
  const publicId = params.publicId as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const { session, loading: sessionLoading } = useRequireSession();

  useEffect(() => {
    if (session && publicId) {
      fetchProfile();
      fetchActiveRequest();
    }
  }, [session, publicId]);

  const fetchProfile = async () => {
    try {
      const data = await api.get(`/profiles/${publicId}`);
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Profile not found');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveRequest = async () => {
    try {
      const data = await api.get('/requests/active');
      setActiveRequest(data);
    } catch {
      // No active request
      setActiveRequest(null);
    }
  };

  const handleRequestContact = async () => {
    setRequesting(true);
    try {
      await api.post('/requests', { targetPublicId: publicId });
      setRequestSent(true);
      await fetchActiveRequest();
      toast.success('Request sent. You will get an email when they respond.');
    } catch (err: any) {
      if (err.statusCode === 409) {
        toast.error('You already have a pending request. Cancel it first to send another.');
        await fetchActiveRequest();
      } else {
        toast.error(err.message || 'Failed to send request');
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!activeRequest) return;
    setCancelling(true);
    try {
      await api.delete(`/requests/${activeRequest.id}`);
      setActiveRequest(null);
      setRequestSent(false);
      toast.success('Request cancelled. You can now send a new one.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  // Check if this profile is the one we have a pending request for
  const hasPendingRequestForThis = activeRequest?.target?.publicId === publicId && activeRequest?.status === 'PENDING';
  const hasAnyPendingRequest = !!activeRequest;

  if (sessionLoading || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="card p-12 text-center">
          <p className="text-red-400 mb-4">{error || 'Profile not found'}</p>
          <Link href="/browse" className="btn-primary inline-block">Back to Browse</Link>
        </div>
      </div>
    );
  }

  const displayName = profile.firstName ?? profile.publicId;
  const isAnon = !profile.firstName;

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Navbar />

      <main id="main-content" className="max-w-3xl mx-auto px-4 pt-24">
        <Link href="/browse" className="inline-flex items-center gap-2 text-secondary hover:text-gold-500 mb-6 transition-colors group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Browse
        </Link>
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="card p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gold-500/30 shadow-xl flex-shrink-0">
                <Image
                  src={profile.avatarUrl}
                  alt={`${displayName}'s avatar`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className={`font-heading mb-2 font-bold ${isAnon ? 'text-xl font-mono tracking-tight' : 'text-3xl'}`}>
                  {displayName}{isAnon ? ` · ${profile.age}` : `, ${profile.age}`}
                </h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-4" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {profile.gender === 'MALE' ? 'Brother' : 'Sister'}
                  </span>
                  <span className="text-gold-400">{profile.ethnicity}</span>
                  {(profile.city || profile.state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {[profile.city, profile.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
                {profile.membershipTier && profile.membershipTier !== 'FREE' && (
                  <div className="mt-2">
                    <span className={profile.membershipTier === 'GOLD' ? 'badge-gold' : 'badge-silver'}>
                      {profile.membershipTier} Member
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bio Section */}
          {profile.bio && (
            <div className="card p-8">
              <h2 className="font-heading text-xl font-bold mb-4">About</h2>
              <p className="leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{profile.bio}</p>
            </div>
          )}

          {/* Contact Request Section */}
          <div className="card p-8">
            <h2 className="font-heading text-xl font-bold mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-gold-500" />
              Contact Information
            </h2>

            {requestSent || hasPendingRequestForThis ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-gold-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Request Sent!</h3>
                <p className="max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                  Your contact request has been sent to {displayName}. You&apos;ll receive an email when they respond.
                </p>
                <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>
                  While waiting you can still browse and view other profiles. To request someone
                  else instead, cancel this request first.
                </p>
                <button
                  onClick={handleCancelRequest}
                  disabled={cancelling}
                  className="mt-4 py-2.5 px-5 rounded-lg text-sm font-medium transition inline-flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 disabled:opacity-50"
                >
                  {cancelling ? <Loader className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Cancel Request
                </button>
              </div>
            ) : hasAnyPendingRequest ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-gold-100)' }}>
                  <Lock className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <h3 className="text-lg font-semibold mb-2">Request Locked</h3>
                <p className="max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                  You already have a pending request for <strong>{activeRequest?.target?.profile?.firstName || activeRequest?.target?.publicId}</strong>.
                  Wait for their response, or cancel it to request {displayName} instead.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 mt-4">
                  <Link href="/requests" className="btn-secondary text-center">
                    View My Requests
                  </Link>
                  <button
                    onClick={handleCancelRequest}
                    disabled={cancelling}
                    className="py-2.5 px-5 rounded-lg text-sm font-medium transition inline-flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 disabled:opacity-50"
                  >
                    {cancelling ? <Loader className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Cancel Pending Request
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                  Contact details are private. Send a request and {displayName} will decide
                  whether to share their phone number and email with you.
                </p>
                <button
                  onClick={handleRequestContact}
                  disabled={requesting}
                  className="btn-primary py-3 px-8 text-lg flex items-center gap-2 mx-auto"
                >
                  {requesting ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  Request Contact Info
                </button>
                <p className="text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
                  You can only have one active request at a time — you can cancel it whenever you like.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
