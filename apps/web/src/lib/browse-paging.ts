/** Mirrors MAX_BROWSE_PAGE in the API's profiles DTO. */
export const MAX_BROWSE_PAGE = 500;

/** The ?page= value from a query string. Anything unusable means page 1. */
export function pageFromSearch(search: string): number {
  const raw = new URLSearchParams(search).get('page');
  if (raw === null || !/^\d+$/.test(raw)) return 1;
  return Math.min(Math.max(1, Number(raw)), MAX_BROWSE_PAGE);
}

/** How many pages the UI may offer: the API clamps anything past its cap. */
export function reachablePages(apiPages: number): number {
  return Math.min(Math.max(0, apiPages || 0), MAX_BROWSE_PAGE);
}

/**
 * The page to refetch when one came back empty (members left, or a stale link),
 * or null when the empty result is the real answer.
 */
export function pageToRecoverTo(requested: number, returned: number, apiPages: number): number | null {
  const last = reachablePages(apiPages);
  return returned === 0 && requested > 1 && last >= 1 && requested > last ? last : null;
}
