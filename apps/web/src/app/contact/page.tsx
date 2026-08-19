'use client';

import { Mail, MessageCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-6">
            Support <span className="text-gradient-gold">Desk</span>
          </h1>
          <p className="text-secondary mb-12 max-w-lg mx-auto">
            Questions, feedback, or a concern about your account? We are here to help.
          </p>

          <div className="card p-8 space-y-4">
            <div className="flex items-center justify-center gap-2 text-secondary">
              <MessageCircle className="w-5 h-5 text-gold-500" />
              Reach us directly at
            </div>
            <a
              href="mailto:support@attayyibun.com?subject=At-Tayyibun%20Support"
              className="btn-primary inline-flex items-center gap-2"
            >
              <Mail className="w-5 h-5" /> support@attayyibun.com
            </a>
            <p className="text-muted text-sm">
              We typically respond within one business day, inshaAllah.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
