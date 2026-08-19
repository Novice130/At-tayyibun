'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader, Lock, X } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { FilterBar } from '@/components/filters/FilterBar';
import { api } from '@/lib/api';
import { useRequireSession } from '@/lib/hooks';

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
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const [myGender, setMyGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { session, loading: sessionLoading } = useRequireSession();

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

  const handleCancelRequest = async () => {
    if (!activeRequest) return;
    setCancelling(true);
    try {
      await api.delete(`/requests/${activeRequest.id}`);
      setActiveRequest(null);
      toast.success('Request cancelled. You can now send a new one.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel request');
    } finally {
      setCancelling(false);
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

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Loader className="w-10 h-10 text-gold-500 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  const hasActiveRequest = !!activeRequest;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Navbar />

      {/* Main content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Browse Profiles</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Find your righteous spouse</p>
        </div>

        {/* Active request banner */}
        {hasActiveRequest && (
          <div className="mb-6 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20 flex flex-col sm:flex-row sm:items-center gap-3">
            <Lock className="w-5 h-5 text-gold-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gold-300">
                You have a pending request for <strong>{activeRequest?.target?.profile?.firstName || activeRequest?.target?.publicId}</strong>.
                You can browse and view profiles, but cannot send a new request until they respond
                — or until you cancel this one.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/requests" className="btn-secondary text-xs py-2 px-3 flex-1 sm:flex-none text-center">
                View Requests
              </Link>
              <button
                onClick={handleCancelRequest}
                disabled={cancelling}
                className="text-xs py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1 flex-1 sm:flex-none bg-red-600/20 hover:bg-red-600/30 text-red-400 disabled:opacity-50"
              >
                {cancelling ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Cancel
              </button>
            </div>
          </div>
        )}

        <FilterBar onFilter={handleFilter} loading={loading} />

        {/* Profiles grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-10 h-10 text-gold-500 animate-spin" />
          </div>
        ) : profiles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {profiles.map((profile) => (
              <ProfileCard key={profile.publicId} {...profile} />
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
