'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { api } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    phone: '',
    password: '',
    gender: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/signup', formData);
      setSuccess(true);
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="font-heading text-3xl font-bold mb-4">Verify Your Email</h1>
          <p className="text-gray-300 mb-8">
            We've sent a verification link to <strong>{formData.email}</strong>. 
            Please check your inbox (and spam folder) to complete your registration.
          </p>
          
          <div className="bg-surface border border-white/10 rounded-lg p-4 mb-8 text-left">
            <h3 className="font-bold text-gold-400 mb-1 text-sm">DEVELOPER NOTE:</h3>
            <p className="text-sm text-gray-400">
              Since email sending is currently simulated, please check your 
              <strong> API Terminal Console</strong> for the verification link.
            </p>
          </div>

          <Link href="/login" className="btn-secondary inline-block">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-gold rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-black" />
              </div>
              <span className="font-heading font-bold text-xl text-gradient-gold">At-Tayyibun</span>
            </Link>
            <h1 className="font-heading text-2xl font-bold mb-2">Create Your Account</h1>
            <p className="text-gray-400">Begin your journey to finding a righteous spouse</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium mb-2">First Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  required
                  className="input pl-10"
                  placeholder="Your first name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  required
                  className="input pl-10"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number (US)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="tel"
                  required
                  className="input pl-10"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">We&apos;ll send a verification code</p>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium mb-2">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'MALE' })}
                  className={`p-3 rounded-lg border transition ${
                    formData.gender === 'MALE'
                      ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  Brother
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'FEMALE' })}
                  className={`p-3 rounded-lg border transition ${
                    formData.gender === 'FEMALE'
                      ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  Sister
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  className="input pl-10 pr-10"
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Include uppercase, lowercase, number, and special character
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !formData.gender}
              className="btn-primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* OAuth */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button className="btn-secondary py-3">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button className="btn-secondary py-3">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            Already have an account?{' '}
            <Link href="/login" className="text-gold-400 hover:text-gold-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image/Info (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-gradient-purple items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-24 h-24 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <Heart className="w-12 h-12 text-gold-400" />
          </div>
          <h2 className="font-heading text-3xl font-bold mb-4">
            Your Journey to a Blessed Marriage
          </h2>
          <p className="text-gray-300">
            At-Tayyibun provides a respectful, privacy-conscious environment 
            for Muslims seeking marriage. Your data is encrypted, your photos 
            are protected, and your privacy is our priority.
          </p>
        </div>
      </div>
    </div>
  );
}
