import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  awaitingEmailConfirmation,
  clearPendingEmail,
  onboardingRedirect,
  readPendingEmail,
  writePendingEmail,
} from './email-gate';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const phoneFirst = { id: 'u1', isPhoneVerified: true, emailIsPlaceholder: true };
const done = { email: 'me@example.com', profileComplete: true };

test('an unverified phone goes to /verify-phone first, even with an email pending', () => {
  assert.equal(onboardingRedirect({ id: 'u1', emailIsPlaceholder: true }, '/browse', done), '/verify-phone');
  assert.equal(onboardingRedirect({ id: 'u1' }, '/verify-phone', null), null);
});

test('a placeholder email with nothing submitted goes to /profile/setup', () => {
  assert.equal(onboardingRedirect(phoneFirst, '/browse', null), '/profile/setup');
  assert.equal(onboardingRedirect(phoneFirst, '/profile/setup', null), null);
});

test('submitting an email alone is not enough: the profile must be complete too', () => {
  assert.equal(onboardingRedirect(phoneFirst, '/browse', { email: 'me@example.com' }), '/profile/setup');
  assert.equal(onboardingRedirect(phoneFirst, '/browse', { profileComplete: true }), '/profile/setup');
});

test('a phone-verified member with a complete profile and a pending email gets through', () => {
  for (const path of ['/browse', '/requests', '/profile', '/requests/r1/contact']) {
    assert.equal(onboardingRedirect(phoneFirst, path, done), null, path);
  }
  assert.equal(awaitingEmailConfirmation(phoneFirst, done), true);
});

test('a real email passes, and is never "awaiting confirmation"', () => {
  const real = { id: 'u1', isPhoneVerified: true, emailIsPlaceholder: false };
  assert.equal(onboardingRedirect(real, '/browse', null), null);
  assert.equal(awaitingEmailConfirmation(real, done), false);
});

test('the pending record is per user, merges, and survives junk', () => {
  const store = memoryStore();
  writePendingEmail('u1', { email: 'me@example.com' }, store);
  writePendingEmail('u1', { profileComplete: true }, store);
  assert.deepEqual(readPendingEmail('u1', store), done);
  assert.equal(readPendingEmail('u2', store), null);
  assert.equal(readPendingEmail(undefined, store), null);
  clearPendingEmail('u1', store);
  assert.equal(readPendingEmail('u1', store), null);

  store.setItem('at-tayyibun:pending-email:u3', '{not json');
  assert.equal(readPendingEmail('u3', store), null);
  store.setItem('at-tayyibun:pending-email:u4', JSON.stringify({ email: 5, profileComplete: 'yes' }));
  assert.deepEqual(readPendingEmail('u4', store), {});
});

test('useRequireSession uses the shared gate, and setup records what the gate needs', () => {
  const hooks = readFileSync(new URL('./hooks.ts', import.meta.url), 'utf8');
  assert.match(hooks, /onboardingRedirect\(/);
  const setup = readFileSync(new URL('../app/profile/setup/page.tsx', import.meta.url), 'utf8');
  assert.match(setup, /writePendingEmail\([^)]*\{ email: newEmail \}/);
  assert.match(setup, /profileComplete: true/);
  // Verification of a changed email stays on.
  const auth = readFileSync(new URL('./auth.ts', import.meta.url), 'utf8');
  assert.match(auth, /updateEmailWithoutVerification: false/);
});
