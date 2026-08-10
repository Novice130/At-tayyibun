'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Heart } from 'lucide-react';

interface ProfileCardProps {
  publicId: string;
  firstName: string | null;
  age: number;
  ethnicity: string;
  city?: string | null;
  state?: string | null;
  avatarUrl: string;
  membershipTier?: 'FREE' | 'SILVER' | 'GOLD';
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
          className="object-cover"
          unoptimized
        />
        {membershipTier !== 'FREE' && (
          <div className="absolute top-2 right-2">
            {tierBadge[membershipTier]}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-lg ${firstName ? '' : 'font-mono text-sm tracking-tight'}`} style={{ color: 'var(--color-text)' }}>
            {displayName}{firstName ? `, ${age}` : ` · ${age}`}
          </h3>
          <button
            onClick={(e) => {
              e.preventDefault();
            }}
            aria-label={`Save ${displayName}`}
            className="min-w-11 min-h-11 -mr-2 flex items-center justify-center rounded-full transition"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Heart className="w-5 h-5 hover:text-gold-500" />
          </button>
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

  return (
    <Link href={`/profiles/${publicId}`} className="profile-card block">
      {content}
    </Link>
  );
}
