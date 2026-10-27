import { sql, SQL } from 'drizzle-orm';
import { profiles } from '../../db/schema';

/**
 * Two-way marital matching (spec: docs/superpowers/specs/
 * 2026-10-27-marital-status-matching-design.md, "Matching rule").
 *
 * A candidate is shown to a viewer only when each is acceptable to the other.
 * Unanswered status counts as NEVER_MARRIED and unanswered children as none.
 *
 * `isMutualMatch` and `mutualMatchSql` are the same rule written twice (TS for
 * request checks, SQL for browse). They must stay equivalent: the spec checks
 * that over every combination, because a mismatch shows profiles to members
 * who were ruled out.
 */

/** Must match the `MaritalStatus` pgEnum. There is deliberately no married value. */
export type MaritalStatus = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED';

export const MARITAL_STATUSES: readonly MaritalStatus[] = Object.freeze([
  'NEVER_MARRIED',
  'DIVORCED',
  'WIDOWED',
] as const);

export interface MatchSide {
  maritalStatus: MaritalStatus | null;
  hasChildren: boolean | null;
  openToDivorced: boolean;
  openToWidowed: boolean;
  openToChildren: boolean;
}

/** Never married, no children, open to nobody beyond that. Used for anonymous viewers. */
export const DEFAULT_SIDE: MatchSide = Object.freeze({
  maritalStatus: null,
  hasChildren: null,
  openToDivorced: false,
  openToWidowed: false,
  openToChildren: false,
});

/** Picks the matching fields from a profile row, filling defaults for missing ones. */
export function toMatchSide(row: Partial<MatchSide> | null | undefined): MatchSide {
  return {
    maritalStatus: row?.maritalStatus ?? null,
    hasChildren: row?.hasChildren ?? null,
    openToDivorced: row?.openToDivorced ?? false,
    openToWidowed: row?.openToWidowed ?? false,
    openToChildren: row?.openToChildren ?? false,
  };
}

/** True when `person` passes the open-to answers of `openTo`. */
export function isAcceptable(openTo: MatchSide, person: MatchSide): boolean {
  const status = person.maritalStatus ?? 'NEVER_MARRIED';
  const statusOk =
    status === 'NEVER_MARRIED' ||
    (status === 'DIVORCED' && openTo.openToDivorced) ||
    (status === 'WIDOWED' && openTo.openToWidowed);
  const childrenOk = !(person.hasChildren ?? false) || openTo.openToChildren;
  return statusOk && childrenOk;
}

export function isMutualMatch(a: MatchSide, b: MatchSide): boolean {
  return isAcceptable(a, b) && isAcceptable(b, a);
}

/**
 * SQL condition over the candidate `profiles` row, true exactly when
 * `isMutualMatch(viewer, candidate)` is. The viewer's answers only choose the
 * shape of the condition; the only bound values are enum constants.
 */
export function mutualMatchSql(viewer: MatchSide): SQL {
  const candidateStatus = sql`coalesce(${profiles.maritalStatus}, ${'NEVER_MARRIED'}::"MaritalStatus")`;
  const conds: SQL[] = [];

  // Candidate acceptable to the viewer: the viewer's boxes are constants here.
  const allowed: MaritalStatus[] = ['NEVER_MARRIED'];
  if (viewer.openToDivorced) allowed.push('DIVORCED');
  if (viewer.openToWidowed) allowed.push('WIDOWED');
  conds.push(
    sql`(${sql.join(
      allowed.map((s) => sql`${candidateStatus} = ${s}::"MaritalStatus"`),
      sql` or `,
    )})`,
  );
  if (!viewer.openToChildren) {
    conds.push(sql`coalesce(${profiles.hasChildren}, false) = false`);
  }

  // Viewer acceptable to the candidate: the viewer's own answers pick which of
  // the candidate's boxes must be ticked.
  switch (viewer.maritalStatus ?? 'NEVER_MARRIED') {
    case 'NEVER_MARRIED':
      break;
    case 'DIVORCED':
      conds.push(sql`coalesce(${profiles.openToDivorced}, false) = true`);
      break;
    case 'WIDOWED':
      conds.push(sql`coalesce(${profiles.openToWidowed}, false) = true`);
      break;
    default:
      // Unknown status: match nobody, as isAcceptable does.
      return sql`false`;
  }
  if (viewer.hasChildren ?? false) {
    conds.push(sql`coalesce(${profiles.openToChildren}, false) = true`);
  }

  return sql`(${sql.join(conds, sql` and `)})`;
}
