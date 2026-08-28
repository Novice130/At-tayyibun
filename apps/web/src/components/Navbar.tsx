'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  User, LogOut, Menu, X, Shield,
  Home, Search, Inbox, ChevronDown
} from 'lucide-react';
import { useSession, signOut } from '@/lib/auth-client';
import { useIncomingRequestCount } from '@/lib/hooks';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const { count: pendingRequests } = useIncomingRequestCount();

  useEffect(() => {
    if (!userMenuOpen) return;
    const onScroll = () => setUserMenuOpen(false);
    const onClickOutside = (e: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserMenuOpen(false); };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const user = session?.user as any;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const navLinks = [
    { href: '/browse', label: 'Browse', icon: Search },
    { href: '/requests', label: 'Requests', icon: Inbox },
  ];

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={session ? "/browse" : "/"} className="flex items-center gap-2 group transition-transform hover:scale-105 active:scale-95">
            <Image
              src="/at-tayyibun-logo.png"
              alt="At-Tayyibun Logo"
              width={36}
              height={36}
              className="rounded-full shadow-lg shadow-gold-500/20"
            />
            <span className="font-heading font-bold text-gradient-gold hidden sm:block">At-Tayyibun</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-6">
              {session && navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                const badge = link.href === '/requests' ? pendingRequests : 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm font-medium transition-colors hover:text-gold-500 flex items-center gap-1.5 ${
                      isActive ? 'text-gold-500' : 'text-secondary'
                    }`}
                  >
                    {isActive && <Icon className="w-4 h-4" />}
                    {link.label}
                    {badge > 0 && (
                      <span
                        className="ml-0.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold leading-none"
                        aria-label={`${badge} pending request${badge === 1 ? '' : 's'}`}
                      >
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              {!session && !isPending && (
                <>
                  <Link href="/" className="text-sm font-medium hover:text-gold-500 text-secondary">Home</Link>
                  <Link href="/browse" className="text-sm font-medium hover:text-gold-500 text-secondary">Browse</Link>
                  <Link href="/about" className="text-sm font-medium hover:text-gold-500 text-secondary">About</Link>
                </>
              )}
              {isAdmin && (
                <Link 
                  href="/admin" 
                  className={`text-sm font-medium transition-colors hover:text-gold-500 flex items-center gap-1.5 ${
                    pathname.startsWith('/admin') ? 'text-gold-500' : 'text-gold-400'
                  }`}
                >
                  <Shield className="w-4 h-4" /> Admin
                </Link>
              )}
            </div>

            <div className="flex items-center gap-3 pl-6 border-l border-border/50">
              <ThemeToggle />
              
              {session ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-hover transition-all border border-transparent hover:border-border"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-gold p-0.5 shadow-lg shadow-gold-500/10">
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: 'var(--color-surface)' }}
                      >
                        {user?.image ? (
                          <img src={user.image} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-gold-500" />
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-secondary transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <>
                      <div
                        className="absolute right-0 mt-2 w-56 rounded-2xl border shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        <div className="p-4 border-b border-border">
                          <p className="font-bold truncate">{user?.name || 'User'}</p>
                          <p className="text-xs text-secondary truncate">{user?.email}</p>
                        </div>
                        <div className="p-2">
                          <Link 
                            href="/profile" 
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors text-sm font-medium"
                          >
                            <User className="w-4 h-4 text-gold-500" /> My Profile
                          </Link>
                          <button 
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors text-sm font-medium"
                          >
                            <LogOut className="w-4 h-4" /> Logout
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/login" className="text-sm font-medium text-secondary hover:text-gold-500 transition-colors">
                    Login
                  </Link>
                  <Link href="/signup" className="btn-primary text-xs px-4 py-2">
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-4">
            <ThemeToggle />
            <button
              className="relative min-w-11 min-h-11 flex items-center justify-center rounded-xl bg-surface-hover border border-border transition-transform active:scale-95"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              {/* Surface pending requests without needing the menu open */}
              {session && pendingRequests > 0 && !mobileMenuOpen && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[var(--color-bg)]" />
              )}
            </button>
          </div>
        </div>
      </div>
      </nav>

      {/* Mobile menu.
          Rendered as a sibling of <nav>, not inside it: the nav carries the
          `glass` class, whose backdrop-filter makes it a containing block for
          fixed-position descendants. Nested here, `fixed inset-0` was being
          clipped to the navbar's own box, so the dim overlay covered only the
          top strip and the page showed straight through the menu. */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-16 left-4 right-4 z-[70] md:hidden animate-in slide-in-from-top-4 duration-300">
            <div
              className="p-4 rounded-3xl shadow-2xl space-y-2 border max-h-[calc(100vh-5.5rem)] overflow-y-auto"
              // Explicit colours: `bg-surface-secondary` is not a real class —
              // it exists in neither globals.css nor the Tailwind palette, so the
              // panel was rendering fully transparent.
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              {session && navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                const badge = link.href === '/requests' ? pendingRequests : 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                      isActive ? 'bg-gold-500/10 text-gold-500 font-bold' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                    {badge > 0 && (
                      <span
                        className="ml-auto min-w-6 h-6 px-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold leading-none"
                        aria-label={`${badge} pending request${badge === 1 ? '' : 's'}`}
                      >
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              {!session && (
                <>
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-hover transition-all"
                  >
                    <Home className="w-5 h-5" /> Home
                  </Link>
                  <Link
                    href="/browse"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-hover transition-all"
                  >
                    <Search className="w-5 h-5" /> Browse
                  </Link>
                  <Link
                    href="/about"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-hover transition-all"
                  >
                    <User className="w-5 h-5" /> About
                  </Link>
                </>
              )}
              {isAdmin && (
                <Link 
                  href="/admin" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-gold-400 hover:bg-gold-500/10 transition-all font-medium"
                >
                  <Shield className="w-5 h-5" /> Admin Dashboard
                </Link>
              )}
              <div className="pt-2 border-t border-border mt-2">
                {session ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-hover transition-all"
                    >
                      <User className="w-5 h-5 text-gold-500" /> My Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all font-medium"
                    >
                      <LogOut className="w-5 h-5" /> Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-hover transition-all"
                    >
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className="btn-primary w-full justify-center mt-2"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
