// Shared types between frontend and backend

// ============ USER & AUTH ============
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type MembershipTier = 'FREE' | 'SILVER' | 'GOLD';
export type Gender = 'MALE' | 'FEMALE';

export interface UserPublic {
  publicId: string;
  firstName: string;
  membershipTier: MembershipTier;
}

// ============ PROFILE ============
export interface ProfilePublic {
  publicId: string;
  firstName: string;
  gender: Gender;
  ethnicity: string;
  city: string;
  state: string;
  ageRange: string;
  avatarUrl?: string;
  membershipTier: MembershipTier;
}

export interface ProfileFull extends ProfilePublic {
  lastName: string;
  dateOfBirth: string;
  biodata: Record<string, any>;
  phone?: string;
  email?: string;
}

// ============ REQUESTS ============
export type RequestStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
export type AllowedShareType = 'NONE' | 'PHOTO_ONLY' | 'PHONE_EMAIL' | 'ALL';

export interface InfoRequest {
  id: string;
  status: RequestStatus;
  requestedPhoto: boolean;
  requestedPhone: boolean;
  requestedEmail: boolean;
  allowedShares: AllowedShareType;
  expiresAt: string;
  createdAt: string;
}

// ============ API RESPONSES ============
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

// ============ FILTERS ============
export interface BrowseFilters {
  page?: number;
  pageSize?: number;
  ethnicity?: string;
  gender?: Gender;
  minAge?: number;
  maxAge?: number;
  sortBy?: 'rankBoost' | 'age';
}

// ============ VALIDATION ============
export const US_PHONE_REGEX = /^\+1[0-9]{10}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
] as const;

export const ETHNICITIES = [
  'Arab',
  'South Asian',
  'African American',
  'Southeast Asian',
  'European',
  'Latino/Hispanic',
  'Mixed/Other',
] as const;
