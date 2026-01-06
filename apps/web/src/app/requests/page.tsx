'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Users, ArrowLeft } from 'lucide-react';

export default function RequestsPage() {
  return (
    <div className="min-h-screen bg-background pb-12">
       {/* Navigation */}
       <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/browse" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="At-Tayyibun Logo"
                width={36}
                height={36}
                className="rounded-full"
              />
              <span className="font-heading font-bold text-gradient-gold hidden sm:block">At-Tayyibun</span>
            </Link>
            <div className="flex items-center gap-4">
               <Link href="/browse" className="btn-secondary text-sm flex items-center gap-2">
                 <ArrowLeft className="w-4 h-4" /> Back
               </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 pt-24">
        <h1 className="font-heading text-2xl font-bold mb-6">Connection Requests</h1>
        
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No requests pending</h2>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            When someone wants to connect with you, their request will appear here.
          </p>
          <Link href="/browse" className="btn-primary inline-block">
            Browse Profiles
          </Link>
        </div>
      </main>
    </div>
  );
}
