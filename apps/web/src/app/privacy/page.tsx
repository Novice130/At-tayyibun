'use client';

import { Shield, Lock, EyeOff, FileKey, UserX, Trash2, Share2, Mail } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LEGAL } from '@/lib/legal';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-6 text-center">
            Privacy <span className="text-gradient-gold">Sanctuary</span>
          </h1>
          <p className="text-secondary text-center mb-4">
            Your privacy is the foundation of At-Tayyibun. This is our Privacy Policy: what we
            collect, who can see it, and how to remove it.
          </p>
          <p className="text-muted text-sm text-center mb-12">Effective {LEGAL.effectiveDate}</p>

          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <UserX className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Adults only</h2>
              </div>
              <p className="text-secondary">
                At-Tayyibun is not for children. Members must be 18 or older, and we do not
                knowingly keep profiles of anyone younger.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <EyeOff className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">No real photos</h2>
              </div>
              <p className="text-secondary">
                Profiles show a cartoon avatar you pick. Real photos are never uploaded,
                stored, or shared.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Limited visibility of your data</h2>
              </div>
              <div className="text-secondary space-y-3">
                <p>
                  <strong>Anyone, including logged-out visitors,</strong> can see your avatar,
                  first name (unless you hide it), age, gender, ethnicity, city and state.
                </p>
                <p>
                  <strong>Signed-in members</strong> can also see the first 200 characters of
                  your bio.
                </p>
                <p>
                  <strong>People connected by a request</strong> can see your full bio and your
                  biodata (details such as education, profession and religious practice). If you
                  send a request, its receiver can see these while the request is open. If you
                  accept a request, the sender can see them too. Access ends if a pending request
                  is declined, withdrawn or expires.
                </p>
                <p>
                  <strong>Marital status and children</strong> are used for matching, and shown
                  to the receiver of a request you send. Your phone number and email are never
                  shown on your profile.
                </p>
                <p className="text-sm">
                  Nikah is the Islamic marriage contract. Biodata is the personal background that
                  families traditionally exchange when considering a marriage.
                </p>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <FileKey className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">How contact details are shared</h2>
              </div>
              <p className="text-secondary">
                Nothing is shared until you accept a request. When you do, you choose whether to
                share your guardian&apos;s contact or your own. The sender gets a link that needs
                their login, and can view the details once, within 7 days. The details are not
                placed in the email. Once they have seen the details, we cannot take them back,
                so accept only requests you are comfortable with.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">What is encrypted</h2>
              </div>
              <div className="text-secondary space-y-3">
                <p>
                  Your last name, full bio and biodata, including guardian details, are encrypted
                  in our database with AES-256-GCM.
                </p>
                <p>
                  Your phone number, email, first name, date of birth, location, marital answers
                  and bio preview are not encrypted this way, because the service needs to read
                  them to verify, match and display profiles. All connections to the site use
                  HTTPS.
                </p>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Share2 className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Who else receives data</h2>
              </div>
              <div className="text-secondary space-y-3">
                <p>Besides other members as described above, we use these service providers:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Neon, which hosts our database</li>
                  <li>Hetzner, which hosts our servers</li>
                  <li>Cloudflare, which carries traffic to the site</li>
                  <li>Resend, which delivers our email</li>
                  <li>Firebase (Google), which sends phone verification codes</li>
                  <li>Google and Apple, if you sign in with them</li>
                  <li>Sentry, which receives error reports</li>
                  <li>DiceBear, which draws default avatars from a coded identifier</li>
                </ul>
                <p>
                  If you add guardian details, you confirm that your guardian has agreed.
                </p>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Trash2 className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">How long we keep data, and deleting it</h2>
              </div>
              <div className="text-secondary space-y-3">
                <p>
                  We keep your data until your account is deleted. You can delete it at any time
                  from your profile page, in the app or on the web. Deletion is immediate and
                  permanent.
                </p>
                <p>
                  A few things remain after deletion: a log entry recording that the account was
                  deleted, reports made about or by the account (without the link to you), emails
                  already sent, your phone number&apos;s record at our verification provider, and
                  our database provider&apos;s limited restore history. To ask about any of these,
                  email us.
                </p>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <Mail className="w-6 h-6 text-gold-500" />
                <h2 className="font-heading text-xl font-semibold">Contact us</h2>
              </div>
              <p className="text-secondary">
                {LEGAL.operatorDescription}, runs this service. For privacy or legal questions,
                email{' '}
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
