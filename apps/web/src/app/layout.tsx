import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'),
  title: 'At-Tayyibun | Muslim Matrimony in the United States',
  description:
    'At-Tayyibun is a privacy-first, halal-oriented matrimony platform designed for Muslims in the United States. Find your righteous spouse with dignity and respect.',
  keywords: ['Muslim matrimony', 'halal marriage', 'nikah', 'Islamic matchmaking', 'Muslim singles USA'],
  authors: [{ name: 'At-Tayyibun' }],
  openGraph: {
    title: 'At-Tayyibun | Muslim Matrimony',
    description: 'Privacy-first matrimony for Muslims in the United States',
    type: 'website',
    locale: 'en_US',
    siteName: 'At-Tayyibun',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'At-Tayyibun | Muslim Matrimony',
    description: 'Privacy-first matrimony for Muslims in the United States',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* Prevent flash of wrong theme */}
        <script
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
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'At-Tayyibun',
              description: 'Privacy-first Muslim matrimony platform in the United States',
              url: 'https://attayyibun.com',
              logo: 'https://attayyibun.com/logo.png',
              sameAs: [],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'At-Tayyibun',
              url: 'https://attayyibun.com',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://attayyibun.com/search?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
