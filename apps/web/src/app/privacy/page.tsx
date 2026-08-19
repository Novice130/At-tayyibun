'use client';

import { Shield, Lock, EyeOff, FileKey } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-6 text-center">
            Privacy <span className="text-gradient-gold">Sanctuary</span>
          </h1>
          <p className="text-secondary text-center mb-12">
            Your privacy is the foundation of At-Tayyibun. Here is how we protect it.
          </p>

          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <EyeOff className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Photos stay private</h2>
              </div>
              <p className="text-secondary">
                Your photos are hidden from browsing by default. They are only shared
                through time-limited, expiring links when you approve a contact request.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Encrypted personal data</h2>
              </div>
              <p className="text-secondary">
                Sensitive profile fields — last name, bio, and biodata — are encrypted
                at rest. They are decrypted only for the people you explicitly approve.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <FileKey className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">One-time contact sharing</h2>
              </div>
              <p className="text-secondary">
                When you approve a request, your contact details are shared through a
                single-use link that expires. They cannot be re-fetched afterwards.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">No public profile browsing of your data</h2>
              </div>
              <p className="text-secondary">
                Only the fields you complete for your public profile are visible to other
                members. Everything else stays between you and those you approve.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
