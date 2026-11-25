/** Same codes and labels as the mobile app and the API's ReportDto. */
export const REPORT_REASONS = [
  { code: 'FAKE_PROFILE', label: 'Fake profile' },
  { code: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { code: 'HARASSMENT', label: 'Harassment' },
  { code: 'SPAM_OR_SCAM', label: 'Spam or scam' },
  { code: 'UNDERAGE', label: 'Underage user' },
  { code: 'OTHER', label: 'Other' },
] as const;

export type ReportReasonCode = (typeof REPORT_REASONS)[number]['code'];

export const REPORT_DETAILS_MAX = 500;

export function reportReasonLabel(code: string): string {
  return REPORT_REASONS.find((r) => r.code === code)?.label ?? code;
}

export function reportPayload(targetPublicId: string, reason: ReportReasonCode, details: string) {
  const trimmed = details.trim().slice(0, REPORT_DETAILS_MAX);
  return { targetPublicId, reason, ...(trimmed ? { details: trimmed } : {}) };
}

/** One row of GET /blocks. Deliberately has no email: the list must not show one. */
export interface BlockedMember {
  targetPublicId: string;
  name?: string | null;
  createdAt?: string;
}

export function blockedMemberLabel(member: BlockedMember): string {
  return member.name?.trim() || member.targetPublicId;
}
