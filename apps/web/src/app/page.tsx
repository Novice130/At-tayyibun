import Link from 'next/link';
import Image from 'next/image';
import { Heart, Shield, Users, Clock, ChevronRight, Star, Quote, Lock, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

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

const features = [
  {
    icon: Shield,
    title: 'Privacy Sanctuary',
    description: 'Your real photos are private by default. Only you decide who sees them, with time-limited, expiring links.',
  },
  {
    icon: Users,
    title: 'Guardian-Led Process',
    description: 'Parents, guardians, or siblings create profiles and manage connections. Family involvement from the very first step.',
  },
  {
    icon: Heart,
    title: 'Halal-Oriented',
    description: 'Designed for nikah, not dating. Respectful communication focused on serious marriage intentions.',
  },
  {
    icon: Lock,
    title: 'Data Encrypted',
    description: 'All sensitive data encrypted at rest. Your personal information is secured with military-grade encryption.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* ============ NAVIGATION ============ */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="At-Tayyibun Logo"
                width={40}
                height={40}
                className="rounded-full"
              />
              <span className="font-heading font-bold text-xl text-gradient-gold">
                At-Tayyibun
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--color-gold-500)' }}>
                Home
              </Link>
              <Link href="/browse" className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                Matches
              </Link>
              <Link href="/about" className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                Wisdom
              </Link>
              <ThemeToggle />
              <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Login
              </Link>
              <Link href="/signup" className="btn-primary text-sm px-5 py-2">
                Get Started
              </Link>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <Link href="/login" className="text-sm font-medium px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                Login
              </Link>
              <Link href="/signup" className="btn-primary text-sm px-4 py-2">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ============ HERO SECTION ============ */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Light mode: warm gradient. Dark mode: original dark gradient */}
        <div className="absolute inset-0 dark:bg-gradient-dark" style={{ background: 'var(--color-bg)' }} />
        <div className="absolute inset-0 dark:bg-gradient-glow" />

        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-72 h-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--color-gold-500) 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-20 left-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--color-gold-500) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="animate-fade-in">
              {/* Quranic Ayah */}
              <div className="mb-8 inline-block">
                <div className="card px-6 py-4 border-l-4" style={{ borderLeftColor: 'var(--color-gold-500)' }}>
                  <p className="text-xl sm:text-2xl font-serif leading-relaxed mb-2" dir="rtl" lang="ar" style={{ color: 'var(--color-gold-500)' }}>
                    &#1575;&#1604;&#1591;&#1617;&#1614;&#1610;&#1617;&#1616;&#1576;&#1614;&#1575;&#1578;&#1615; &#1604;&#1616;&#1604;&#1591;&#1617;&#1614;&#1610;&#1617;&#1616;&#1576;&#1616;&#1610;&#1606;&#1614; &#1608;&#1614;&#1575;&#1604;&#1591;&#1617;&#1614;&#1610;&#1617;&#1616;&#1576;&#1615;&#1608;&#1606;&#1614; &#1604;&#1616;&#1604;&#1591;&#1617;&#1614;&#1610;&#1617;&#1616;&#1576;&#1614;&#1575;&#1578;&#1616;
                  </p>
                  <p className="text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>
                    &ldquo;Good women are for good men, and good men are for good women.&rdquo;
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    — Surah An-Nur (24:26)
                  </p>
                </div>
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight" style={{ color: 'var(--color-text)' }}>
                Find Your{' '}
                <span className="font-serif italic text-gradient-gold">Half,</span>
                <br />
                Preserving Sacred Values
              </h1>

              <p className="text-lg sm:text-xl mb-8 max-w-xl leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                At-Tayyibun is a privacy-first matrimony platform designed for Muslims
                in the United States. Parents and guardians create profiles and connect
                on behalf of their families.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup" className="btn-primary px-8 py-4 text-lg">
                  Start Your Journey
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Link>
                <Link href="/browse" className="btn-secondary px-8 py-4 text-lg">
                  Browse Profiles
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="mt-10 flex flex-wrap gap-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" style={{ color: 'var(--color-gold-500)' }} />
                  <span>Privacy-First</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: 'var(--color-gold-500)' }} />
                  <span>Family Involvement</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: 'var(--color-gold-500)' }} />
                  <span>Guardian-Led</span>
                </div>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div className="hidden lg:flex justify-center animate-slide-up">
              <div className="relative w-96 h-96">
                {/* Decorative ring */}
                <div className="absolute inset-0 rounded-full animate-pulse-gold"
                  style={{ border: '2px solid var(--color-gold-500)', opacity: 0.3 }}
                />
                <div className="absolute inset-4 rounded-full overflow-hidden shadow-gold">
                  <Image
                    src="/hero-couple.png"
                    alt="Muslim couple illustration"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 card px-4 py-2 flex items-center gap-2 shadow-soft">
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--color-gold-500)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Halal Connections</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES SECTION ============ */}
      <section className="py-24" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--color-gold-500)' }}>
              Why At-Tayyibun
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
              Built on <span className="text-gradient-gold">Sacred Principles</span>
            </h2>
            <p className="max-w-2xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              Every feature designed with Islamic values and your privacy at its core.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card p-6 text-center group hover:border-gold-500/30 transition-all duration-300">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors"
                  style={{ backgroundColor: 'var(--color-gold-100)' }}
                >
                  <f.icon className="w-7 h-7" style={{ color: 'var(--color-gold-500)' }} />
                </div>
                <h3 className="font-heading text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--color-gold-500)' }}>
              Simple & Respectful
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold" style={{ color: 'var(--color-text)' }}>
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create Profile', desc: 'You or your guardian signs up and creates a profile with basic information and a cartoon avatar.' },
              { step: '02', title: 'Browse & Connect', desc: 'Browse profiles. Found someone compatible? Send a contact request through the platform.' },
              { step: '03', title: 'Families Connect', desc: 'Once approved, guardian contact info is shared via secure email. Families take it from there.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-5xl font-heading font-bold mb-4 text-gradient-gold opacity-60">{item.step}</div>
                <h3 className="font-heading text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SUCCESS STORIES ============ */}
      <section className="py-24" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--color-gold-500)' }}>
              Blessed Unions
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
              <span className="text-gradient-gold">Success Stories</span>
            </h2>
            <p className="max-w-2xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              Alhamdulillah, families have found blessed unions through At-Tayyibun.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {successStories.map((story) => (
              <div key={story.names} className="card p-6 relative">
                <Quote className="w-8 h-8 absolute top-4 right-4 opacity-10" style={{ color: 'var(--color-gold-500)' }} />
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" style={{ color: 'var(--color-gold-500)' }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                  &ldquo;{story.quote}&rdquo;
                </p>
                <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <p className="font-semibold" style={{ color: 'var(--color-gold-500)' }}>{story.names}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{story.location} &middot; Married {story.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA SECTION ============ */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>
            Begin Your Search Today
          </h2>
          <p className="mb-8 max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            Join families across the United States who have found
            their path to a blessed marriage through At-Tayyibun.
          </p>
          <Link href="/signup" className="btn-primary px-8 py-4 text-lg inline-flex">
            Create Free Account
            <ChevronRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-12" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 items-center">
            {/* Logo */}
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

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <Link href="/about" className="hover:opacity-80 transition">Our Story</Link>
              <Link href="/privacy" className="hover:opacity-80 transition">Privacy Sanctuary</Link>
              <Link href="/terms" className="hover:opacity-80 transition">Terms of Union</Link>
              <Link href="/contact" className="hover:opacity-80 transition">Support</Link>
            </div>

            {/* Copyright */}
            <p className="text-sm text-right" style={{ color: 'var(--color-text-muted)' }}>
              &copy; {new Date().getFullYear()} At-Tayyibun. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
