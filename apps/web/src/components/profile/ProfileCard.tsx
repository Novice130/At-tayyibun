'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Heart, Lock } from 'lucide-react';

interface ProfileCardProps {
  publicId: string;
  firstName: string | null;
  age: number;
  ethnicity: string;
  city?: string | null;
  state?: string | null;
  avatarUrl: string;
  membershipTier?: 'FREE' | 'SILVER' | 'GOLD';
  locked?: boolean;
}

export function ProfileCard({
  publicId,
  firstName,
  age,
  ethnicity,
  city,
  state,
  avatarUrl,
  membershipTier = 'FREE',
  locked = false,
}: ProfileCardProps) {
  const tierBadge = {
    FREE: null,
    SILVER: <span className="badge-silver">Silver</span>,
    GOLD: <span className="badge-gold">Gold</span>,
  };

  const displayName = firstName ?? publicId;

  const content = (
    <>
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
        <Image
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          fill
          className={`object-cover ${locked ? 'opacity-60' : ''}`}
          unoptimized
        />
        {membershipTier !== 'FREE' && (
          <div className="absolute top-2 right-2">
            {tierBadge[membershipTier]}
          </div>
        )}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Lock className="w-8 h-8 text-white/60" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-lg ${firstName ? '' : 'font-mono text-sm tracking-tight'}`} style={{ color: 'var(--color-text)' }}>
            {displayName}{firstName ? `, ${age}` : ` · ${age}`}
          </h3>
          {!locked && (
            <button
              onClick={(e) => {
                e.preventDefault();
              }}
              className="p-2 rounded-full transition"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Heart className="w-5 h-5 hover:text-gold-500" />
            </button>
          )}
        </div>

        <p className="text-sm" style={{ color: 'var(--color-gold-500)' }}>{ethnicity}</p>

        {(city || state) && (
          <p className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <MapPin className="w-4 h-4" />
            {[city, state].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    </>
  );

  if (locked) {
    return (
      <div className="profile-card block cursor-not-allowed" title="You have a pending request. Wait for a response before viewing another profile.">
        {content}
      </div>
    );
  }

  return (
    <Link href={`/profiles/${publicId}`} className="profile-card block">
      {content}
    </Link>
  );
}
