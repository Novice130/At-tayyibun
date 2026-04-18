'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function MessagesPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 pt-24">
        <h1 className="font-heading text-2xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>Messages</h1>
        
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-gold-100)' }}>
            <MessageSquare className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>No messages yet</h2>
          <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            Connect with other members to start a conversation. Messages are private and secure.
          </p>
          <Link href="/browse" className="btn-primary inline-block">
            Find Matches
          </Link>
        </div>
      </main>
    </div>
  );
}
