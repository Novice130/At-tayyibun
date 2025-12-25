'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Heart } from 'lucide-react';

interface ProfileCardProps {
  publicId: string;
  firstName: string;
  age: number;
  ethnicity: string;
  city?: string;
  state?: string;
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

  return (
    <Link href={`/profiles/${publicId}`} className="profile-card block">
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3">
        <Image
          src={avatarUrl}
          alt={`${firstName}'s avatar`}
          fill
          className="object-cover"
          unoptimized // DiceBear URLs
        />
        {membershipTier !== 'FREE' && (
          <div className="absolute top-2 right-2">
            {tierBadge[membershipTier]}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{firstName}, {age}</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              // TODO: Add to favorites
            }}
            className="p-2 hover:bg-white/5 rounded-full transition"
          >
            <Heart className="w-5 h-5 text-gray-400 hover:text-gold-500" />
          </button>
        </div>

        <p className="text-sm text-gold-400">{ethnicity}</p>

        {(city || state) && (
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {[city, state].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    </Link>
  );
}
