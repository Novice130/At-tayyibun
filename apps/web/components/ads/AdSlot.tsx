'use client';

interface AdSlotProps {
  className?: string;
}

export function AdSlot({ className = '' }: AdSlotProps) {
  // TODO: Fetch ad from API based on user tier
  const ad = {
    id: '1',
    imageUrl: 'https://placehold.co/300x250/e2e8f0/64748b?text=Partner+Ad',
    clickUrl: '#',
    altText: 'Sponsored: Local Marriage Services',
    partnerName: 'Local Partner',
  };

  const handleClick = async () => {
    // TODO: Record click to API
    window.open(ad.clickUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`card bg-gray-50 dark:bg-gray-800/50 border-dashed ${className}`}>
      <div className="text-xs text-gray-400 mb-2">Sponsored</div>
      <button onClick={handleClick} className="block w-full">
        <img
          src={ad.imageUrl}
          alt={ad.altText}
          className="w-full rounded-lg"
        />
      </button>
      <div className="text-xs text-gray-500 mt-2">{ad.partnerName}</div>
    </div>
  );
}
