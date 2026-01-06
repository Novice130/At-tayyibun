'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, Users, Shield, Clock, ChevronRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="At-Tayyibun Logo"
                width={44}
                height={44}
                className="rounded-full"
              />
              <span className="font-heading font-bold text-xl text-gradient-gold">
                At-Tayyibun
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/browse" className="text-gray-300 hover:text-white transition">
                Browse
              </Link>
              <Link href="/about" className="text-gold-400">
                About
              </Link>
              <Link href="/login" className="text-gray-300 hover:text-white transition">
                Login
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-6">
            About <span className="text-gradient-gold">At-Tayyibun</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A privacy-first, halal-oriented matrimony platform designed for Muslims 
            in the United States seeking a blessed marriage.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-surface">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold mb-4">Our Mission</h2>
            <p className="text-gray-400">
              We believe finding a spouse should be dignified, private, and respectful. 
              At-Tayyibun was created to provide a halal alternative to mainstream dating 
              apps, with Islamic values at its core.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="card p-6">
              <Shield className="w-10 h-10 text-gold-500 mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Privacy First</h3>
              <p className="text-gray-400">
                Your photos remain private by default. Only you decide who can see them, 
                through time-limited, expiring links.
              </p>
            </div>
            <div className="card p-6">
              <Users className="w-10 h-10 text-gold-500 mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Verified Users</h3>
              <p className="text-gray-400">
                Every user must verify their phone number, ensuring one account per person 
                and authentic connections.
              </p>
            </div>
            <div className="card p-6">
              <Heart className="w-10 h-10 text-gold-500 mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Marriage Focused</h3>
              <p className="text-gray-400">
                Built for nikah, not dating. Our platform encourages respectful communication 
                with serious marriage intentions.
              </p>
            </div>
            <div className="card p-6">
              <Clock className="w-10 h-10 text-gold-500 mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Safe Information Sharing</h3>
              <p className="text-gray-400">
                When you share your information, it's time-limited and expires automatically, 
                keeping you in control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="font-heading text-2xl font-bold mb-4">Ready to Begin?</h2>
          <p className="text-gray-400 mb-6">
            Join thousands of Muslims who trust At-Tayyibun to help them find their spouse.
          </p>
          <Link href="/signup" className="btn-primary px-8 py-4 inline-flex">
            Create Free Account
            <ChevronRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} At-Tayyibun. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
