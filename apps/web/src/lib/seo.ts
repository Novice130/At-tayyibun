import type { Metadata, MetadataRoute } from 'next';

const PRODUCTION_ORIGIN = 'https://attayyibun.com';
export const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'At-Tayyibun' };

export interface SeoEnv {
  /** Baked into the image at build time. */
  webUrl?: string;
  /** Read at runtime; every deployment sets it because sign-in needs it. */
  authUrl?: string;
  sentryEnvironment?: string;
}

/** Spelled out because Next only inlines literal process.env.NEXT_PUBLIC_* reads. */
export function readSeoEnv(): SeoEnv {
  return {
    webUrl: process.env.NEXT_PUBLIC_WEB_URL,
    authUrl: process.env.BETTER_AUTH_URL,
    sentryEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  };
}

function originOf(url: string | undefined): string | null {
  const clean = url?.replace(/^["']|["']$/g, '').trim();
  if (!clean) return null;
  try {
    return new URL(clean).origin;
  } catch {
    return null;
  }
}

export function siteOrigin(env: SeoEnv = readSeoEnv()): string {
  return originOf(env.webUrl) ?? originOf(env.authUrl) ?? PRODUCTION_ORIGIN;
}

/** Only the production host may be indexed: staging or any other host is not. */
export function isIndexable(env: SeoEnv = readSeoEnv()): boolean {
  if (env.sentryEnvironment === 'staging') return false;
  return [env.authUrl, env.webUrl].every((url) => {
    const origin = originOf(url);
    return origin === null || origin === PRODUCTION_ORIGIN;
  });
}

/** Pages anyone can open without an account. Nothing member-only or admin belongs here. */
export const PUBLIC_PATHS = ['/', '/about', '/contact', '/privacy', '/terms', '/signup', '/login'] as const;

const DISALLOWED_PATHS = [
  '/admin',
  '/api/',
  '/auth/',
  '/browse',
  '/download',
  '/forgot-password',
  '/monitoring',
  '/profile',
  '/requests',
  '/reset-password',
  '/suspended',
  '/unsubscribe',
  '/verify-email',
  '/verify-phone',
];

export function buildRobots(env: SeoEnv = readSeoEnv()): MetadataRoute.Robots {
  if (!isIndexable(env)) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: DISALLOWED_PATHS },
    sitemap: `${siteOrigin(env)}/sitemap.xml`,
  };
}

export function buildSitemap(env: SeoEnv = readSeoEnv()): MetadataRoute.Sitemap {
  if (!isIndexable(env)) return [];
  const origin = siteOrigin(env);
  return PUBLIC_PATHS.map((path) => ({ url: path === '/' ? origin : `${origin}${path}` }));
}

/** Canonical plus full Open Graph: a child's openGraph replaces the layout's, it does not merge. */
export function pageMetadata(page: { path: string; title: string; description: string }): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.path,
      type: 'website',
      locale: 'en_US',
      siteName: 'At-Tayyibun',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [OG_IMAGE.url],
    },
  };
}
