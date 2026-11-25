import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_BROWSE_PAGE, pageFromSearch, pageToRecoverTo, reachablePages } from './browse-paging';
import { blockedMemberLabel, reportPayload, REPORT_DETAILS_MAX, reportReasonLabel } from './moderation';

test('password reset reaches the better-auth route that exists, not the 404', async () => {
  const urls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input instanceof Request ? input.url : input));
    return new Response('{"status":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    // better-fetch binds fetch when the client is created, so import after stubbing.
    const { authClient } = await import('./auth-client');
    await authClient.requestPasswordReset({ email: 'a@example.com', redirectTo: 'http://x.test/reset-password' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/auth\/request-password-reset$/);
});

test('the forgot-password page does not feature-detect the Proxy or post to the old path', () => {
  const page = readFileSync(new URL('../app/forgot-password/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /authClient\.requestPasswordReset\(/);
  assert.doesNotMatch(page, /typeof client|\/auth\/forget-password|forgetPassword/);
});

test('reportPayload trims, caps, and omits empty details', () => {
  assert.deepEqual(reportPayload('p1', 'OTHER', '   '), { targetPublicId: 'p1', reason: 'OTHER' });
  assert.equal(reportPayload('p1', 'OTHER', ` ${'x'.repeat(600)} `).details?.length, REPORT_DETAILS_MAX);
});

test('reportReasonLabel falls back to the raw code', () => {
  assert.equal(reportReasonLabel('SPAM_OR_SCAM'), 'Spam or scam');
  assert.equal(reportReasonLabel('NEW_CODE'), 'NEW_CODE');
});

test('a blocked member shows the masked name, else the public id', () => {
  assert.equal(blockedMemberLabel({ targetPublicId: 'p1', name: 'F***' }), 'F***');
  assert.equal(blockedMemberLabel({ targetPublicId: 'p1', name: ' ' }), 'p1');
  assert.equal(blockedMemberLabel({ targetPublicId: 'p1' }), 'p1');
});

test('pageFromSearch accepts only sensible pages', () => {
  assert.equal(pageFromSearch('?page=3'), 3);
  assert.equal(pageFromSearch(''), 1);
  for (const bad of ['?page=0', '?page=-2', '?page=abc', '?page=1.5']) assert.equal(pageFromSearch(bad), 1, bad);
  assert.equal(pageFromSearch('?page=999999'), MAX_BROWSE_PAGE);
});

test('reachablePages caps at the API limit', () => {
  assert.equal(reachablePages(12), 12);
  assert.equal(reachablePages(100000), MAX_BROWSE_PAGE);
  assert.equal(reachablePages(0), 0);
});

test('pageToRecoverTo only fires for an empty page past the end', () => {
  assert.equal(pageToRecoverTo(9, 0, 4), 4);
  assert.equal(pageToRecoverTo(1, 0, 0), null);
  assert.equal(pageToRecoverTo(3, 0, 0), null);
  assert.equal(pageToRecoverTo(2, 20, 4), null);
});
