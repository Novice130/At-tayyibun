'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, Users, Shield, Clock, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-6">
            About <span className="text-gradient-gold">At-Tayyibun</span>
          </h1>
          <p className="text-secondary text-lg max-w-2xl mx-auto">
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
            <p className="text-secondary">
              We believe finding a spouse should be dignified, private, and respectful. 
              At-Tayyibun was created to provide a halal alternative to mainstream dating 
              apps, with Islamic values at its core.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="card p-6">
              <Shield className="w-10 h-10 text-gold-500 mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Privacy First</h3>
              <p className="text-secondary">
                Your photos remain private by default. Only you decide who can see them, 
                through time-limited, expiring links.
              </p>
            </div>
            <div className="card p-6">
              <Users className="w-10 h-10 text-gold-500 mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Verified Users</h3>
              <p className="text-secondary">
                Every user must verify their phone number, ensuring one account per person 
                and authentic connections.
              </p>
            </div>
            <div className="card p-6">
              <Heart className="w-10 h-10 text-gold-500 mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Marriage Focused</h3>
              <p className="text-secondary">
                Built for nikah, not dating. Our platform encourages respectful communication 
                with serious marriage intentions.
              </p>
            </div>
            <div className="card p-6">
              <Clock className="w-10 h-10 text-gold-500 mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Safe Information Sharing</h3>
              <p className="text-secondary">
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
          <p className="text-secondary mb-6">
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
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted">
          © {new Date().getFullYear()} At-Tayyibun. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
