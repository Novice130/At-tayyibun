'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, MapPin, Calendar, Shield, ArrowLeft, LogOut, Loader, Heart } from 'lucide-react';
import { api } from '@/lib/api';

interface UserProfile {
  id: string;
  publicId: string;
  email: string;
  profile: {
    firstName: string;
    gender: string;
    city: string;
    state: string;
    ethnicity: string;
    occupation?: string;
    aboutMe?: string;
  }
  membershipTier: string;
  isVerified: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await api.get('/profiles/me');
      setUser(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      // If unauthorized, redirect to login
      if ((err as any).statusCode === 401) {
        router.push('/login');
      } else {
        setError('Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

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
                 <ArrowLeft className="w-4 h-4" /> Back to Browse
               </Link>
               <button onClick={handleLogout} className="text-red-400 hover:text-red-300">
                 <LogOut className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 pt-24">
        {error ? (
          <div className="text-center text-red-500 p-8">{error}</div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="card p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="w-24 h-24 bg-gradient-gold rounded-full flex items-center justify-center text-black font-bold text-3xl">
                {user?.profile?.firstName?.[0] || <User className="w-12 h-12" />}
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="font-heading text-3xl font-bold mb-2 flex items-center justify-center md:justify-start gap-2">
                  {user?.profile?.firstName}
                  {user?.isVerified && <Shield className="w-5 h-5 text-green-500" />}
                </h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 text-gray-400">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {user?.profile?.city}, {user?.profile?.state}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {user?.profile?.ethnicity}
                  </div>
                  {user?.membershipTier !== 'FREE' && (
                     <div className="flex items-center gap-1 text-gold-400">
                       <Heart className="w-4 h-4" />
                       {user?.membershipTier} Member
                     </div>
                  )}
                </div>
              </div>
              <button className="btn-secondary">Edit Profile</button>
            </div>

            {/* About Section */}
            <div className="card p-8">
              <h2 className="font-heading text-xl font-bold mb-4">About Me</h2>
              <p className="text-gray-300 leading-relaxed">
                {user?.profile?.aboutMe || "No bio added yet."}
              </p>
            </div>

            {/* Details Section */}
             <div className="card p-8">
              <h2 className="font-heading text-xl font-bold mb-4">Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                   <label className="text-xs text-gray-500 uppercase">Gender</label>
                   <p className="font-medium">{user?.profile?.gender}</p>
                </div>
                <div>
                   <label className="text-xs text-gray-500 uppercase">Ethnicity</label>
                   <p className="font-medium">{user?.profile?.ethnicity}</p>
                </div>
                <div>
                   <label className="text-xs text-gray-500 uppercase">Public ID</label>
                   <p className="font-medium font-mono text-gold-400">{user?.publicId}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
