'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, LogOut, Menu, X, MessageSquare, Bell, Loader, Lock, Shield } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { FilterBar } from '@/components/filters/FilterBar';
import { api } from '@/lib/api';
import { useSession, signOut } from '@/lib/auth-client';

interface ActiveRequest {
  id: string;
  status: string;
  targetId: string;
  target: {
    publicId: string;
    profile: { firstName: string | null } | null;
  };
}

export default function BrowsePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const [myGender, setMyGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (!session) return;
    // Fetch own profile to determine gender, then load opposite-gender profiles
    api.get('/profiles/me')
      .then((data: any) => {
        const gender: 'MALE' | 'FEMALE' | null = data?.profile?.gender ?? null;
        setMyGender(gender);
        const opposite = gender === 'MALE' ? 'FEMALE' : gender === 'FEMALE' ? 'MALE' : null;
        fetchProfiles(opposite ? { gender: opposite } : {});
      })
      .catch(() => fetchProfiles({}));
    fetchActiveRequest();
  }, [session]);

  const fetchProfiles = async (filters: any = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null)) as Record<string, string>
      );
      const data = await api.get('/profiles?' + params.toString());
      setProfiles(data.data || data.items || []);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveRequest = async () => {
    try {
      const data = await api.get('/requests/active');
      setActiveRequest(data);
    } catch {
      setActiveRequest(null);
    }
  };

  const handleFilter = (filters: { ethnicity: string; minAge: number | null; maxAge: number | null }) => {
    const opposite = myGender === 'MALE' ? 'FEMALE' : myGender === 'FEMALE' ? 'MALE' : null;
    const apiFilters: any = opposite ? { gender: opposite } : {};
    if (filters.ethnicity) apiFilters.ethnicity = filters.ethnicity;
    if (filters.minAge) apiFilters.minAge = filters.minAge.toString();
    if (filters.maxAge) apiFilters.maxAge = filters.maxAge.toString();
    fetchProfiles(apiFilters);
  };

  if (isPending || !session) return null;

  const hasActiveRequest = !!activeRequest;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Navbar />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Browse Profiles</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Find your righteous spouse</p>
        </div>

        {/* Active request banner */}
        {hasActiveRequest && (
          <div className="mb-6 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center gap-3">
            <Lock className="w-5 h-5 text-gold-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gold-300">
                You have a pending request for <strong>{activeRequest?.target?.profile?.firstName || activeRequest?.target?.publicId}</strong>.
                You can browse profiles but cannot send new requests until they respond.
              </p>
            </div>
            <Link href="/requests" className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
              View Requests
            </Link>
          </div>
        )}

        <FilterBar onFilter={handleFilter} />

        {/* Profiles grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-10 h-10 text-gold-500 animate-spin" />
          </div>
        ) : profiles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.publicId}
                {...profile}
                locked={hasActiveRequest && activeRequest?.target?.publicId !== profile.publicId}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p style={{ color: 'var(--color-text-secondary)' }}>No profiles match your filters</p>
            <button
              onClick={() => fetchProfiles()}
              className="btn-secondary mt-4"
            >
              Clear Filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
