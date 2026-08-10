import type { Metadata } from 'next';
import { Download, Smartphone, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

// Kept in sync by hand with apps/mobile/pubspec.yaml and the file actually
// committed at apps/web/public/downloads/. There is no build step that reads the
// APK, so bumping the app means editing these three constants.
const APK_PATH = '/downloads/at-tayyibun.apk';
const APK_VERSION = '0.1.2 (build 3)';
// 37,636,176 bytes — coincidentally the same as build 2, which differed only in
// Dart code that fits inside the snapshot's existing padding.
const APK_SIZE = '35.9 MB';
const APK_SHA256 =
  '6c452def8a99dc47d73d89dafe5b0d3f46ae5571ec8f131e73505bfb627eee1e';

export const metadata: Metadata = {
  title: 'Download the Android app | At-Tayyibun',
  description:
    'Install the At-Tayyibun Android app to browse profiles and manage contact requests from your phone.',
};

const steps = [
  {
    title: 'Download the file',
    body: 'Tap the button above on your Android phone. The file is about 36 MB.',
  },
  {
    title: 'Allow the install',
    body: 'Android blocks apps from outside the Play Store by default. When prompted, allow your browser to install unknown apps, then return to the download.',
  },
  {
    title: 'Open it',
    body: 'Tap the downloaded file and confirm. You can then sign in with the same account you use on this site.',
  },
];

export default function DownloadPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <section className="pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
              style={{ background: 'var(--color-gold-100)' }}
            >
              <Smartphone className="w-8 h-8" style={{ color: 'var(--color-gold-500)' }} />
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              Get the <span className="text-gradient-gold">Android app</span>
            </h1>
            <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              Browse profiles and manage contact requests from your phone. Same
              account, same privacy rules as the website.
            </p>
          </div>

          <div className="card p-8 text-center">
            <a href={APK_PATH} className="btn-primary w-full sm:w-auto" download>
              <Download className="w-5 h-5 mr-2" />
              Download for Android
            </a>
            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Version {APK_VERSION} &middot; {APK_SIZE} &middot; Android 7.0 and above
            </p>
          </div>

          <div className="mt-10 grid gap-4">
            {steps.map((step, i) => (
              <div key={step.title} className="card p-6 flex gap-4">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
                  style={{ background: 'var(--color-gold-100)', color: 'var(--color-gold-600)' }}
                >
                  {i + 1}
                </div>
                <div>
                  <h2 className="font-heading font-semibold mb-1">{step.title}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-10 card p-6 border-l-4"
            style={{ borderLeftColor: 'var(--color-gold-500)' }}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                style={{ color: 'var(--color-gold-500)' }}
              />
              <div className="min-w-0">
                <h2 className="font-heading font-semibold mb-1">Verify what you installed</h2>
                <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  The SHA-256 checksum of the official file. It should match the
                  file you downloaded.
                </p>
                <code
                  className="block text-xs font-mono break-all p-3 rounded-lg"
                  style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                >
                  {APK_SHA256}
                </code>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3 px-2">
            <TriangleAlert
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              There is no iPhone app yet. On iOS, use this website &mdash; it works
              in Safari and can be added to your home screen.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
