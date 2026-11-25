import { APP_LINKS_HEADERS, appleAppSiteAssociation } from '@/lib/app-links';

// iOS Universal Links. Apple fetches this exact path, with no extension, and
// expects JSON. See src/lib/app-links.ts.
export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify(appleAppSiteAssociation()), { headers: APP_LINKS_HEADERS });
}
