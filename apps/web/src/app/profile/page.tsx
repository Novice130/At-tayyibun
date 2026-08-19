'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader, Heart, User, MapPin, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireSession } from '@/lib/hooks';
import { Navbar } from '@/components/Navbar';
// Mirrors the payload from GET /api/profiles/me
// (apps/api/src/modules/profiles/profiles.service.ts -> getMyProfile).
interface UserProfile {
  id: string;
  publicId: string;
  email: string;
  phone?: string | null;
  profile: {
    firstName: string;
    lastName?: string;
    dob?: string;
    age?: number;
    gender: string;
    city: string | null;
    state: string | null;
    ethnicity: string;
    bio?: string | null;
    biodata?: Record<string, unknown>;
    profileComplete?: boolean;
  } | null;
  membershipTier: string;
  isVerified: boolean;
}

const BIODATA_LABELS: { key: string; label: string }[] = [
  { key: 'education', label: 'Education' },
  { key: 'profession', label: 'Profession' },
  { key: 'legalStatus', label: 'Legal Status' },
  { key: 'relocate', label: 'Open to Relocate' },
  { key: 'religiousPractice', label: 'Religious Practice' },
  { key: 'prayerFrequency', label: 'Prayer' },
  { key: 'dietaryPreference', label: 'Diet' },
  { key: 'sect', label: 'Sect' },
];

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { session, loading: sessionLoading } = useRequireSession();

  useEffect(() => {
    if (session) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const data = await api.get('/profiles/me');
      setUser(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      if ((err as any).statusCode === 401) {
        router.push('/login');
      } else {
        setError('Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE' || deleting) return;
    setDeleting(true);
    try {
      await api.delete('/users/me');
      // Clear the local session cookie and bounce to login.
      await fetch('/auth/sign-out', { method: 'POST' }).catch(() => {});
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Account deletion failed:', err);
      setError('Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };


  if (sessionLoading || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Navbar />

      <main id="main-content" className="max-w-4xl mx-auto px-4 pt-24">
        {error ? (
          <div className="text-center text-red-500 p-8">{error}</div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="card p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="w-24 h-24 bg-gradient-gold rounded-full flex items-center justify-center text-black font-bold text-3xl overflow-hidden shadow-xl border border-white/10">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="Profile Avatar" className="w-full h-full object-cover" />
                ) : user?.profile?.firstName?.[0] ? (
                  user.profile.firstName[0]
                ) : (
                  <User className="w-12 h-12" />
                )}
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="font-heading text-3xl font-bold mb-2 flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  {[user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ')}
                  {user?.profile?.age ? <span className="text-secondary font-normal">, {user.profile.age}</span> : null}
                  {user?.isVerified && <Shield className="w-5 h-5 text-green-500" />}
                </h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-4" style={{ color: 'var(--color-text-secondary)' }}>
                  {(user?.profile?.city || user?.profile?.state) && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {[user?.profile?.city, user?.profile?.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {user?.profile?.ethnicity}
                  </div>
                  {user?.membershipTier !== 'FREE' && (
                     <div className="flex items-center gap-1 text-gold-400">
                       <Heart className="w-4 h-4" />
                       {user?.membershipTier} Member
                     </div>
                  )}
                </div>
              </div>
              <Link href="/profile/setup" className="btn-secondary">Edit Profile</Link>
            </div>

            {/* About Section */}
            <div className="card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold mb-4">About Me</h2>
              <p className="leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
                {user?.profile?.bio || 'No bio added yet.'}
              </p>
            </div>

            {/* Details Section */}
            <div className="card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold mb-4">Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>Gender</label>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{user?.profile?.gender}</p>
                </div>
                <div>
                  <label className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>Ethnicity</label>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{user?.profile?.ethnicity}</p>
                </div>
                <div>
                  <label className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>Public ID</label>
                  <p className="font-medium font-mono text-gold-400 break-all">{user?.publicId}</p>
                </div>
                {BIODATA_LABELS.map(({ key, label }) => {
                  const value = displayValue(user?.profile?.biodata?.[key]);
                  if (!value) return null;
                  return (
                    <div key={key}>
                      <label className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>{value}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Match Preferences — previously saved but never shown anywhere */}
            {(displayValue(user?.profile?.biodata?.partnerPreferences) ||
              displayValue(user?.profile?.biodata?.dealBreakers)) && (
              <div className="card p-6 sm:p-8 space-y-6">
                <h2 className="font-heading text-xl font-bold">Match Preferences</h2>
                {displayValue(user?.profile?.biodata?.partnerPreferences) && (
                  <div>
                    <label className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>
                      What I&apos;m Looking For
                    </label>
                    <p className="leading-relaxed whitespace-pre-line mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {displayValue(user?.profile?.biodata?.partnerPreferences)}
                    </p>
                  </div>
                )}
                {displayValue(user?.profile?.biodata?.dealBreakers) && (
                  <div>
                    <label className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>
                      Deal Breakers
                    </label>
                    <p className="leading-relaxed whitespace-pre-line mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {displayValue(user?.profile?.biodata?.dealBreakers)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Legal */}
            <div className="card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold mb-4">Legal</h2>
              <div className="flex flex-wrap gap-4">
                <Link href="/privacy" className="btn-secondary">Privacy Policy</Link>
                <Link href="/terms" className="btn-secondary">Terms of Service</Link>
                <Link href="/contact" className="btn-secondary">Contact Us</Link>
              </div>
            </div>

            {/* Danger Zone — account deletion (App Store 5.1.1(v)) */}
            <div className="card p-6 sm:p-8 border-red-500/30">
              <h2 className="font-heading text-xl font-bold mb-2 text-red-500">Danger Zone</h2>
              <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Deleting your account is permanent and immediate. Your profile, photos,
                requests and messages are removed right away and cannot be recovered.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="input flex-1"
                  aria-label="Type DELETE to confirm"
                />
                <button
                  onClick={deleteAccount}
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                  className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting…' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
