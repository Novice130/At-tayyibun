import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/Toaster';
import { isIndexable, OG_IMAGE, siteOrigin } from '@/lib/seo';

// Declared explicitly rather than relying on Next's injected default: this
// layout hand-writes its own <head>, so the implicit tag is easy to lose.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'At-Tayyibun | Muslim Matrimony in the United States',
  description:
    'At-Tayyibun is a privacy-first, halal-oriented matrimony platform designed for Muslims in the United States. Find your righteous spouse with dignity and respect.',
  keywords: ['Muslim matrimony', 'halal marriage', 'nikah', 'Islamic matchmaking', 'Muslim singles USA'],
  authors: [{ name: 'At-Tayyibun' }],
  openGraph: {
    title: 'At-Tayyibun | Muslim Matrimony in the United States',
    description: 'Privacy-first matrimony for Muslims in the United States',
    type: 'website',
    locale: 'en_US',
    siteName: 'At-Tayyibun',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'At-Tayyibun | Muslim Matrimony in the United States',
    description: 'Privacy-first matrimony for Muslims in the United States',
    images: [OG_IMAGE.url],
  },
  robots: isIndexable() ? { index: true, follow: true } : { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Per-request CSP nonce from src/middleware.ts. Reading headers() makes every
  // route dynamic, which a nonce needs anyway: a page prerendered at build time
  // could not carry this request's nonce. Browsers blank the nonce attribute
  // after load, hence suppressHydrationWarning on the scripts.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/at-tayyibun-logo.png" />
        <link rel="apple-touch-icon" href="/at-tayyibun-logo.png" />
        {/* Prevent flash of wrong theme */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('at-tayyibun-theme');
                if (t) document.documentElement.className = t;
              } catch(e) {}
            `,
          }}
        />
        {/* JSON-LD Structured Data */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'At-Tayyibun',
              description: 'Privacy-first Muslim matrimony platform in the United States',
              url: 'https://attayyibun.com',
              logo: 'https://attayyibun.com/at-tayyibun-logo.png',
              sameAs: [],
            }),
          }}
        />
        <script
          nonce={nonce}
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'At-Tayyibun',
              url: 'https://attayyibun.com',
            }),
          }}
        />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg"
          style={{ backgroundColor: 'var(--color-gold-500)', color: '#1a1a2e' }}
        >
          Skip to content
        </a>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
