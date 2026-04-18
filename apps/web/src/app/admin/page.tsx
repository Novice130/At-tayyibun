'use client';

import { useEffect, useState } from 'react';
import { Users, UserCheck, Crown, Sparkles, Loader, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface Analytics {
  totalUsers: number;
  byGender: { male: number; female: number };
  byMembership: { free: number; silver: number; gold: number };
  verifiedUsers: number;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/admin/analytics')
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Platform health at a glance.</p>
      </header>

      {loading && (
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
          <Loader className="w-4 h-4 animate-spin" /> Loading analytics…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Kpi label="Total users" value={data.totalUsers} icon={Users} />
            <Kpi label="Verified" value={data.verifiedUsers} icon={UserCheck} />
            <Kpi label="Brothers" value={data.byGender.male} icon={Users} />
            <Kpi label="Sisters" value={data.byGender.female} icon={Users} />
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
              Memberships
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TierCard label="Free" count={data.byMembership.free} total={data.totalUsers} tone="neutral" />
              <TierCard
                label="Silver"
                count={data.byMembership.silver}
                total={data.totalUsers}
                tone="silver"
                icon={Sparkles}
              />
              <TierCard
                label="Gold"
                count={data.byMembership.gold}
                total={data.totalUsers}
                tone="gold"
                icon={Crown}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        <Icon className="w-4 h-4 text-gold-500" />
      </div>
      <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function TierCard({
  label,
  count,
  total,
  tone,
  icon: Icon,
}: {
  label: string;
  count: number;
  total: number;
  tone: 'neutral' | 'silver' | 'gold';
  icon?: React.ElementType;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor = tone === 'gold' ? 'bg-gold-500' : tone === 'silver' ? 'bg-gray-400' : 'bg-gray-500';
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${tone === 'gold' ? 'text-gold-500' : 'text-gray-400'}`} />}
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {label}
          </span>
        </div>
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {pct}%
        </span>
      </div>
      <div className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
        {count.toLocaleString()}
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
