import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
    <html lang="en" className="dark">
      <head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'At-Tayyibun',
              description: 'Privacy-first Muslim matrimony platform in the United States',
              url: 'https://at-tayyibun.com',
              logo: 'https://at-tayyibun.com/logo.png',
              sameAs: [
                // TODO: Add social links
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
                target: 'https://at-tayyibun.com/search?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-white">
        {children}
      </body>
    </html>
  );
}
