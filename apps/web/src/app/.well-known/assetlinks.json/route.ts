import { APP_LINKS_HEADERS, assetLinks } from '@/lib/app-links';

// Android App Links verification. See src/lib/app-links.ts.
export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify(assetLinks()), { headers: APP_LINKS_HEADERS });
}
