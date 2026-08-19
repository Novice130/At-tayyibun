'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronLeft, ChevronRight, User, MapPin, BookOpen,
  Briefcase, Heart, CheckCircle2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useRequireSession } from '@/lib/hooks';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1 – Basic
  firstName: string;
  lastName: string;
  dob: string;
  ethnicity: string;
  city: string;
  state: string;
  hideLocation: boolean;
  hideName: boolean;
  // Step 2 – Background
  legalStatus: string;
  education: string;
  profession: string;
  relocate: string;
  // Step 3 – Deen
  religiousPractice: string;
  prayerFrequency: string;
  dietaryPreference: string;
  sect: string;
  // Step 4 – About
  about: string;
  partnerPreferences: string;
  dealBreakers: string;
  // Step 5 – Confirm
  nikahIntent: boolean;
}

const EMPTY: FormData = {
  firstName: '', lastName: '', dob: '', ethnicity: '',
  city: '', state: '', hideLocation: false, hideName: false,
  legalStatus: '', education: '', profession: '', relocate: '',
  religiousPractice: '', prayerFrequency: '', dietaryPreference: '', sect: '',
  about: '', partnerPreferences: '', dealBreakers: '',
  nikahIntent: false,
};

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const STEPS = [
  { label: 'Basic Info', icon: User },
  { label: 'Background', icon: BookOpen },
  { label: 'Deen', icon: Heart },
  { label: 'About You', icon: Briefcase },
  { label: 'Confirm', icon: CheckCircle2 },
];

// ─── Signup seed ─────────────────────────────────────────────────────────────

const SEED_KEY = 'pending-profile-seed';
// The seed lives in localStorage, which never expires, so it has to expire
// itself. A week is far longer than the 1 h verification link it exists to
// survive.
const SEED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface SignupSeed {
  firstName?: string;
  gender?: 'MALE' | 'FEMALE';
  creatorRole?: string;
  guardianContactType?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  email?: string;
  createdAt?: number;
}

/**
 * Return the signup seed only when it is safe to apply, and drop it otherwise.
 *
 * A seed that outlives its signup is destructive: applying it PUTs a biodata
 * blob holding nothing but the guardian keys, and the API replaces the blob
 * wholesale. Signing up in one browser and completing the wizard in another
 * left an armed seed in the first, so a later visit there silently reset the
 * profile. Three conditions have to hold:
 *   - the profile is not already complete (the wizard's own output outranks it)
 *   - the seed belongs to the signed-in account
 *   - the seed is recent
 * Seeds failing the last two are deleted; they can never become valid again.
 */
function readSeed(sessionEmail?: string | null, profileComplete?: boolean): SignupSeed | null {
  let seed: SignupSeed | null = null;
  try {
    const raw = localStorage.getItem(SEED_KEY);
    if (raw) seed = JSON.parse(raw);
  } catch {
    /* unparseable — treated as absent below and cleared */
  }
  if (!seed) return null;

  const stale = !seed.createdAt || Date.now() - seed.createdAt > SEED_MAX_AGE_MS;
  const foreign = !!seed.email && !!sessionEmail && seed.email !== sessionEmail;
  if (stale || foreign) {
    try { localStorage.removeItem(SEED_KEY); } catch {}
    return null;
  }

  // Once the wizard has been completed the seed can never usefully be applied
  // again — its firstName and gender are the signup-time guesses the wizard
  // has since replaced — so drop it rather than leave it armed.
  if (profileComplete) {
    try { localStorage.removeItem(SEED_KEY); } catch {}
    return null;
  }

  return seed;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfileSetupPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useRequireSession();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  // Biodata keys this wizard doesn't own (guardian details captured at signup).
  // Kept so submitting the wizard doesn't wipe them from the encrypted blob.
  const [extraBiodata, setExtraBiodata] = useState<Record<string, unknown>>({});

  // Drain the signup seed and then load the saved profile back into the form.
  // These two used to be separate effects firing concurrently, which both raced
  // each other and tripped the API's 3-requests-per-second throttle.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const hydrate = async () => {
      // Read the saved profile BEFORE touching the seed. The seed PUT replaces
      // the encrypted biodata blob wholesale, so applying it to an already
      // completed profile wipes education, profession, partner preferences and
      // the rest. Ordering the GET first is what makes the profileComplete
      // gate below trustworthy.
      let data: any = null;
      try {
        data = await api.get('/profiles/me');
      } catch {
        /* no existing profile, start fresh */
      }
      if (cancelled) return;
      const p = data?.profile ?? null;

      // A social sign-in lands here with ?new=1 to route profile-less accounts
      // into the wizard. Anyone who already finished it belongs in /browse —
      // but /profile/setup is also the "Edit Profile" target, so only the
      // post-OAuth landing redirects.
      if (p?.profileComplete && new URLSearchParams(window.location.search).has('new')) {
        router.replace('/browse');
        return;
      }

      const seed = readSeed(session.user?.email, p?.profileComplete);

      if (seed) {
        if (seed.gender) setGender(seed.gender);
        if (seed.firstName) setForm(f => ({ ...f, firstName: seed!.firstName! }));
        const guardian = Object.fromEntries(
          (
            [
              ['creatorRole', seed.creatorRole],
              ['guardianContactType', seed.guardianContactType],
              ['guardianName', seed.guardianName],
              ['guardianPhone', seed.guardianPhone],
              ['guardianEmail', seed.guardianEmail],
            ] as const
          ).filter(([, v]) => !!v),
        );
        try {
          await api.put('/profiles/me', {
            ...(seed.firstName ? { firstName: seed.firstName } : {}),
            ...(seed.gender ? { gender: seed.gender } : {}),
            ...(Object.keys(guardian).length
              ? { biodata: { ...((p?.biodata ?? {}) as Record<string, unknown>), ...guardian } }
              : {}),
          });
          // Only drop the seed once it is actually persisted. Clearing it
          // unconditionally meant a failed PUT silently lost the signup data.
          localStorage.removeItem(SEED_KEY);
        } catch {
          /* keep the seed so the next visit can retry */
        }
      }

      if (p) {
        const bd: Record<string, any> = (p.biodata ?? {}) as Record<string, any>;
        const OWNED = new Set([
          'hideLocation', 'hideName', 'legalStatus', 'education', 'profession', 'relocate',
          'religiousPractice', 'prayerFrequency', 'dietaryPreference', 'sect',
          'partnerPreferences', 'dealBreakers', 'nikahIntent',
        ]);
        setExtraBiodata(
          Object.fromEntries(Object.entries(bd).filter(([k]) => !OWNED.has(k))),
        );
        setGender(p.gender ?? null);
        setForm(f => ({
          ...f,
          firstName: p.firstName || f.firstName,
          lastName: p.lastName || f.lastName,
          city: p.city || f.city,
          state: p.state || f.state,
          // Pre-seed (signup) profiles carry placeholder dob/ethnicity — only
          // trust those once the wizard has been completed at least once.
          ethnicity: p.profileComplete ? (p.ethnicity || f.ethnicity) : f.ethnicity,
          dob: p.profileComplete ? (p.dob || f.dob) : f.dob,
          about: p.bio || f.about,
          hideLocation: bd.hideLocation ?? f.hideLocation,
          hideName: bd.hideName ?? f.hideName,
          legalStatus: bd.legalStatus || f.legalStatus,
          education: bd.education || f.education,
          profession: bd.profession || f.profession,
          relocate: bd.relocate || f.relocate,
          religiousPractice: bd.religiousPractice || f.religiousPractice,
          prayerFrequency: bd.prayerFrequency || f.prayerFrequency,
          dietaryPreference: bd.dietaryPreference || f.dietaryPreference,
          sect: bd.sect || f.sect,
          partnerPreferences: bd.partnerPreferences || f.partnerPreferences,
          dealBreakers: bd.dealBreakers || f.dealBreakers,
          nikahIntent: bd.nikahIntent ?? f.nikahIntent,
        }));
      }

      if (!cancelled) setHydrating(false);
    };

    void hydrate();
    return () => { cancelled = true; };
  }, [session]);

  const set = (key: keyof FormData, val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }));

  // ── Validation per step ──
  const validate = (): string => {
    if (step === 0) {
      if (!gender) return 'Please select your gender.';
      if (!form.firstName.trim()) return 'First name is required.';
      if (!form.lastName.trim()) return 'Last name is required.';
      if (!form.dob) return 'Date of birth is required.';
      const age = calcAge(form.dob);
      if (age < 18) return 'You must be at least 18 years old.';
      if (age > 80) return 'Please enter a valid date of birth.';
      if (!form.city.trim()) return 'City is required.';
      if (!form.state) return 'State is required.';
      if (!form.ethnicity.trim()) return 'Ethnicity / background is required.';
    }
    if (step === 1) {
      if (!form.legalStatus) return 'Legal status is required.';
      if (!form.education.trim()) return 'Education level is required.';
      if (!form.profession.trim()) return 'Profession is required.';
      if (!form.relocate) return 'Willingness to relocate is required.';
    }
    if (step === 2) {
      if (!form.religiousPractice) return 'Religious practice is required.';
      if (!form.prayerFrequency) return 'Prayer frequency is required.';
      if (!form.dietaryPreference) return 'Dietary preference is required.';
    }
    if (step === 3) {
      if (form.about.trim().length < 30) return 'Please write at least 30 characters about the candidate.';
      if (form.partnerPreferences.trim().length < 20) return 'Please describe partner preferences (min 20 characters).';
    }
    if (step === 4) {
      if (!form.nikahIntent) return 'Please confirm your intent before submitting.';
    }
    return '';
  };

  const handleNext = async () => {
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    if (step < STEPS.length - 1) { setStep(s => s + 1); return; }
    await handleSubmit();
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put('/profiles/me', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob,
        ...(gender ? { gender } : {}),
        ethnicity: form.ethnicity.trim(),
        city: form.city.trim(),
        state: form.state,
        bio: form.about.trim(),
        biodata: {
          // Preserve keys this wizard doesn't manage (guardian details from
          // signup) — the API replaces the whole encrypted blob on every write.
          ...extraBiodata,
          hideLocation: form.hideLocation,
          hideName: form.hideName,
          legalStatus: form.legalStatus,
          education: form.education.trim(),
          profession: form.profession.trim(),
          relocate: form.relocate,
          religiousPractice: form.religiousPractice,
          prayerFrequency: form.prayerFrequency,
          dietaryPreference: form.dietaryPreference,
          sect: form.sect.trim() || null,
          partnerPreferences: form.partnerPreferences.trim(),
          dealBreakers: form.dealBreakers.trim(),
          // Validated on step 5 but previously never sent, so the consent was
          // not recorded anywhere.
          nikahIntent: form.nikahIntent,
        },
      });
      toast.success('Profile saved.');
      router.push('/profile');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading || !session || hydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/at-tayyibun-logo.png" alt="At-Tayyibun" width={32} height={32} className="rounded-full" />
            <span className="font-heading font-bold text-gradient-gold hidden sm:block">At-Tayyibun</span>
          </Link>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Complete Your Profile</span>
          {/* This page renders no Navbar, so on a phone there was no way back
              into the app other than the logo. */}
          <Link
            href="/browse"
            className="ml-auto text-sm font-medium whitespace-nowrap hover:text-gold-500 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Browse
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                aria-current={i === step ? 'step' : undefined}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
                  i < step ? 'bg-gold-500 text-black' :
                  i === step ? 'bg-gold-500/20 text-gold-500 ring-2 ring-gold-500' :
                  'text-xs'
                }`}
                style={i > step ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '2px solid var(--color-border)' } : {}}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:block truncate ${i === step ? 'font-medium' : ''}`}
                style={{ color: i === step ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-1" style={{ backgroundColor: 'var(--color-border)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* ── Step 0: Basic Info ── */}
        {step === 0 && (
          <div className="card p-6 space-y-5">
            <div className="mb-2">
              <h2 className="font-heading text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Basic Information</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Your full name is kept private and only shared after family approval.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name <span className="text-red-400">*</span></label>
                <input className="input" placeholder="Ahmad" value={form.firstName}
                  onChange={e => set('firstName', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name <span className="text-red-400">*</span></label>
                <input className="input" placeholder="Khan" value={form.lastName}
                  onChange={e => set('lastName', e.target.value)} />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Kept private · encrypted</p>
              </div>
            </div>

            {!gender && (
              <div>
                <label className="block text-sm font-medium mb-2">I am a <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {(['MALE', 'FEMALE'] as const).map(g => (
                    <button key={g} type="button"
                      onClick={() => setGender(g)}
                      className={`p-3 rounded-lg border text-sm transition ${gender === g ? 'border-gold-500 bg-gold-500/10 text-gold-400' : ''}`}
                      style={gender !== g ? { borderColor: 'var(--color-border)', color: 'var(--color-text)' } : {}}>
                      {g === 'MALE' ? 'Brother' : 'Sister'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Date of Birth <span className="text-red-400">*</span></label>
              <input type="date" className="input" max={maxDob()} value={form.dob}
                onChange={e => set('dob', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ethnicity / Background <span className="text-red-400">*</span></label>
              <input className="input" placeholder="e.g. South Asian, Arab, East African…" value={form.ethnicity}
                onChange={e => set('ethnicity', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">City <span className="text-red-400">*</span></label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input className="input pl-9" placeholder="Houston" value={form.city}
                    onChange={e => set('city', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State <span className="text-red-400">*</span></label>
                <select className="input" value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select…</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0"
                checked={form.hideLocation} onChange={e => set('hideLocation', e.target.checked)} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Hide my city/state from the public browse page and only show my region.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0"
                checked={form.hideName} onChange={e => set('hideName', e.target.checked)} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Hide my first name on the public browse page. Only my Public ID will be shown until I accept a connection.
              </span>
            </label>
          </div>
        )}

        {/* ── Step 1: Background ── */}
        {step === 1 && (
          <div className="card p-6 space-y-5">
            <div className="mb-2">
              <h2 className="font-heading text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Background & Life</h2>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Legal Status in the US <span className="text-red-400">*</span></label>
              <select className="input" value={form.legalStatus} onChange={e => set('legalStatus', e.target.value)}>
                <option value="">Select…</option>
                <option value="Citizen">Citizen</option>
                <option value="Permanent Resident">Permanent Resident</option>
                <option value="Visa-Holder">Visa-Holder</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Education Level <span className="text-red-400">*</span></label>
              <select className="input" value={form.education} onChange={e => set('education', e.target.value)}>
                <option value="">Select…</option>
                <option value="High School">High School</option>
                <option value="Some College">Some College</option>
                <option value="Bachelor's">Bachelor's Degree</option>
                <option value="Master's">Master's Degree</option>
                <option value="Doctorate">Doctorate / PhD</option>
                <option value="Medical / JD">Medical / Law (MD / JD)</option>
                <option value="Vocational / Trade">Vocational / Trade</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Profession <span className="text-red-400">*</span></label>
              <input className="input" placeholder="e.g. Software Engineer, Doctor, Teacher…" value={form.profession}
                onChange={e => set('profession', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Willingness to Relocate <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['Yes', 'No', 'Open to Discussion'].map(v => (
                  <button key={v} type="button"
                    onClick={() => set('relocate', v)}
                    className={`p-3 rounded-lg border text-sm transition ${form.relocate === v ? 'border-gold-500 bg-gold-500/10 text-gold-400' : ''}`}
                    style={form.relocate !== v ? { borderColor: 'var(--color-border)', color: 'var(--color-text)' } : {}}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Deen ── */}
        {step === 2 && (
          <div className="card p-6 space-y-5">
            <div className="mb-2">
              <h2 className="font-heading text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Deen & Practice</h2>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Religious Practice <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['Practicing', 'Striving', 'Moderate'].map(v => (
                  <button key={v} type="button"
                    onClick={() => set('religiousPractice', v)}
                    className={`p-3 rounded-lg border text-sm transition ${form.religiousPractice === v ? 'border-gold-500 bg-gold-500/10 text-gold-400' : ''}`}
                    style={form.religiousPractice !== v ? { borderColor: 'var(--color-border)', color: 'var(--color-text)' } : {}}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Prayer Frequency <span className="text-red-400">*</span></label>
              <select className="input" value={form.prayerFrequency} onChange={e => set('prayerFrequency', e.target.value)}>
                <option value="">Select…</option>
                <option value="5x Daily">5x Daily (all prayers)</option>
                <option value="Most of the time">Most of the time</option>
                <option value="Occasionally">Occasionally</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dietary Preferences <span className="text-red-400">*</span></label>
              <select className="input" value={form.dietaryPreference} onChange={e => set('dietaryPreference', e.target.value)}>
                <option value="">Select…</option>
                <option value="Zabiha Only">Zabiha Only</option>
                <option value="Halal (any)">Halal (any certified)</option>
                <option value="No Preference">No Preference</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Sect / School of Thought <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
              </label>
              <input className="input" placeholder="e.g. Sunni, Shia, Hanafi, Shafi'i…" value={form.sect}
                onChange={e => set('sect', e.target.value)} />
            </div>
          </div>
        )}

        {/* ── Step 3: About ── */}
        {step === 3 && (
          <div className="card p-6 space-y-5">
            <div className="mb-2">
              <h2 className="font-heading text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>About & Preferences</h2>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Describe the Candidate <span className="text-red-400">*</span>
              </label>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Tell us about their personality, hobbies, and goals.
              </p>
              <textarea
                rows={5}
                maxLength={2000}
                className="input resize-none"
                placeholder="e.g. A kind-hearted and ambitious person who loves reading, outdoor activities, and is committed to lifelong learning…"
                value={form.about}
                onChange={e => set('about', e.target.value)}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{form.about.length} / 2000 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Partner Preferences <span className="text-red-400">*</span>
              </label>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                What are the most important qualities you are looking for in a spouse / family?
              </p>
              <textarea
                rows={4}
                className="input resize-none"
                placeholder="e.g. Someone who values family, is religious but not rigid, educated, and open to building a life together…"
                value={form.partnerPreferences}
                onChange={e => set('partnerPreferences', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Deal-Breakers <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
              </label>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Are there any specific "must-haves" or "no-gos"?
              </p>
              <textarea
                rows={3}
                className="input resize-none"
                placeholder="e.g. Must be willing to live in the US, non-smoker…"
                value={form.dealBreakers}
                onChange={e => set('dealBreakers', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm ── */}
        {step === 4 && (
          <div className="card p-6 space-y-6">
            <div className="mb-2">
              <h2 className="font-heading text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Confirmation</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Almost done! Please review and confirm before submitting.
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-xl p-4 space-y-2 text-sm" style={{ backgroundColor: 'var(--color-surface-alt, var(--color-surface))', border: '1px solid var(--color-border)' }}>
              <SummaryRow label="Name" value={`${form.firstName} ${form.lastName}`} private />
              <SummaryRow label="Location" value={`${form.city}, ${form.state}`} />
              <SummaryRow label="Legal Status" value={form.legalStatus} />
              <SummaryRow label="Education" value={form.education} />
              <SummaryRow label="Profession" value={form.profession} />
              <SummaryRow label="Religious Practice" value={form.religiousPractice} />
              <SummaryRow label="Prayer" value={form.prayerFrequency} />
              <SummaryRow label="Diet" value={form.dietaryPreference} />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0"
                checked={form.nikahIntent} onChange={e => set('nikahIntent', e.target.checked)} />
              <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                I confirm that I am seeking a serious marriage connection (Nikah) and that all information provided is accurate to the best of my knowledge.
              </span>
            </label>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => { setError(''); setStep(s => s - 1); }}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm transition disabled:opacity-0"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Step {step + 1} of {STEPS.length}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6 py-3"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {step < STEPS.length - 1 ? (
              <>Next <ChevronRight className="w-4 h-4" /></>
            ) : (
              'Complete Profile'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function maxDob(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

function SummaryRow({ label, value, private: priv }: { label: string; value: string; private?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
      <span className="flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="font-medium break-words sm:text-right" style={{ color: 'var(--color-text)' }}>
        {priv ? '••••• (private)' : value}
      </span>
    </div>
  );
}
