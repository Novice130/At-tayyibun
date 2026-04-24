'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { 
  User, LogOut, Menu, X, MessageSquare, Bell, Shield, 
  Home, Search, Inbox, ChevronDown 
} from 'lucide-react';
import { useSession, signOut } from '@/lib/auth-client';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const user = session?.user as any;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/browse', label: 'Browse', icon: Search },
    { href: '/requests', label: 'Requests', icon: Inbox },
    { href: '/messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group transition-transform hover:scale-105 active:scale-95">
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
                  </Link>
                );
              })}
              {!session && (
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
                <div className="relative">
                  <button 
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-hover transition-all border border-transparent hover:border-border"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-gold p-0.5 shadow-lg shadow-gold-500/10">
                      <div className="w-full h-full rounded-full bg-surface-secondary flex items-center justify-center overflow-hidden">
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
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface-secondary border border-border shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
              className="p-2 rounded-xl bg-surface-hover border border-border transition-transform active:scale-95"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-16 left-4 right-4 z-50 md:hidden animate-in slide-in-from-top-4 duration-300">
            <div className="p-4 rounded-3xl bg-surface-secondary border border-border shadow-2xl space-y-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
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
                  </Link>
                );
              })}
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
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
