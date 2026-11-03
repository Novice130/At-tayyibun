import { APP_LINKS_HEADERS, assetLinks } from '@/lib/app-links';

// Android App Links verification. See src/lib/app-links.ts. Dynamic because
// the fingerprint comes from the runtime environment.
export const dynamic = 'force-dynamic';

export function GET() {
  const body = assetLinks();
  if (!body) return new Response('Not configured', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(JSON.stringify(body), { headers: APP_LINKS_HEADERS });
}
