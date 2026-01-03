'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    byGender: { male: 0, female: 0 },
    paidUsers: 0,
    byTier: { FREE: 0, SILVER: 0, GOLD: 0 },
  });

  useEffect(() => {
    // TODO: Fetch from API
    setStats({
      totalUsers: 1250,
      byGender: { male: 620, female: 630 },
      paidUsers: 185,
      byTier: { FREE: 1065, SILVER: 120, GOLD: 65 },
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Admin Header */}
      <header className="bg-white dark:bg-gray-800 border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          <Link href="/" className="text-primary-600 hover:underline">← Back to Site</Link>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 border-r min-h-screen p-4">
          <nav className="space-y-2">
            {[
              { href: '/admin', label: 'Dashboard', icon: '📊' },
              { href: '/admin/users', label: 'Users', icon: '👥' },
              { href: '/admin/ads', label: 'Ads', icon: '📢' },
              { href: '/admin/coupons', label: 'Coupons', icon: '🎟️' },
              { href: '/admin/campaigns', label: 'Campaigns', icon: '📧' },
              { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <h2 className="font-display text-xl font-semibold mb-6">Overview</h2>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="card">
              <div className="text-3xl font-bold text-primary-600">{stats.totalUsers}</div>
              <div className="text-gray-500">Total Users</div>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-blue-600">{stats.byGender.male}</div>
              <div className="text-gray-500">Male Users</div>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-pink-600">{stats.byGender.female}</div>
              <div className="text-gray-500">Female Users</div>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-gold-600">{stats.paidUsers}</div>
              <div className="text-gray-500">Paid Members</div>
            </div>
          </div>

          {/* Membership Breakdown */}
          <div className="card mb-8">
            <h3 className="font-semibold mb-4">Membership Tiers</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold">{stats.byTier.FREE}</div>
                <div className="text-gray-500">Free</div>
              </div>
              <div className="text-center p-4 bg-gray-200 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold">{stats.byTier.SILVER}</div>
                <div className="text-gray-500">Silver</div>
              </div>
              <div className="text-center p-4 bg-gold-100 dark:bg-gold-900/30 rounded-lg">
                <div className="text-2xl font-bold text-gold-700">{stats.byTier.GOLD}</div>
                <div className="text-gold-700">Gold</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-4">
              <Link href="/admin/campaigns/new" className="btn-primary">Create Campaign</Link>
              <Link href="/admin/ads/new" className="btn-outline">Add New Ad</Link>
              <Link href="/admin/coupons/new" className="btn-outline">Create Coupon</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
