import Link from 'next/link';
import Image from 'next/image';
import { Heart, Shield, Users, Clock, ChevronRight, Star, Quote } from 'lucide-react';

const successStories = [
  {
    names: 'Abdullah & Mariam',
    location: 'New York, NY',
    quote: 'We connected through At-Tayyibun and our families were involved from day one. Alhamdulillah, we had our nikah within 6 months. The privacy-first approach gave us confidence throughout the process.',
    year: '2025',
  },
  {
    names: 'Yusuf & Aisha',
    location: 'Houston, TX',
    quote: 'My mother created my profile as my guardian. She felt comfortable knowing the platform was designed with Islamic values. We are now happily married with our families\' blessings.',
    year: '2025',
  },
  {
    names: 'Omar & Fatima',
    location: 'Chicago, IL',
    quote: 'What stood out was how respectful the process was. No endless chatting - just a contact request, family involvement, and a halal path to marriage. Jazakallahu Khairan to the At-Tayyibun team.',
    year: '2024',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
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
            </div>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/browse" className="text-gray-300 hover:text-white transition">
                Browse
              </Link>
              <Link href="/about" className="text-gray-300 hover:text-white transition">
                About
              </Link>
              <Link href="/login" className="text-gray-300 hover:text-white transition">
                Login
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get Started
              </Link>
            </div>

            {/* Mobile menu button */}
            <button className="md:hidden p-2 text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-dark" />
        <div className="absolute inset-0 bg-gradient-glow" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="animate-fade-in">
            {/* Quran Ayah */}
            <div className="mb-8 max-w-2xl mx-auto">
              <p className="text-gold-400 text-xl sm:text-2xl font-heading leading-relaxed mb-3" dir="rtl" lang="ar">
                &#1575;&#1604;&#1591;&#1617;&#1614;&#1610;&#1617;&#1616;&#1576;&#1614;&#1575;&#1578;&#1615; &#1604;&#1616;&#1604;&#1591;&#1617;&#1614;&#1610;&#1617;&#1616;&#1576;&#1616;&#1610;&#1606;&#1614; &#1608;&#1614;&#1575;&#1604;&#1591;&#1617;&#1614;&#1610;&#1617;&#1616;&#1576;&#1615;&#1608;&#1606;&#1614; &#1604;&#1616;&#1604;&#1591;&#1617;&#1614;&#1610;&#1617;&#1616;&#1576;&#1614;&#1575;&#1578;&#1616;
              </p>
              <p className="text-gray-300 text-sm sm:text-base italic">
                &ldquo;Good women are for good men, and good men are for good women.&rdquo;
              </p>
              <p className="text-gray-500 text-xs mt-1">
                — Surah An-Nur (24:26)
              </p>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Find Your{' '}
              <span className="text-gradient-gold">Righteous Spouse</span>
              <br />
              With Dignity & Privacy
            </h1>

            <p className="text-gray-400 text-lg sm:text-xl mb-8 max-w-2xl mx-auto">
              At-Tayyibun is a privacy-first matrimony platform designed for Muslims
              in the United States. Parents and guardians create profiles and connect
              on behalf of their families.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="btn-primary px-8 py-4 text-lg">
                Start Your Journey
                <ChevronRight className="w-5 h-5 ml-2" />
              </Link>
              <Link href="/browse" className="btn-secondary px-8 py-4 text-lg">
                Browse Profiles
              </Link>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 flex flex-wrap justify-center gap-8 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold-500" />
              <span>Privacy-First</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gold-500" />
              <span>Family Involvement</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold-500" />
              <span>Guardian-Led Connections</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              Why Choose <span className="text-gradient-gold">At-Tayyibun</span>?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              We designed every feature with Islamic values and your privacy in mind.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-6 text-center">
              <div className="w-16 h-16 bg-gold-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gold-500" />
              </div>
              <h3 className="font-heading text-xl font-semibold mb-3">Privacy Protected</h3>
              <p className="text-gray-400">
                Your real photos are private by default. Only you decide who sees them,
                with time-limited, expiring links.
              </p>
            </div>

            <div className="card p-6 text-center">
              <div className="w-16 h-16 bg-gold-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gold-500" />
              </div>
              <h3 className="font-heading text-xl font-semibold mb-3">Guardian-Led Process</h3>
              <p className="text-gray-400">
                Parents, guardians, or siblings create profiles and manage connections.
                Family involvement from the very first step.
              </p>
            </div>

            <div className="card p-6 text-center">
              <div className="w-16 h-16 bg-gold-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-gold-500" />
              </div>
              <h3 className="font-heading text-xl font-semibold mb-3">Halal-Oriented</h3>
              <p className="text-gray-400">
                Designed for nikah, not dating. Respectful communication focused
                on serious marriage intentions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-gradient-gold">Success Stories</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Alhamdulillah, families have found blessed unions through At-Tayyibun.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {successStories.map((story) => (
              <div key={story.names} className="card p-6 relative">
                <Quote className="w-8 h-8 text-gold-500/20 absolute top-4 right-4" />
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-gold-500 fill-gold-500" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">
                  &ldquo;{story.quote}&rdquo;
                </p>
                <div className="border-t border-white/10 pt-4">
                  <p className="font-semibold text-gold-400">{story.names}</p>
                  <p className="text-xs text-gray-500">{story.location} &middot; Married {story.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-surface">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-6">
            Begin Your Search Today
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Join families across the United States who have found
            their path to a blessed marriage through At-Tayyibun.
          </p>
          <Link href="/signup" className="btn-primary px-8 py-4 text-lg inline-flex">
            Create Free Account
            <ChevronRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="At-Tayyibun Logo"
                width={36}
                height={36}
                className="rounded-full"
              />
              <span className="font-heading font-semibold text-gradient-gold">At-Tayyibun</span>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
              <Link href="/about" className="hover:text-white transition">About</Link>
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
              <Link href="/contact" className="hover:text-white transition">Contact</Link>
            </div>

            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} At-Tayyibun. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
