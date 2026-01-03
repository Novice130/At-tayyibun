import Image from 'next/image';
import Link from 'next/link';

interface ProfileCardProps {
  publicId: string;
  firstName: string;
  ageRange: string;
  city: string;
  state: string;
  ethnicity: string;
  avatarUrl?: string;
  membershipTier?: 'FREE' | 'SILVER' | 'GOLD';
}

export function ProfileCard({
  publicId,
  firstName,
  ageRange,
  city,
  state,
  ethnicity,
  avatarUrl,
  membershipTier = 'FREE',
}: ProfileCardProps) {
  const tierBadge = {
    FREE: null,
    SILVER: { label: 'Silver', class: 'bg-gray-200 text-gray-700' },
    GOLD: { label: 'Gold', class: 'badge-gold' },
  }[membershipTier];

  return (
    <Link href={`/profiles/${publicId}`} className="block">
      <div className="card group hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
        {/* Avatar */}
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={`${firstName}'s avatar`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400">
              👤
            </div>
          )}
          {tierBadge && (
            <span className={`absolute top-2 right-2 badge ${tierBadge.class}`}>
              {tierBadge.label}
            </span>
          )}
        </div>

        {/* Info */}
        <h3 className="font-display text-lg font-semibold group-hover:text-primary-600 transition-colors">
          {firstName}, {ageRange}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {city}, {state}
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-sm">
          {ethnicity}
        </p>
      </div>
    </Link>
  );
}
