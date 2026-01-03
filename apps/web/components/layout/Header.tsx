'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌙</span>
            <span className="font-display text-xl font-bold text-gradient">At-Tayyibun</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/browse" className="text-gray-600 hover:text-primary-600 transition-colors">
              Browse
            </Link>
            <Link href="/pricing" className="text-gray-600 hover:text-primary-600 transition-colors">
              Pricing
            </Link>
            <Link href="/about" className="text-gray-600 hover:text-primary-600 transition-colors">
              About
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <Link href="/app/browse" className="btn-primary">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">
                  Log In
                </Link>
                <Link href="/signup" className="btn-primary">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav className="md:hidden py-4 border-t mt-3 animate-in">
            <div className="flex flex-col gap-4">
              <Link href="/browse" className="text-gray-600 hover:text-primary-600">Browse</Link>
              <Link href="/pricing" className="text-gray-600 hover:text-primary-600">Pricing</Link>
              <Link href="/about" className="text-gray-600 hover:text-primary-600">About</Link>
              <hr className="my-2" />
              {user ? (
                <Link href="/app/browse" className="btn-primary text-center">Dashboard</Link>
              ) : (
                <>
                  <Link href="/login" className="btn-outline text-center">Log In</Link>
                  <Link href="/signup" className="btn-primary text-center">Sign Up</Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
