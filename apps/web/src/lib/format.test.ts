import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPlace, memberDisplayName } from './format';

test('formatPlace', () => {
  assert.equal(formatPlace('lorton', 'va'), 'Lorton, VA');
  assert.equal(formatPlace('  NEW   YORK ', 'NY'), 'New York, NY');
  assert.equal(formatPlace('winston-salem', 'nc'), 'Winston-Salem, NC');
  assert.equal(formatPlace('McLean', 'Va'), 'McLean, VA');
  assert.equal(formatPlace('st. louis', 'missouri'), 'St. Louis, Missouri');
  assert.equal(formatPlace('Lorton', 'VA'), 'Lorton, VA');
  assert.equal(formatPlace('lorton', null), 'Lorton');
  assert.equal(formatPlace(null, 'va'), 'VA');
  assert.equal(formatPlace('  ', ''), null);
  assert.equal(formatPlace(null, undefined), null);
});

test('memberDisplayName', () => {
  assert.equal(memberDisplayName({ displayName: 'Sister 4821', firstName: null }), 'Sister 4821');
  assert.equal(memberDisplayName({ displayName: 'Aisha', firstName: 'Aisha' }), 'Aisha');
  assert.equal(memberDisplayName({ firstName: 'Omar' }), 'Omar');
  assert.equal(memberDisplayName({ displayName: '  ', firstName: 'Omar' }), 'Omar');
  assert.equal(memberDisplayName({ firstName: null }), 'Member');
  assert.equal(memberDisplayName(null), 'Member');
  assert.equal(memberDisplayName(undefined), 'Member');
});
