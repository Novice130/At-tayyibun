'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, User, LogOut, Menu, X, MessageSquare, Bell } from 'lucide-react';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { FilterBar } from '@/components/filters/FilterBar';

// Mock data for demo
const mockProfiles = [
  { publicId: 'abc123', firstName: 'Ahmad', age: 28, ethnicity: 'South Asian', city: 'Chicago', state: 'IL', avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=ahmad', membershipTier: 'GOLD' as const },
  { publicId: 'def456', firstName: 'Yusuf', age: 32, ethnicity: 'Arab', city: 'Houston', state: 'TX', avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=yusuf', membershipTier: 'SILVER' as const },
  { publicId: 'ghi789', firstName: 'Omar', age: 26, ethnicity: 'African', city: 'Atlanta', state: 'GA', avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=omar', membershipTier: 'FREE' as const },
  { publicId: 'jkl012', firstName: 'Ali', age: 30, ethnicity: 'Persian', city: 'Los Angeles', state: 'CA', avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=ali', membershipTier: 'GOLD' as const },
  { publicId: 'mno345', firstName: 'Ibrahim', age: 29, ethnicity: 'Turkish', city: 'New York', state: 'NY', avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=ibrahim', membershipTier: 'FREE' as const },
  { publicId: 'pqr678', firstName: 'Hassan', age: 27, ethnicity: 'South Asian', city: 'Dallas', state: 'TX', avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=hassan', membershipTier: 'SILVER' as const },
];

export default function BrowsePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profiles, setProfiles] = useState(mockProfiles);

  const handleFilter = (filters: { ethnicity: string; minAge: number | null; maxAge: number | null }) => {
    let filtered = [...mockProfiles];

    if (filters.ethnicity) {
      filtered = filtered.filter((p) => p.ethnicity === filters.ethnicity);
    }

    if (filters.minAge) {
      filtered = filtered.filter((p) => p.age >= filters.minAge!);
    }

    if (filters.maxAge) {
      filtered = filtered.filter((p) => p.age <= filters.maxAge!);
    }

    setProfiles(filtered);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* App Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/app/browse" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-gold rounded-full flex items-center justify-center">
                <Heart className="w-4 h-4 text-black" />
              </div>
              <span className="font-heading font-bold text-gradient-gold hidden sm:block">At-Tayyibun</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="/app/browse" className="text-white font-medium">Browse</Link>
              <Link href="/app/requests" className="text-gray-400 hover:text-white transition">Requests</Link>
              <Link href="/app/messages" className="text-gray-400 hover:text-white transition relative">
                <MessageSquare className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold-500 rounded-full text-xs text-black flex items-center justify-center">2</span>
              </Link>
              <button className="p-2 text-gray-400 hover:text-white transition">
                <Bell className="w-5 h-5" />
              </button>
              <Link href="/app/profile" className="p-2 text-gray-400 hover:text-white transition">
                <User className="w-5 h-5" />
              </Link>
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
              <Link href="/app/browse" className="block py-2 text-white font-medium">Browse</Link>
              <Link href="/app/requests" className="block py-2 text-gray-400">Requests</Link>
              <Link href="/app/messages" className="block py-2 text-gray-400">Messages</Link>
              <Link href="/app/profile" className="block py-2 text-gray-400">My Profile</Link>
              <hr className="border-white/10" />
              <button className="flex items-center gap-2 py-2 text-red-400">
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

        <FilterBar onFilter={handleFilter} />

        {/* Profiles grid */}
        {profiles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {profiles.map((profile) => (
              <ProfileCard key={profile.publicId} {...profile} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400">No profiles match your filters</p>
            <button 
              onClick={() => setProfiles(mockProfiles)}
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
