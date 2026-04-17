'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Eye, EyeOff, Mail, Lock, User, Phone, ChevronLeft, Users } from 'lucide-react';
import { signUp } from '@/lib/auth-client';

const MALE_AVATARS = Array.from({ length: 12 }, (_, i) => `/avatars/male/male-${i + 1}.jpg`);
const FEMALE_AVATARS = Array.from({ length: 12 }, (_, i) => `/avatars/female/female-${i + 1}.jpg`);

type CreatorRole = 'SELF' | 'BROTHER' | 'SISTER' | 'GUARDIAN';
type GuardianContactType = 'MOTHER' | 'FATHER' | 'RELATIVE' | 'GUARDIAN' | 'OTHER';

const creatorRoleLabels: Record<CreatorRole, string> = {
  SELF: 'Myself',
  BROTHER: 'I am their Brother',
  SISTER: 'I am their Sister',
  GUARDIAN: 'I am their Guardian',
};

const guardianContactLabels: Record<GuardianContactType, string> = {
  MOTHER: 'Mother',
  FATHER: 'Father',
  RELATIVE: 'Relative',
  GUARDIAN: 'Guardian',
  OTHER: 'Other',
};

export default function SignupForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'role' | 'form' | 'guardian' | 'avatar'>('role');
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    phone: '',
    password: '',
    gender: '',
    avatar: '',
    creatorRole: '' as CreatorRole | '',
    guardianContactType: '' as GuardianContactType | '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
  });

  const handleRoleSelect = (role: CreatorRole) => {
    setFormData({ ...formData, creatorRole: role });
    setStep('form');
  };

  const handleFormNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.gender) {
      setError('Please select the gender of the person this profile is for.');
      return;
    }
    // If creating for someone else, need guardian contact info
    if (formData.creatorRole !== 'SELF') {
      setStep('guardian');
    } else {
      setStep('avatar');
    }
  };

  const handleGuardianNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.guardianContactType) {
      setError('Please select who the contact person is.');
      return;
    }
    if (!formData.guardianName) {
      setError('Please enter the contact person\'s name.');
      return;
    }
    if (!formData.guardianPhone) {
      setError('Please enter a contact phone number.');
      return;
    }
    setStep('avatar');
  };

  const handleSubmit = async () => {
    if (!formData.avatar) {
      setError('Please choose an avatar.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const { data, error: authError } = await signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.firstName,
        image: formData.avatar,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      setSuccess(true);
      setTimeout(() => router.push('/browse'), 2000);
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="font-heading text-3xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Account Created!</h1>
          <p className="mb-8" style={{ color: 'var(--color-text-secondary)' }}>
            Welcome! Redirecting you to browse profiles...
          </p>
          <Link href="/browse" className="btn-primary inline-block">
            Go to Browse
          </Link>
        </div>
      </div>
    );
  }

  // --- Step 1: Creator Role Selection ---
  if (step === 'role') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-gold rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-black" />
              </div>
              <span className="font-heading font-bold text-xl text-gradient-gold">At-Tayyibun</span>
            </Link>
            <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>I am creating this profile as...</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Parents, guardians, and siblings are welcome to create profiles on behalf of their family member.
            </p>
          </div>

          <div className="space-y-3">
            {(Object.entries(creatorRoleLabels) as [CreatorRole, string][]).map(([role, label]) => (
              <button
                key={role}
                onClick={() => handleRoleSelect(role)}
                className="w-full card p-5 text-left hover:border-gold-500/50 transition flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-gold-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                  {role === 'SELF' ? (
                    <User className="w-6 h-6 text-gold-500" />
                  ) : (
                    <Users className="w-6 h-6 text-gold-500" />
                  )}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{label}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {role === 'SELF'
                      ? 'I am looking for a spouse for myself'
                      : `I am creating this profile for my ${role === 'GUARDIAN' ? 'ward' : role === 'BROTHER' ? 'sibling (sister)' : 'sibling (brother)'}`}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-sm mt-8" style={{ color: 'var(--color-text-secondary)' }}>
            Already have an account?{' '}
            <Link href="/login" className="text-gold-400 hover:text-gold-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // --- Step 3: Guardian Contact Info ---
  if (step === 'guardian') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="flex items-center gap-1 mb-6 text-sm transition" style={{ color: 'var(--color-text-secondary)' }}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-6">
              <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Guardian / Parent Contact</h1>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                This contact information will be shared with interested parties.
                We only share the guardian/parent&apos;s phone number, never the candidate&apos;s direct contact.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleGuardianNext} className="space-y-5">
              {/* Contact Person Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Contact person is</label>
                <select
                  required
                  className="input"
                  value={formData.guardianContactType}
                  onChange={(e) => setFormData({ ...formData, guardianContactType: e.target.value as GuardianContactType })}
                >
                  <option value="">Select...</option>
                  {(Object.entries(guardianContactLabels) as [GuardianContactType, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Contact Person&apos;s Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    required
                    className="input pl-10"
                    placeholder="Full name"
                    value={formData.guardianName}
                    onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  />
                </div>
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-sm font-medium mb-2">Contact Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    required
                    className="input pl-10"
                    placeholder="+1 (555) 123-4567"
                    value={formData.guardianPhone}
                    onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This number will be shared when a contact request is approved.
                </p>
              </div>

              {/* Contact Email (optional) */}
              <div>
                <label className="block text-sm font-medium mb-2">Contact Email (optional)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="guardian@email.com"
                    value={formData.guardianEmail}
                    onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-4"
              >
                Next: Choose Avatar
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Step 4: Avatar Selection ---
  if (step === 'avatar') {
    const avatars = formData.gender === 'MALE' ? MALE_AVATARS : FEMALE_AVATARS;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="card p-8">
            <button
              type="button"
              onClick={() => setStep(formData.creatorRole !== 'SELF' ? 'guardian' : 'form')}
              className="flex items-center gap-1 mb-6 text-sm transition" style={{ color: 'var(--color-text-secondary)' }}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-6">
              <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Choose an Avatar</h1>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Pick a cartoon avatar for the profile. Real photos are never displayed publicly.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-8">
              {avatars.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar: src })}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    formData.avatar === src
                      ? 'border-gold-500 ring-2 ring-gold-500/40 scale-105'
                      : 'hover:border-gold-500/30'
                  }`}
                  style={{ borderColor: formData.avatar === src ? undefined : 'var(--color-border)' }}
                >
                  <img
                    src={src}
                    alt="Avatar option"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {formData.avatar === src && (
                    <div className="absolute inset-0 bg-gold-500/20 flex items-center justify-center">
                      <div className="w-8 h-8 bg-gold-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !formData.avatar}
              className="btn-primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step 2: Main Form ---
  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <button
              type="button"
              onClick={() => setStep('role')}
              className="flex items-center gap-1 mb-4 text-sm mx-auto transition" style={{ color: 'var(--color-text-secondary)' }}
            >
              <ChevronLeft className="w-4 h-4" /> Change role
            </button>
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-gold rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-black" />
              </div>
              <span className="font-heading font-bold text-xl text-gradient-gold">At-Tayyibun</span>
            </Link>
            <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              {formData.creatorRole === 'SELF'
                ? 'Create Your Account'
                : 'Create a Profile'}
            </h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {formData.creatorRole === 'SELF'
                ? 'Begin your journey to finding a righteous spouse'
                : `Creating as: ${creatorRoleLabels[formData.creatorRole as CreatorRole]}`}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleFormNext} className="space-y-5">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {formData.creatorRole === 'SELF' ? 'First Name' : 'Candidate\'s First Name'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  required
                  className="input pl-10"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">Account Email</label>
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
              <label className="block text-sm font-medium mb-2">Account Phone Number (US)</label>
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
              <p className="text-xs text-gray-500 mt-1">One phone number per account</p>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {formData.creatorRole === 'SELF' ? 'I am a' : 'This profile is for a'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'MALE', avatar: '' })}
                  className={`p-3 rounded-lg border transition ${
                    formData.gender === 'MALE'
                      ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                      : ''
                  }`}
                  style={formData.gender !== 'MALE' ? { borderColor: 'var(--color-border)', color: 'var(--color-text)' } : {}}
                >
                  Brother
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'FEMALE', avatar: '' })}
                  className={`p-3 rounded-lg border transition ${
                    formData.gender === 'FEMALE'
                      ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                      : ''
                  }`}
                  style={formData.gender !== 'FEMALE' ? { borderColor: 'var(--color-border)', color: 'var(--color-text)' } : {}}
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

            <button
              type="submit"
              disabled={!formData.gender}
              className="btn-primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formData.creatorRole !== 'SELF' ? 'Next: Guardian Contact' : 'Next: Choose Avatar'}
            </button>
          </form>

          <p className="text-center text-sm mt-8" style={{ color: 'var(--color-text-secondary)' }}>
            Already have an account?{' '}
            <Link href="/login" className="text-gold-400 hover:text-gold-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Info (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-gradient-purple items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-24 h-24 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <Heart className="w-12 h-12 text-gold-400" />
          </div>
          <h2 className="font-heading text-3xl font-bold mb-4">
            {formData.creatorRole === 'SELF'
              ? 'Your Journey to a Blessed Marriage'
              : 'Help Your Family Find a Blessed Match'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {formData.creatorRole === 'SELF'
              ? 'At-Tayyibun provides a respectful, privacy-conscious environment for Muslims seeking marriage. Your data is encrypted, your photos are protected, and your privacy is our priority.'
              : 'At-Tayyibun welcomes parents, guardians, and siblings to create profiles. We share only the guardian\'s contact information to ensure family involvement from the start.'}
          </p>
        </div>
      </div>
    </div>
  );
}
