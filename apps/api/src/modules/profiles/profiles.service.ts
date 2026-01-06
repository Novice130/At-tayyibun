import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EncryptionService } from "../../services/encryption.service";
import { AvatarService } from "../../services/avatar.service";
import { Gender } from "@prisma/client";

export interface BrowseFilters {
  ethnicity?: string;
  gender?: Gender;
  minAge?: number;
  maxAge?: number;
  sortBy?: "age" | "createdAt" | "rankBoost";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly avatarService: AvatarService
  ) {}

  /**
   * Browse profiles with filters and pagination
   * Only returns public info + AI avatar
   */
  async browseProfiles(filters: BrowseFilters, viewerId?: string) {
    const {
      ethnicity,
      gender,
      minAge,
      maxAge,
      sortBy = "rankBoost",
      order = "desc",
      page = 1,
      limit = 20,
    } = filters;

    const where: Record<string, unknown> = {
      profileComplete: true,
    };

    if (ethnicity) {
      where.ethnicity = ethnicity;
    }

    if (gender) {
      where.gender = gender;
    }

    // Age filtering based on DOB
    if (minAge || maxAge) {
      const today = new Date();
      if (maxAge) {
        const minDob = new Date(
          today.getFullYear() - maxAge - 1,
          today.getMonth(),
          today.getDate()
        );
        where.dob = { ...((where.dob as object) || {}), gte: minDob };
      }
      if (minAge) {
        const maxDob = new Date(
          today.getFullYear() - minAge,
          today.getMonth(),
          today.getDate()
        );
        where.dob = { ...((where.dob as object) || {}), lte: maxDob };
      }
    }

    // Get profiles
    const profiles = await this.prisma.profile.findMany({
      where,
      include: {
        user: {
          select: {
            publicId: true,
            rankBoost: true,
            membershipTier: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        ...(sortBy === "rankBoost" ? { user: { rankBoost: order } } : {}),
        ...(sortBy === "age" ? { dob: order === "asc" ? "desc" : "asc" } : {}),
        ...(sortBy === "createdAt" ? { user: { createdAt: order } } : {}),
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get total count
    const total = await this.prisma.profile.count({ where });

    // Map to public view
    const publicProfiles = profiles.map((profile) => ({
      publicId: profile.user.publicId,
      firstName: profile.firstName,
      age: this.calculateAge(profile.dob),
      gender: profile.gender,
      ethnicity: profile.ethnicity,
      city: profile.city,
      state: profile.state,
      avatarUrl: this.avatarService.getAvatarDisplay(
        profile.userId,
        profile.gender
      ),
      bio:
        profile.publicFields &&
        typeof profile.publicFields === "object" &&
        "bio" in profile.publicFields
          ? (profile.publicFields as any)["bio"]
          : null,
      membershipTier: profile.user.membershipTier,
    }));

    return {
      data: publicProfiles,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single profile by public ID
   */
  async getProfileByPublicId(publicId: string, isAuthenticated: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { publicId },
      include: {
        profile: true,
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundException("Profile not found");
    }

    const profile = user.profile;

    // Public view (unauthenticated or minimal view)
    const publicData = {
      publicId: user.publicId,
      firstName: profile.firstName,
      age: this.calculateAge(profile.dob),
      gender: profile.gender,
      ethnicity: profile.ethnicity,
      city: profile.city,
      state: profile.state,
      avatarUrl: this.avatarService.getAvatarDisplay(
        profile.userId,
        profile.gender
      ),
      bio:
        profile.publicFields &&
        typeof profile.publicFields === "object" &&
        "bio" in profile.publicFields
          ? (profile.publicFields as any)["bio"]
          : null,
      profileComplete: profile.profileComplete,
    };

    // If not authenticated, return minimal info
    if (!isAuthenticated) {
      return {
        ...publicData,
        isFullView: false,
      };
    }

    // Authenticated view - slightly more info but still no contact details
    return {
      ...publicData,
      membershipTier: user.membershipTier,
      isFullView: true,
    };
  }

  /**
   * Get current user's own profile (full access)
   */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        photos: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const profile = user.profile;

    // Decrypt sensitive fields
    let lastName = "";
    let biodata = {};

    if (profile?.lastNameEnc) {
      try {
        lastName = this.encryptionService.decrypt(profile.lastNameEnc);
      } catch {
        lastName = "";
      }
    }

    if (profile?.biodataJsonEnc) {
      try {
        biodata = this.encryptionService.decryptJson(profile.biodataJsonEnc);
      } catch {
        biodata = {};
      }
    }

    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      phone: user.phone,
      role: user.role,
      membershipTier: user.membershipTier,
      isVerified: user.isVerified,
      isPhoneVerified: user.isPhoneVerified,
      profile: profile
        ? {
            firstName: profile.firstName,
            lastName,
            dob: profile.dob,
            age: this.calculateAge(profile.dob),
            gender: profile.gender,
            ethnicity: profile.ethnicity,
            city: profile.city,
            state: profile.state,
            bio: profile.bioEnc
              ? this.encryptionService.decrypt(profile.bioEnc)
              : null,
            biodata,
            profileComplete: profile.profileComplete,
          }
        : null,
      photos: user.photos.map((p) => ({
        id: p.id,
        type: p.type,
        isPrimary: p.isPrimary,
        visibility: p.visibility,
      })),
    };
  }

  /**
   * Update current user's profile
   */
  async updateMyProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      dob?: Date;
      gender?: Gender;
      ethnicity?: string;
      city?: string;
      state?: string;
      bio?: string;
      biodata?: Record<string, unknown>;
    }
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Encrypt sensitive fields
    const updateData: Record<string, unknown> = {};

    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName)
      updateData.lastNameEnc = this.encryptionService.encrypt(data.lastName);
    if (data.dob) updateData.dob = data.dob;
    if (data.gender) updateData.gender = data.gender;
    if (data.ethnicity) updateData.ethnicity = data.ethnicity;
    if (data.city) updateData.city = data.city;
    if (data.state) updateData.state = data.state;
    if (data.bio) updateData.bioEnc = this.encryptionService.encrypt(data.bio);
    if (data.biodata)
      updateData.biodataJsonEnc = this.encryptionService.encryptJson(
        data.biodata
      );

    // Check if profile is complete
    const isComplete = !!(
      data.firstName ||
      (user.profile?.firstName && data.lastName) ||
      (user.profile?.lastNameEnc && data.dob) ||
      (user.profile?.dob && data.ethnicity) ||
      user.profile?.ethnicity
    );

    updateData.profileComplete = isComplete;

    // Update public fields (non-sensitive data that can be shown publicly)
    updateData.publicFields = {
      bio: data.bio ? data.bio.substring(0, 200) : null, // Truncated for public view
    };

    await this.prisma.profile.update({
      where: { userId },
      data: updateData,
    });

    return this.getMyProfile(userId);
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  }
}
