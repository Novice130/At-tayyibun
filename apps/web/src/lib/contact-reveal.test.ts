import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { revealFailure } from './contact-reveal';

test('a lost connection, a rate limit and a server error keep the button', () => {
  // api.ts reports a failed fetch as 503.
  for (const statusCode of [503, 500, 502, 504, 408, 429]) {
    assert.equal(revealFailure({ statusCode, message: 'x' }).retryable, true, String(statusCode));
  }
  assert.equal(revealFailure(new TypeError('Failed to fetch')).retryable, true);
  assert.equal(revealFailure(undefined).retryable, true);
});

test('410 hides the button and keeps the API reason', () => {
  const viewed = revealFailure({ statusCode: 410, message: 'These contact details have already been viewed.' });
  assert.deepEqual(viewed, { message: 'These contact details have already been viewed.', retryable: false });
  const expired = revealFailure({ statusCode: 410, message: 'This link has expired. You can send a new request.' });
  assert.equal(expired.retryable, false);
  assert.match(expired.message, /expired/);
  assert.equal(revealFailure({ statusCode: 410 }).message, 'These contact details are no longer available.');
});

test('404 hides the button with neutral copy', () => {
  assert.deepEqual(revealFailure({ statusCode: 404, message: 'Request not found' }), {
    message: 'This request could not be found.',
    retryable: false,
  });
});

test('the contact page keeps the button whenever the failure is retryable', () => {
  const page = readFileSync(new URL('../app/requests/[id]/contact/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /revealFailure\(/);
  assert.doesNotMatch(page, /\{!error && \(/);
});
