'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { formatPlace, memberDisplayName } from '@/lib/format';
import { PhoneVerifiedBadge } from './PhoneVerifiedBadge';

interface ProfileCardProps {
  publicId: string;
  /** Name to show: first name, or an alias like "Sister 4821". Missing on older API responses. */
  displayName?: string | null;
  /** Null when the member hides their name. */
  firstName?: string | null;
  age: number;
  ethnicity: string;
  city?: string | null;
  state?: string | null;
  avatarUrl: string;
  membershipTier?: 'FREE' | 'SILVER' | 'GOLD';
  phoneVerified?: boolean;
}

export function ProfileCard({
  publicId,
  displayName,
  firstName,
  age,
  ethnicity,
  city,
  state,
  avatarUrl,
  membershipTier = 'FREE',
  phoneVerified,
}: ProfileCardProps) {
  const tierBadge = {
    FREE: null,
    SILVER: <span className="badge-silver">Silver</span>,
    GOLD: <span className="badge-gold">Gold</span>,
  };

  const name = memberDisplayName({ displayName, firstName });
  const place = formatPlace(city, state);

  const content = (
    <>
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
        <Image
          src={avatarUrl}
          alt={`${name}'s avatar`}
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
        <h3 className="font-semibold text-lg break-words" style={{ color: 'var(--color-text)' }}>
          {name}, {age}
        </h3>

        <p className="text-sm" style={{ color: 'var(--color-gold-500)' }}>{ethnicity}</p>

        {place && (
          <p className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <MapPin className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {place}
          </p>
        )}

        {(phoneVerified ?? false) && (
          <div className="pt-1">
            <PhoneVerifiedBadge />
          </div>
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
