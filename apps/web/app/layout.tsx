import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'At-Tayyibun - Muslim Matrimony in the United States',
  description: 'At-Tayyibun is a privacy-first, halal-oriented matrimony platform designed for Muslims in the United States. Find your life partner with respect, dignity, and Islamic values.',
  keywords: ['Muslim matrimony', 'halal marriage', 'nikah', 'Islamic marriage', 'Muslim singles', 'US Muslim'],
  openGraph: {
    title: 'At-Tayyibun - Muslim Matrimony',
    description: 'Privacy-first matrimony platform for Muslims in the United States',
    type: 'website',
    locale: 'en_US',
    siteName: 'At-Tayyibun',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'At-Tayyibun - Muslim Matrimony',
    description: 'Privacy-first matrimony platform for Muslims in the United States',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'At-Tayyibun',
              url: 'https://at-tayyibun.com',
              logo: 'https://at-tayyibun.com/logo.png',
              description: 'A privacy-first, halal-oriented matrimony platform designed for Muslims in the United States.',
              sameAs: [
                'https://facebook.com/attayyibun',
                'https://instagram.com/attayyibun',
              ],
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
              url: 'https://at-tayyibun.com',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://at-tayyibun.com/browse?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-gold-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        {children}
      </body>
    </html>
  );
}
