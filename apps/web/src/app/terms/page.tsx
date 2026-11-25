'use client';

import {
  ScrollText, HeartHandshake, UserCheck, Ban, CalendarCheck, Users, Gavel, Scale, Mail,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LEGAL } from '@/lib/legal';

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-6 text-center">
            Terms of <span className="text-gradient-gold">Union</span>
          </h1>
          <p className="text-secondary text-center mb-4">
            Our Terms of Use: the commitments every member makes when they join At-Tayyibun.
          </p>
          <p className="text-muted text-sm text-center mb-12">Effective {LEGAL.effectiveDate}</p>

          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <CalendarCheck className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Who can join</h2>
              </div>
              <p className="text-secondary">
                Members must be 18 or older and not currently married. If you create a profile
                for a family member, you confirm that they meet these requirements and have agreed
                to the profile.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <ScrollText className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Marriage intent only</h2>
              </div>
              <p className="text-secondary">
                At-Tayyibun exists for those seeking marriage (nikah, the Islamic marriage
                contract). Creating a profile for casual dating or inappropriate purposes may
                result in suspension or removal.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <UserCheck className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Accurate information</h2>
              </div>
              <p className="text-secondary">
                You agree to provide truthful information about yourself, including your age,
                marital history, and intentions. Misrepresentation may result in suspension or
                removal.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <HeartHandshake className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Respectful conduct</h2>
              </div>
              <p className="text-secondary">
                All communication through the platform must be respectful and halal. Harassment,
                pressure, or inappropriate content may result in suspension or removal.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Ban className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Contact sharing</h2>
              </div>
              <p className="text-secondary">
                Do not attempt to extract contact information before a request is accepted.
                Contact sharing flows through the platform by design. Trying to get around this
                may result in suspension or removal.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Guardian details</h2>
              </div>
              <p className="text-secondary">
                If you add a guardian&apos;s contact details, you confirm that the guardian has
                agreed to them being stored and shared when you choose to share them.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Gavel className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Suspension and removal</h2>
              </div>
              <div className="text-secondary space-y-3">
                <p>
                  Members can report a profile, and our team reviews reports. A suspended account
                  cannot use the service and its profile is hidden from other members until the
                  suspension is lifted. A removed account is permanently deleted.
                </p>
                <p>
                  You can delete your own account at any time from your profile page, even while
                  suspended. To question a decision, email us.
                </p>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Scale className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Limits of our responsibility</h2>
              </div>
              <div className="text-secondary space-y-3">
                <p>
                  At-Tayyibun introduces families. It does not arrange marriages, and it cannot
                  guarantee a match or confirm everything members say about themselves. Please
                  make your own inquiries before any commitment.
                </p>
                <p>
                  The service is provided as is. To the fullest extent the law allows,{' '}
                  {LEGAL.operator} is not liable for indirect or consequential losses, or for the
                  conduct of members on or off the platform.
                </p>
                <p>These terms are governed by the laws of the State of {LEGAL.governingState}.</p>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Mail className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Contact us</h2>
              </div>
              <p className="text-secondary">
                {LEGAL.operatorDescription}, runs this service. For legal questions, email{' '}
                <a href={`mailto:${LEGAL.contactEmail}`} className="text-gold-400 underline">
                  {LEGAL.contactEmail}
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
