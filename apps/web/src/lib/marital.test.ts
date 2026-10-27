import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMaritalLine, MARITAL_OPTIONS } from './marital';

test('formatMaritalLine', () => {
  assert.equal(formatMaritalLine('DIVORCED', true, 2), 'Divorced · 2 children');
  assert.equal(formatMaritalLine('NEVER_MARRIED', false, null), 'Never married · No children');
  assert.equal(formatMaritalLine('WIDOWED', true, 1), 'Widowed · 1 child');
  assert.equal(formatMaritalLine('WIDOWED', true, null), 'Widowed · Has children');
  assert.equal(formatMaritalLine(null, null, null), null);
  assert.equal(formatMaritalLine('NEVER_MARRIED', null, null), 'Never married');
});

test('MARITAL_OPTIONS has no married value', () => {
  assert.deepEqual(MARITAL_OPTIONS.map(o => o.value), ['NEVER_MARRIED', 'DIVORCED', 'WIDOWED']);
});
