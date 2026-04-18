export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const MembershipTier = {
  FREE: 'FREE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
} as const;

export type MembershipTier = (typeof MembershipTier)[keyof typeof MembershipTier];

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export const PhotoType = {
  AI_AVATAR: 'AI_AVATAR',
  REAL_PHOTO: 'REAL_PHOTO',
} as const;

export type PhotoType = (typeof PhotoType)[keyof typeof PhotoType];

export const PhotoVisibility = {
  PRIVATE: 'PRIVATE',
  APPROVED_ONLY: 'APPROVED_ONLY',
} as const;

export type PhotoVisibility = (typeof PhotoVisibility)[keyof typeof PhotoVisibility];

export const RequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  EXPIRED: 'EXPIRED',
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const CampaignStatus = {
  DRAFT: 'DRAFT',
  SENDING: 'SENDING',
  SENT: 'SENT',
} as const;

export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];
