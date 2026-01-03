'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { FilterBar } from '@/components/profile/FilterBar';
import { AdSlot } from '@/components/ads/AdSlot';

interface Profile {
  publicId: string;
  firstName: string;
  ageRange: string;
  city: string;
  state: string;
  ethnicity: string;
  avatar?: string;
  membershipTier: 'FREE' | 'SILVER' | 'GOLD';
}

export default function BrowsePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [adFrequency, setAdFrequency] = useState(5);

  useEffect(() => {
    // TODO: Fetch profiles from API
    setLoading(false);
    // Mock data for demonstration
    setProfiles([
      { publicId: '1', firstName: 'Ahmed', ageRange: '28-32', city: 'Chicago', state: 'IL', ethnicity: 'Arab', membershipTier: 'GOLD' },
      { publicId: '2', firstName: 'Fatima', ageRange: '24-28', city: 'New York', state: 'NY', ethnicity: 'South Asian', membershipTier: 'FREE' },
      { publicId: '3', firstName: 'Omar', ageRange: '30-35', city: 'Houston', state: 'TX', ethnicity: 'African American', membershipTier: 'SILVER' },
    ]);
  }, [filters]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-gold-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold mb-6">Browse Profiles</h1>
        
        <FilterBar onFilterChange={setFilters} />

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {profiles.map((profile, index) => (
              <>
                <ProfileCard
                  key={profile.publicId}
                  publicId={profile.publicId}
                  firstName={profile.firstName}
                  ageRange={profile.ageRange}
                  city={profile.city}
                  state={profile.state}
                  ethnicity={profile.ethnicity}
                  avatarUrl={profile.avatar}
                  membershipTier={profile.membershipTier}
                />
                {/* Ad slot every N profiles */}
                {adFrequency > 0 && (index + 1) % adFrequency === 0 && (
                  <AdSlot key={`ad-${index}`} />
                )}
              </>
            ))}
          </div>
        )}

        {profiles.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No profiles found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
}
