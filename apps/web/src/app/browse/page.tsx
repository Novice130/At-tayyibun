'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, LogOut, Menu, X, MessageSquare, Bell, Loader, Lock } from 'lucide-react';
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
    profile: { firstName: string } | null;
  };
}

export default function BrowsePage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      fetchProfiles();
      fetchActiveRequest();
    }
  }, [session]);

  const fetchProfiles = async (filters: any = {}) => {
    setLoading(true);
    try {
      const data = await api.get('/profiles?' + new URLSearchParams(filters));
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
    const apiFilters: any = {};
    if (filters.ethnicity) apiFilters.ethnicity = filters.ethnicity;
    if (filters.minAge) apiFilters.minAge = filters.minAge.toString();
    if (filters.maxAge) apiFilters.maxAge = filters.maxAge.toString();
    fetchProfiles(apiFilters);
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (isPending || !session) return null;

  const hasActiveRequest = !!activeRequest;

  return (
    <div className="min-h-screen bg-background">
      {/* App Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="At-Tayyibun Logo"
                width={36}
                height={36}
                className="rounded-full"
              />
              <span className="font-heading font-bold text-gradient-gold hidden sm:block">At-Tayyibun</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="/browse" className="text-white font-medium">Browse</Link>
              <Link href="/requests" className="text-gray-400 hover:text-white transition">Requests</Link>
              <Link href="/messages" className="text-gray-400 hover:text-white transition relative">
                <MessageSquare className="w-5 h-5" />
              </Link>
              <button className="p-2 text-gray-400 hover:text-white transition">
                <Bell className="w-5 h-5" />
              </button>
              <Link href="/profile" className="p-2 text-gray-400 hover:text-white transition rounded-full overflow-hidden border border-transparent hover:border-gold-500/50">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="Profile" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </Link>
              <button onClick={handleLogout} className="p-2 text-red-400 hover:text-red-300 transition" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-surface animate-fade-in">
            <div className="px-4 py-4 space-y-3">
              <Link href="/browse" className="block py-2 text-white font-medium">Browse</Link>
              <Link href="/requests" className="block py-2 text-gray-400">Requests</Link>
              <Link href="/messages" className="block py-2 text-gray-400">Messages</Link>
              <Link href="/profile" className="block py-2 text-gray-400">My Profile</Link>
              <hr className="border-white/10" />
              <button onClick={handleLogout} className="flex items-center gap-2 py-2 text-red-400 w-full text-left">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold mb-2">Browse Profiles</h1>
          <p className="text-gray-400">Find your righteous spouse</p>
        </div>

        {/* Active request banner */}
        {hasActiveRequest && (
          <div className="mb-6 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center gap-3">
            <Lock className="w-5 h-5 text-gold-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gold-300">
                You have a pending request for <strong>{activeRequest?.target?.profile?.firstName}</strong>.
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
            <p className="text-gray-400">No profiles match your filters</p>
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
