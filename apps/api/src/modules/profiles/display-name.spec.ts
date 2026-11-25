import { displayNameFor, formatCity, formatPlace, formatState, memberNumber } from './display-name';

describe('displayNameFor', () => {
  it('capitalises a visible first name and trims it', () => {
    expect(displayNameFor({ firstName: '  amina ', hideName: false, gender: 'FEMALE', publicId: 'p1' })).toBe('Amina');
    expect(displayNameFor({ firstName: 'mary ann', gender: 'FEMALE', publicId: 'p1' })).toBe('Mary Ann');
  });

  it('keeps the rest of the name as typed', () => {
    expect(displayNameFor({ firstName: 'mcKenzie', gender: 'FEMALE', publicId: 'p1' })).toBe('McKenzie');
  });

  it('uses Sister / Brother / Member NNNN when the name is hidden', () => {
    const n = memberNumber('usr_pub_1');
    expect(displayNameFor({ firstName: 'Fatima', hideName: true, gender: 'FEMALE', publicId: 'usr_pub_1' })).toBe(`Sister ${n}`);
    expect(displayNameFor({ firstName: 'Omar', hideName: true, gender: 'MALE', publicId: 'usr_pub_1' })).toBe(`Brother ${n}`);
    expect(displayNameFor({ firstName: 'X', hideName: true, gender: null, publicId: 'usr_pub_1' })).toBe(`Member ${n}`);
  });

  it('falls back the same way for an empty or whitespace name', () => {
    expect(displayNameFor({ firstName: '   ', gender: 'MALE', publicId: 'abc' })).toMatch(/^Brother \d{4}$/);
    expect(displayNameFor({ firstName: null, gender: 'FEMALE', publicId: 'abc' })).toMatch(/^Sister \d{4}$/);
  });

  it('never returns the publicId', () => {
    for (const publicId of ['usr_pub_1', 'abcd-efgh', '']) {
      const name = displayNameFor({ firstName: '', hideName: true, gender: 'FEMALE', publicId });
      if (publicId) expect(name).not.toContain(publicId);
      expect(name).toMatch(/^Sister \d{4}$/);
    }
  });

  it('is deterministic and stays in 1000-9999', () => {
    expect(memberNumber('usr_pub_1')).toBe(memberNumber('usr_pub_1'));
    for (let i = 0; i < 500; i++) {
      const n = memberNumber(`id-${i}`);
      expect(n).toBeGreaterThanOrEqual(1000);
      expect(n).toBeLessThanOrEqual(9999);
    }
  });

  it('gives different members different numbers (usually)', () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => memberNumber(`member-${i}`)));
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe('formatCity / formatState / formatPlace', () => {
  it.each([
    ['lorton', 'Lorton'],
    ['st. louis', 'St. Louis'],
    ['new york', 'New York'],
    ['  NEW   YORK ', 'New York'],
    ['winston-salem', 'Winston-Salem'],
    ['McLean', 'McLean'],
  ])('city %p -> %p', (input, expected) => {
    expect(formatCity(input)).toBe(expected);
  });

  it('turns an empty city into null', () => {
    expect(formatCity('')).toBeNull();
    expect(formatCity('   ')).toBeNull();
    expect(formatCity(null)).toBeNull();
    expect(formatCity(undefined)).toBeNull();
  });

  it.each([
    ['va', 'VA'],
    [' Il ', 'IL'],
    ['virginia', 'Virginia'],
    ['new  york', 'New York'],
    ['', null],
    [null, null],
  ])('state %p -> %p', (input, expected) => {
    expect(formatState(input as string | null)).toBe(expected);
  });

  it('formats both parts together', () => {
    expect(formatPlace('lorton', 'va')).toEqual({ city: 'Lorton', state: 'VA' });
  });
});
