'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader, Lock, X } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { FilterBar, FilterState } from '@/components/filters/FilterBar';
import { api } from '@/lib/api';
import { useRequireSession } from '@/lib/hooks';
import { pageFromSearch, pageToRecoverTo, reachablePages } from '@/lib/browse-paging';

interface ActiveRequest {
  id: string;
  status: string;
  targetId: string;
  target: {
    publicId: string;
    profile: { firstName: string | null } | null;
  };
}

type FetchProfiles = (activeFilters: FilterState, gender: 'MALE' | 'FEMALE' | null | undefined, requestedPage?: number) => Promise<void>;

const defaultFilters: FilterState = {
  ethnicity: '',
  minAge: null,
  maxAge: null,
  sortBy: 'rankBoost',
  order: 'desc',
};

export default function BrowsePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const [myGender, setMyGender] = useState<'MALE' | 'FEMALE' | null | undefined>(undefined);
  const [cancelling, setCancelling] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  // Only the newest fetch may write state: paging fast must not let a slow
  // earlier response overwrite the page the member is now on.
  const latestFetch = useRef(0);
  const { session, loading: sessionLoading } = useRequireSession();

  const fetchProfiles: FetchProfiles = useCallback(async (activeFilters: FilterState, gender: 'MALE' | 'FEMALE' | null | undefined, requestedPage = 1) => {
    const thisFetch = ++latestFetch.current;
    setLoading(true);
    try {
      const opposite = gender === 'MALE' ? 'FEMALE' : gender === 'FEMALE' ? 'MALE' : 'FEMALE';
      const queryParams: Record<string, string> = {
        gender: opposite,
        page: requestedPage.toString(),
      };

      if (activeFilters.ethnicity && activeFilters.ethnicity !== 'All Ethnicities') {
        queryParams.ethnicity = activeFilters.ethnicity;
      }
      if (activeFilters.minAge !== null && !isNaN(activeFilters.minAge)) {
        queryParams.minAge = activeFilters.minAge.toString();
      }
      if (activeFilters.maxAge !== null && !isNaN(activeFilters.maxAge)) {
        queryParams.maxAge = activeFilters.maxAge.toString();
      }
      if (activeFilters.sortBy) {
        queryParams.sortBy = activeFilters.sortBy;
      }
      if (activeFilters.order) {
        queryParams.order = activeFilters.order;
      }

      const params = new URLSearchParams(queryParams);
      const data = await api.get('/profiles?' + params.toString());
      if (thisFetch !== latestFetch.current) return;
      const rows = data.data || data.items || [];
      const apiPages = Number(data.meta?.pages) || 0;

      const recoverTo = pageToRecoverTo(requestedPage, rows.length, apiPages);
      if (recoverTo !== null) {
        await fetchProfiles(activeFilters, gender, recoverTo);
        return;
      }

      setProfiles(rows);
      setPage(requestedPage);
      setTotalPages(reachablePages(apiPages));
      // Keeps the page across a refresh and the browser Back button from a profile.
      window.history.replaceState(null, '', requestedPage > 1 ? `/browse?page=${requestedPage}` : '/browse');
    } catch (error: any) {
      if (error?.statusCode === 403 && error?.code === 'PROFILE_INCOMPLETE') {
        router.replace('/profile/setup');
        return;
      }
      console.error('Failed to fetch profiles:', error);
      if (thisFetch === latestFetch.current) toast.error('Failed to load profiles. Please try again.');
    } finally {
      if (thisFetch === latestFetch.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    
    // Fetch own profile to check completion & gender, then load opposite-gender profiles
    api.get('/profiles/me')
      .then((data: any) => {
        if (!mounted) return;
        const profile = data?.profile;
        if (!profile?.profileComplete) {
          router.replace('/profile/setup');
          return;
        }
        const gender: 'MALE' | 'FEMALE' | null = profile?.gender ?? null;
        setMyGender(gender);
        fetchProfiles(filters, gender, pageFromSearch(window.location.search));
      })
      .catch((err) => {
        if (!mounted) return;
        // If the profile does not exist yet, direct them to profile setup
        if (err?.statusCode === 404 || err?.status === 404 || err?.message?.includes('404')) {
          router.replace('/profile/setup');
          return;
        } else {
          setLoading(false);
          toast.error('Failed to load profiles. Please try again.');
        }
      });
      
    fetchActiveRequest();
    
    return () => { mounted = false; };
  }, [session, fetchProfiles, router]);

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

  const handleFilter = (newFilters: FilterState) => {
    setFilters(newFilters);
    if (myGender !== undefined) {
      fetchProfiles(newFilters, myGender);
    }
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
    if (myGender !== undefined) {
      fetchProfiles(defaultFilters, myGender);
    }
  };

  const goToPage = (next: number) => {
    fetchProfiles(filters, myGender, next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (sessionLoading || !session || myGender === undefined) {
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

        <FilterBar filters={filters} onFilter={handleFilter} loading={loading} />

        {/* Profiles grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-10 h-10 text-gold-500 animate-spin" />
          </div>
        ) : profiles.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {profiles.map((profile) => (
                <ProfileCard key={profile.publicId} {...profile} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="btn-secondary disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </button>
                <span className="text-sm" aria-current="page" style={{ color: 'var(--color-text-secondary)' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="btn-secondary disabled:opacity-50 disabled:pointer-events-none"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p style={{ color: 'var(--color-text-secondary)' }}>No profiles match your filters</p>
            <button
              onClick={handleClearFilters}
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
