'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, Users, Settings, LogOut, Loader, Megaphone, Ticket, Mail, FileJson, Menu, X } from 'lucide-react';
import { useSession, signOut } from '@/lib/auth-client';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/ads', label: 'Ads', icon: Megaphone },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/campaigns', label: 'Campaigns', icon: Mail },
  { href: '/admin/schemas', label: 'Schemas', icon: FileJson },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = (session?.user as any)?.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const twoFactorEnabled = (session?.user as any)?.twoFactorEnabled === true;
  const isMfaPage = pathname.startsWith('/admin/security');
  // The challenge page is reached during a partial 2FA session where
  // /auth/get-session returns null until verifyOtp completes. Allow it through
  // without requiring a full session.
  const isChallengePage = pathname === '/admin/security/challenge';
  // Once session loads (non-null), 2FA is already verified — better-auth keeps
  // partial 2FA sessions hidden from /auth/get-session until verifyOtp succeeds.
  const mfaGateActive = !isMfaPage && role === 'SUPER_ADMIN' && !twoFactorEnabled;

  useEffect(() => {
    if (isPending) return;
    if (isChallengePage) return;
    if (!session) { router.replace('/login'); return; }
    if (!isAdmin) { router.replace('/browse'); return; }
    if (role === 'SUPER_ADMIN' && !twoFactorEnabled && !isMfaPage) {
      router.replace('/admin/security/setup');
      return;
    }
  }, [session, isPending, isAdmin, role, twoFactorEnabled, isMfaPage, isChallengePage, pathname, router]);

  if (isChallengePage) return <>{children}</>;
  if (isPending || !session || !isAdmin || mfaGateActive) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Loader className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Mobile top bar — the sidebar below is a fixed 256px, which left only
          ~119px of content on a phone before this. */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center gap-3 px-4 border-b"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open admin menu"
          className="min-w-11 min-h-11 -ml-2 flex items-center justify-center rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-heading font-bold text-gradient-gold">Admin Panel</span>
      </div>

      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`w-64 border-r flex flex-col fixed inset-y-0 left-0 z-50 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close admin menu"
          className="md:hidden absolute top-3 right-3 min-w-11 min-h-11 flex items-center justify-center rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/at-tayyibun-logo.png" alt="At-Tayyibun" width={36} height={36} className="rounded-full" />
            <div>
              <div className="font-heading font-bold text-gradient-gold leading-tight">At-Tayyibun</div>
              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Admin Panel
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active ? 'bg-gold-500/15 text-gold-400' : 'hover:bg-gold-500/5'
                }`}
                style={!active ? { color: 'var(--color-text-secondary)' } : undefined}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Signed in as
            <div className="truncate font-medium" style={{ color: 'var(--color-text)' }}>
              {session.user.email}
            </div>
            <div className="text-gold-500 font-semibold">{role}</div>
          </div>
          <div className="flex items-center justify-between px-3 pt-1">
            <ThemeToggle />
            <button
              onClick={() => signOut().then(() => router.push('/login'))}
              className="flex items-center gap-1 text-xs hover:text-red-400 transition"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
