import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 via-transparent to-gold-500/10" />
          <div className="relative max-w-6xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 animate-in">
              Find Your{' '}
              <span className="text-gradient">Life Partner</span>
              <br />
              The Halal Way
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8 animate-in">
              At-Tayyibun is a privacy-first matrimony platform designed for Muslims 
              in the United States. Connect with practicing Muslims who share your values.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in">
              <Link href="/signup" className="btn-primary text-lg px-8 py-3">
                Start Your Journey
              </Link>
              <Link href="/browse" className="btn-outline text-lg px-8 py-3">
                Browse Profiles
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 bg-white/50 dark:bg-gray-900/50">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12">
              Why Choose <span className="text-gradient">At-Tayyibun</span>?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: '🔒',
                  title: 'Privacy First',
                  description: 'Your real photos are private by default. Share only with people you trust, with your explicit consent.',
                },
                {
                  icon: '✨',
                  title: 'AI Avatars',
                  description: 'Unique AI-generated avatars protect your identity while allowing others to see a representation of you.',
                },
                {
                  icon: '💍',
                  title: 'Marriage Focused',
                  description: 'This is not a dating app. We focus on serious, halal connections leading to nikah.',
                },
              ].map((feature, index) => (
                <div key={index} className="card text-center">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12">
              How It Works
            </h2>
            <div className="space-y-8">
              {[
                { step: 1, title: 'Create Your Profile', description: 'Sign up with your phone number and build your profile with confidence.' },
                { step: 2, title: 'Browse Safely', description: 'View profiles with AI avatars. Filter by ethnicity, location, and more.' },
                { step: 3, title: 'Request to Connect', description: 'When interested, request to see real photos and contact information.' },
                { step: 4, title: 'Connect & Communicate', description: 'Once approved, connect via email with secure, expiring links.' },
              ].map((item) => (
                <div key={item.step} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-lg">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold mb-1">{item.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Ready to Find Your Spouse?
            </h2>
            <p className="text-lg text-primary-100 mb-8">
              Join thousands of Muslims who have found meaningful connections through At-Tayyibun.
            </p>
            <Link href="/signup" className="btn bg-white text-primary-700 hover:bg-gray-100 text-lg px-8 py-3">
              Create Free Account
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
