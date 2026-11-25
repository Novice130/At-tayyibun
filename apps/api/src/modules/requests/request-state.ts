import { RequestStatus } from '../../common/types/role';

/** How long after approval the requester may reveal the shared contact. */
export const CONTACT_LINK_TTL_DAYS = 7;

type RequestRow = {
  status: string;
  expiresAt: string;
  requesterId?: string;
  targetId?: string;
};

/** A pending request past its response window. Expiry is applied lazily. */
export function isStalePending(row: RequestRow, now = new Date()): boolean {
  return row.status === RequestStatus.PENDING && now > new Date(row.expiresAt);
}

export function isLivePending(row: RequestRow, now = new Date()): boolean {
  return row.status === RequestStatus.PENDING && !isStalePending(row, now);
}

/** A live request keeps both sides reachable; a declined or expired one does not. */
export function isLiveRequest(row: RequestRow, now = new Date()): boolean {
  return row.status === RequestStatus.APPROVED || isLivePending(row, now);
}

/**
 * Full bio and biodata unlock for both sides on approval. Before that, only the
 * receiver sees the sender's: sending a request is the sender opening up.
 */
export function grantsFullView(row: RequestRow, viewerId: string, ownerId: string, now = new Date()): boolean {
  if (row.status === RequestStatus.APPROVED) return true;
  return isLivePending(row, now) && row.requesterId === ownerId && row.targetId === viewerId;
}

export type ContactState = 'AVAILABLE' | 'VIEWED' | 'EXPIRED' | 'EMAILED';

/** Where an approved request's contact stands. Null when not approved. */
export function contactStateOf(
  row: { status: string; contactExpiresAt?: string | null; tokenUsedAt?: string | null },
  now = new Date(),
): ContactState | null {
  if (row.status !== RequestStatus.APPROVED) return null;
  // Approved before the link existed: the details went out by email.
  if (!row.contactExpiresAt) return 'EMAILED';
  if (row.tokenUsedAt) return 'VIEWED';
  return now > new Date(row.contactExpiresAt) ? 'EXPIRED' : 'AVAILABLE';
}
