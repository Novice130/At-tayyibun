import { Gender } from '../../../common/types/role';
import { MAX_BROWSE_LIMIT, MAX_BROWSE_PAGE, normalizeBrowseQuery } from './index';

describe('normalizeBrowseQuery', () => {
  it('defaults to the first page of 20', () => {
    expect(normalizeBrowseQuery({})).toMatchObject({ page: 1, limit: 20 });
  });

  it('caps page so the OFFSET stays bounded', () => {
    expect(MAX_BROWSE_PAGE).toBe(500);
    expect(normalizeBrowseQuery({ page: '100000' }).page).toBe(MAX_BROWSE_PAGE);
    expect(normalizeBrowseQuery({ page: MAX_BROWSE_PAGE + 1 }).page).toBe(MAX_BROWSE_PAGE);
    expect(normalizeBrowseQuery({ page: MAX_BROWSE_PAGE }).page).toBe(MAX_BROWSE_PAGE);
  });

  it('bounds the largest possible offset', () => {
    const { page, limit } = normalizeBrowseQuery({ page: '999999', limit: '999999' });
    expect((page! - 1) * limit!).toBeLessThanOrEqual((MAX_BROWSE_PAGE - 1) * MAX_BROWSE_LIMIT);
  });

  it.each([['0'], ['-5'], ['abc'], [''], ['  '], [null], [undefined], ['NaN'], ['Infinity']])(
    'falls back to page 1 for %j',
    (page) => {
      expect(normalizeBrowseQuery({ page }).page).toBe(1);
    },
  );

  it('truncates a fractional page', () => {
    expect(normalizeBrowseQuery({ page: '2.9' }).page).toBe(2);
  });

  it('clamps limit to 1..50', () => {
    expect(normalizeBrowseQuery({ limit: '-3' }).limit).toBe(1);
    expect(normalizeBrowseQuery({ limit: '500' }).limit).toBe(MAX_BROWSE_LIMIT);
  });

  it('keeps valid filters and drops invalid ones', () => {
    expect(
      normalizeBrowseQuery({
        ethnicity: ' Arab ',
        gender: Gender.MALE,
        minAge: '20',
        maxAge: '200',
        sortBy: 'age',
        order: 'sideways',
      }),
    ).toEqual({
      ethnicity: 'Arab',
      gender: Gender.MALE,
      minAge: 20,
      maxAge: undefined,
      sortBy: 'age',
      order: undefined,
      page: 1,
      limit: 20,
    });
  });
});
