import { BadgeCheck } from 'lucide-react';

/** Small "Phone verified" pill. The icon is decorative; the text carries the meaning. */
export function PhoneVerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`badge-verified ${className}`.trim()}>
      <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
      Phone verified
    </span>
  );
}
