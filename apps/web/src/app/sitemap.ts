import type { MetadataRoute } from 'next';
import { buildSitemap } from '@/lib/seo';

// Decided per request from the runtime env, not frozen into the image at build.
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap();
}
