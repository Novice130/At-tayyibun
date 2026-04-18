'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, Users, Settings, LogOut, Loader, Image as ImageIcon, Megaphone, Ticket, Mail, FileJson } from 'lucide-react';
import { useSession, signOut } from '@/lib/auth-client';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/photos', label: 'Photos', icon: ImageIcon },
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
  const role = (session?.user as any)?.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    
    // MFA Enforcement: If enabled but not verified, redirect to challenge
    const twoFactorVerified = (session as any)?.session?.twoFactorVerified;
    const isMfaPage = pathname.startsWith('/admin/security');

    if ((session.user as any)?.twoFactorEnabled && !twoFactorVerified && !isMfaPage) {
      router.replace('/admin/security/challenge');
      return;
    }

    if (!isAdmin) {
      router.replace('/browse');
    }
  }, [session, isPending, isAdmin, role, pathname, router]);

  if (isPending || !session || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Loader className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-bg)' }}>
      <aside
        className="w-64 border-r flex flex-col"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo.png" alt="At-Tayyibun" width={36} height={36} className="rounded-full" />
            <div>
              <div className="font-heading font-bold text-gradient-gold leading-tight">At-Tayyibun</div>
              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Admin Panel
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
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

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
