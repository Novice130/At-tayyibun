import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRobots, buildSitemap, isIndexable, pageMetadata, siteOrigin } from './seo';

const PROD = { authUrl: 'https://attayyibun.com', webUrl: 'https://attayyibun.com' };
const STAGING = { authUrl: 'https://staging.attayyibun.com', webUrl: 'https://staging.attayyibun.com' };

test('production is indexable', () => {
  assert.equal(isIndexable(PROD), true);
});

test('staging is not, by host or by environment name', () => {
  assert.equal(isIndexable(STAGING), false);
  assert.equal(isIndexable({ authUrl: 'https://staging.attayyibun.com', webUrl: 'https://attayyibun.com' }), false);
  assert.equal(isIndexable({ ...PROD, sentryEnvironment: 'staging' }), false);
});

test('robots disallows everything on staging and names no sitemap', () => {
  assert.deepEqual(buildRobots(STAGING), { rules: { userAgent: '*', disallow: '/' } });
});

test('robots on production shuts out admin and member areas and names the sitemap', () => {
  const robots = buildRobots(PROD);
  const rules = robots.rules as { disallow: string[] };
  for (const path of ['/admin', '/browse', '/profile', '/requests', '/api/', '/download', '/unsubscribe']) {
    assert.ok(rules.disallow.includes(path), path);
  }
  assert.equal(robots.sitemap, 'https://attayyibun.com/sitemap.xml');
});

test('the sitemap lists public pages only, and is empty on staging', () => {
  const urls = buildSitemap(PROD).map((e) => e.url);
  assert.ok(urls.includes('https://attayyibun.com'));
  assert.ok(urls.includes('https://attayyibun.com/privacy'));
  assert.equal(urls.filter((u) => /admin|browse|profile|requests|download/.test(u)).length, 0);
  assert.deepEqual(buildSitemap(STAGING), []);
});

test('siteOrigin tolerates quotes and a trailing path, and defaults to production', () => {
  assert.equal(siteOrigin({ authUrl: '"https://attayyibun.com/"' }), 'https://attayyibun.com');
  assert.equal(siteOrigin({}), 'https://attayyibun.com');
});

test('pageMetadata carries the canonical and the og image', () => {
  const meta = pageMetadata({ path: '/about', title: 'T', description: 'D' });
  assert.equal(meta.alternates?.canonical, '/about');
  assert.deepEqual((meta.openGraph?.images as Array<{ url: string }>)[0].url, '/og-image.jpg');
});
