import { PgDialect } from 'drizzle-orm/pg-core';
import { maritalStatus } from '../../db/schema';
import {
  DEFAULT_SIDE,
  hasCompleteProfile,
  isAcceptable,
  isMutualMatch,
  MARITAL_STATUSES,
  MaritalStatus,
  MatchSide,
  mutualMatchSql,
  toMatchSide,
} from './marital-match';

function side(
  status: MaritalStatus | null,
  hasChildren: boolean | null,
  openTo: Partial<Pick<MatchSide, 'openToDivorced' | 'openToWidowed' | 'openToChildren'>> = {},
): MatchSide {
  return {
    maritalStatus: status,
    hasChildren,
    openToDivorced: false,
    openToWidowed: false,
    openToChildren: false,
    ...openTo,
  };
}

/** Every side the matching rule can see: 4 statuses x 3 children x 8 boxes. */
function allSides(): MatchSide[] {
  const out: MatchSide[] = [];
  for (const status of [null, ...MARITAL_STATUSES]) {
    for (const hasChildren of [null, false, true]) {
      for (let boxes = 0; boxes < 8; boxes++) {
        out.push(
          side(status, hasChildren, {
            openToDivorced: (boxes & 1) !== 0,
            openToWidowed: (boxes & 2) !== 0,
            openToChildren: (boxes & 4) !== 0,
          }),
        );
      }
    }
  }
  return out;
}

const dialect = new PgDialect();

const COLUMN_OF: Record<string, keyof MatchSide> = {
  marital_status: 'maritalStatus',
  has_children: 'hasChildren',
  open_to_divorced: 'openToDivorced',
  open_to_widowed: 'openToWidowed',
  open_to_children: 'openToChildren',
};

/**
 * Evaluates the rendered fragment for one candidate row by translating the
 * small SQL subset it uses (coalesce, =, and, or, true, false, params, enum
 * casts) into JS. Anything outside that subset is left untranslated and makes
 * `new Function` throw, so the fragment cannot quietly grow beyond what this
 * test checks.
 */
function evalSql(fragment: ReturnType<typeof mutualMatchSql>, candidate: MatchSide): boolean {
  const { sql: text, params } = dialect.sqlToQuery(fragment);
  const js = text
    .replace(/\$(\d+)(::"MaritalStatus")?/g, (_m, n: string) => JSON.stringify(params[Number(n) - 1]))
    .replace(/"profiles"\."([a-z_]+)"/g, (_m, col: string) => {
      const key = COLUMN_OF[col];
      if (!key) throw new Error(`unexpected column ${col}`);
      return JSON.stringify(candidate[key]);
    })
    .replace(/\bcoalesce\(/g, '__coalesce(')
    .replace(/ = /g, ' === ')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||');
  const coalesce = (a: unknown, b: unknown) => (a === null || a === undefined ? b : a);
  return new Function('__coalesce', `return (${js});`)(coalesce) as boolean;
}

describe('marital-match', () => {
  it('lists exactly the schema enum values, with no married value', () => {
    expect([...MARITAL_STATUSES]).toEqual([...maritalStatus.enumValues]);
    expect([...MARITAL_STATUSES]).toEqual(['NEVER_MARRIED', 'DIVORCED', 'WIDOWED']);
  });

  it('DEFAULT_SIDE is never married, no children, open to nobody else', () => {
    expect(DEFAULT_SIDE).toEqual(side(null, null));
  });

  describe('toMatchSide', () => {
    it('fills defaults for a missing row', () => {
      expect(toMatchSide(null)).toEqual(DEFAULT_SIDE);
      expect(toMatchSide(undefined)).toEqual(DEFAULT_SIDE);
      expect(toMatchSide({})).toEqual(DEFAULT_SIDE);
    });

    it('keeps the given fields and ignores extra row columns', () => {
      const row = { maritalStatus: 'DIVORCED' as const, hasChildren: true, openToWidowed: true, userId: 'x' };
      expect(toMatchSide(row)).toEqual(side('DIVORCED', true, { openToWidowed: true }));
    });
  });

  describe('hasCompleteProfile', () => {
    it('needs profileComplete and both required answers', () => {
      const full = { profileComplete: true, maritalStatus: 'NEVER_MARRIED', hasChildren: false };
      expect(hasCompleteProfile(full)).toBe(true);
      expect(hasCompleteProfile({ ...full, profileComplete: false })).toBe(false);
      expect(hasCompleteProfile({ ...full, maritalStatus: null })).toBe(false);
      expect(hasCompleteProfile({ ...full, hasChildren: null })).toBe(false);
      expect(hasCompleteProfile({ ...full, hasChildren: undefined })).toBe(false);
      expect(hasCompleteProfile(null)).toBe(false);
      expect(hasCompleteProfile(undefined)).toBe(false);
    });
  });

  describe('isAcceptable', () => {
    it('accepts never married with no children by default', () => {
      expect(isAcceptable(DEFAULT_SIDE, side('NEVER_MARRIED', false))).toBe(true);
    });

    it('accepts divorced only when open to divorced', () => {
      expect(isAcceptable(DEFAULT_SIDE, side('DIVORCED', false))).toBe(false);
      expect(isAcceptable(side(null, null, { openToDivorced: true }), side('DIVORCED', false))).toBe(true);
    });

    it('accepts widowed only when open to widowed', () => {
      expect(isAcceptable(DEFAULT_SIDE, side('WIDOWED', false))).toBe(false);
      expect(isAcceptable(side(null, null, { openToWidowed: true }), side('WIDOWED', false))).toBe(true);
    });

    it('accepts someone with children only when open to children', () => {
      expect(isAcceptable(DEFAULT_SIDE, side('NEVER_MARRIED', true))).toBe(false);
      expect(isAcceptable(side(null, null, { openToChildren: true }), side('NEVER_MARRIED', true))).toBe(true);
    });

    it('needs both boxes for divorced with children', () => {
      expect(isAcceptable(side(null, null, { openToDivorced: true }), side('DIVORCED', true))).toBe(false);
      expect(isAcceptable(side(null, null, { openToChildren: true }), side('DIVORCED', true))).toBe(false);
      expect(
        isAcceptable(side(null, null, { openToDivorced: true, openToChildren: true }), side('DIVORCED', true)),
      ).toBe(true);
    });

    it('does not let open to divorced admit widowed, or the reverse', () => {
      expect(isAcceptable(side(null, null, { openToDivorced: true }), side('WIDOWED', false))).toBe(false);
      expect(isAcceptable(side(null, null, { openToWidowed: true }), side('DIVORCED', false))).toBe(false);
    });

    it('treats null status as never married and null children as none', () => {
      expect(isAcceptable(DEFAULT_SIDE, side(null, null))).toBe(true);
      expect(isAcceptable(DEFAULT_SIDE, side(null, false))).toBe(true);
      expect(isAcceptable(DEFAULT_SIDE, side('NEVER_MARRIED', null))).toBe(true);
      expect(isAcceptable(DEFAULT_SIDE, side(null, true))).toBe(false);
    });

    it('rejects an unknown status (fails closed)', () => {
      const odd = side('MARRIED' as MaritalStatus, false);
      const openToAll = side(null, null, { openToDivorced: true, openToWidowed: true, openToChildren: true });
      expect(isAcceptable(openToAll, odd)).toBe(false);
    });
  });

  describe('isMutualMatch', () => {
    const divorcedWithKids = side('DIVORCED', true, { openToDivorced: true });
    const sisterOpenToBoth = side('NEVER_MARRIED', false, { openToDivorced: true, openToChildren: true });
    const sisterOpenToDivorcedOnly = side('NEVER_MARRIED', false, { openToDivorced: true });

    it('is true when both directions accept', () => {
      expect(isMutualMatch(divorcedWithKids, sisterOpenToBoth)).toBe(true);
      expect(isMutualMatch(DEFAULT_SIDE, side('NEVER_MARRIED', false))).toBe(true);
    });

    it('is false when only one direction accepts', () => {
      // He accepts her (never married, no children), she does not accept him.
      expect(isAcceptable(divorcedWithKids, sisterOpenToDivorcedOnly)).toBe(true);
      expect(isAcceptable(sisterOpenToDivorcedOnly, divorcedWithKids)).toBe(false);
      expect(isMutualMatch(divorcedWithKids, sisterOpenToDivorcedOnly)).toBe(false);
      // She accepts him, he does not accept her (widowed, he is not open to widowed).
      const widowedOpenToAll = side('WIDOWED', false, { openToDivorced: true, openToChildren: true });
      expect(isAcceptable(widowedOpenToAll, divorcedWithKids)).toBe(true);
      expect(isAcceptable(divorcedWithKids, widowedOpenToAll)).toBe(false);
      expect(isMutualMatch(divorcedWithKids, widowedOpenToAll)).toBe(false);
    });

    it('equals both isAcceptable directions and is symmetric over every combination', () => {
      const sides = allSides();
      expect(sides).toHaveLength(96);
      for (const a of sides) {
        for (const b of sides) {
          const expected = isAcceptable(a, b) && isAcceptable(b, a);
          expect(isMutualMatch(a, b)).toBe(expected);
          expect(isMutualMatch(b, a)).toBe(expected);
        }
      }
    });
  });

  describe('mutualMatchSql', () => {
    it('for DEFAULT_SIDE requires never married and no children', () => {
      const { sql: text, params } = dialect.sqlToQuery(mutualMatchSql(DEFAULT_SIDE));
      expect(text).toContain('coalesce("profiles"."marital_status", $1::"MaritalStatus")');
      expect(text).toContain('coalesce("profiles"."has_children", false) = false');
      expect(params).toEqual(['NEVER_MARRIED', 'NEVER_MARRIED']);
    });

    it('binds only enum constants as params, never free text', () => {
      for (const viewer of allSides()) {
        const { params } = dialect.sqlToQuery(mutualMatchSql(viewer));
        for (const p of params) expect(MARITAL_STATUSES).toContain(p);
      }
    });

    it('wraps every candidate column in coalesce (NULL-safe)', () => {
      for (const viewer of allSides()) {
        const { sql: text } = dialect.sqlToQuery(mutualMatchSql(viewer));
        const refs = text.match(/"profiles"\."[a-z_]+"/g) ?? [];
        const wrapped = text.match(/coalesce\("profiles"\."[a-z_]+", /g) ?? [];
        expect(wrapped).toHaveLength(refs.length);
      }
    });

    it('matches isMutualMatch for every viewer and candidate combination', () => {
      const sides = allSides();
      for (const viewer of sides) {
        const fragment = mutualMatchSql(viewer);
        for (const candidate of sides) {
          const got = evalSql(fragment, candidate);
          if (got !== isMutualMatch(viewer, candidate)) {
            throw new Error(
              `SQL/TS mismatch\nviewer=${JSON.stringify(viewer)}\ncandidate=${JSON.stringify(candidate)}\n` +
                `sql=${dialect.sqlToQuery(fragment).sql}`,
            );
          }
        }
      }
    });

    it('fails closed for an unknown viewer status', () => {
      const viewer = side('MARRIED' as MaritalStatus, false);
      for (const candidate of allSides()) expect(evalSql(mutualMatchSql(viewer), candidate)).toBe(false);
    });
  });
});
