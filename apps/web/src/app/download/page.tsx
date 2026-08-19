import type { Metadata } from 'next';
import { Download, Smartphone, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

// These three constants describe the APK file actually committed at
// apps/web/public/downloads/. There is no build step that reads the APK, so
// shipping a new one means editing them by hand. They deliberately lag
// apps/mobile/pubspec.yaml: pubspec is bumped ahead of an iOS build, while the
// APK only changes when a new one is built and committed.
const APK_PATH = '/downloads/at-tayyibun.apk';
const APK_VERSION = '0.1.2 (build 3)';
// 37,636,176 bytes — coincidentally the same as build 2, which differed only in
// Dart code that fits inside the snapshot's existing padding.
const APK_SIZE = '35.9 MB';
const APK_SHA256 =
  '6c452def8a99dc47d73d89dafe5b0d3f46ae5571ec8f131e73505bfb627eee1e';

// null until the iOS app is approved and live. Set it to the App Store listing
// URL (https://apps.apple.com/app/id<APP_ID>) and the iOS card replaces the
// "no iPhone app yet" note below. Nothing else needs editing.
const APP_STORE_URL: string | null = null;

export const metadata: Metadata = {
  title: APP_STORE_URL
    ? 'Download the app | At-Tayyibun'
    : 'Download the Android app | At-Tayyibun',
  description:
    'Install the At-Tayyibun mobile app to browse profiles and manage contact requests from your phone.',
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
              Get the{' '}
              <span className="text-gradient-gold">
                {APP_STORE_URL ? 'app' : 'Android app'}
              </span>
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

          {APP_STORE_URL && (
            <div className="mt-6 card p-8 text-center">
              <a
                href={APP_STORE_URL}
                className="btn-primary w-full sm:w-auto"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.18-.02 1.93-1.08 2.65-2.14.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5zM14.86 5.6c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.06 1.7-.93 2.7.97.08 1.97-.5 2.59-1.23z" />
                </svg>
                Download on the App Store
              </a>
              <p className="mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                iPhone and iPad &middot; iOS 13.0 and above
              </p>
            </div>
          )}

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

          {!APP_STORE_URL && (
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
          )}
        </div>
      </section>
    </div>
  );
}
