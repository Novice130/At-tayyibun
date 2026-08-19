'use client';

import { ScrollText, HeartHandshake, UserCheck, Ban } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-6 text-center">
            Terms of <span className="text-gradient-gold">Union</span>
          </h1>
          <p className="text-secondary text-center mb-12">
            The commitments every member makes when they join At-Tayyibun.
          </p>

          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <ScrollText className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Marriage intent only</h2>
              </div>
              <p className="text-secondary">
                At-Tayyibun exists for those seeking marriage (nikah). Profiles created
                for casual dating or inappropriate purposes will be removed.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <UserCheck className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Accurate information</h2>
              </div>
              <p className="text-secondary">
                You agree to provide truthful information about yourself, including your
                age, marital history, and intentions. Misrepresentation may result in
                account suspension.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <HeartHandshake className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Respectful conduct</h2>
              </div>
              <p className="text-secondary">
                All communication through the platform must be respectful and halal.
                Harassment, pressure, or inappropriate content is grounds for removal.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Ban className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">No off-platform solicitation</h2>
              </div>
              <p className="text-secondary">
                Do not attempt to extract contact information before a request is
                approved. Contact sharing flows through the platform by design.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
