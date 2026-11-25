import type { MetadataRoute } from 'next';
import { buildRobots } from '@/lib/seo';

// Decided per request from the runtime env, not frozen into the image at build.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return buildRobots();
}
