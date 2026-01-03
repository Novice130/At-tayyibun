import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { CreateProfileDto, UpdateProfileDto, ProfileFiltersDto } from './dto/profile.dto';
import { User, Profile, Gender } from '@prisma/client';

@Injectable()
export class ProfilesService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  /**
   * Create or update user profile
   */
  async createProfile(userId: string, dto: CreateProfileDto): Promise<Profile> {
    // Encrypt sensitive fields
    const encryptedData = {
      lastName: this.encryption.encrypt(dto.lastName),
      dateOfBirth: this.encryption.encrypt(dto.dateOfBirth),
      biodata: this.encryption.encryptObject(dto.biodata || {}),
      customFields: dto.customFields ? this.encryption.encryptObject(dto.customFields) : '{}',
    };

    // Calculate age range from DOB
    const dob = new Date(dto.dateOfBirth);
    const age = this.calculateAge(dob);

    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        firstName: dto.firstName,
        gender: dto.gender,
        ethnicity: dto.ethnicity,
        city: dto.city,
        state: dto.state,
        ageRangeMin: age,
        ageRangeMax: age,
        ...encryptedData,
        isComplete: true,
      },
      update: {
        firstName: dto.firstName,
        gender: dto.gender,
        ethnicity: dto.ethnicity,
        city: dto.city,
        state: dto.state,
        ageRangeMin: age,
        ageRangeMax: age,
        ...encryptedData,
        isComplete: true,
      },
    });

    return profile;
  }

  /**
   * Update profile
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Profile not found');
    }

    const updateData: any = {};

    // Public fields
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.ethnicity) updateData.ethnicity = dto.ethnicity;
    if (dto.city) updateData.city = dto.city;
    if (dto.state) updateData.state = dto.state;

    // Encrypted fields
    if (dto.lastName) {
      updateData.lastName = this.encryption.encrypt(dto.lastName);
    }
    if (dto.dateOfBirth) {
      updateData.dateOfBirth = this.encryption.encrypt(dto.dateOfBirth);
      const age = this.calculateAge(new Date(dto.dateOfBirth));
      updateData.ageRangeMin = age;
      updateData.ageRangeMax = age;
    }
    if (dto.biodata) {
      updateData.biodata = this.encryption.encryptObject(dto.biodata);
    }
    if (dto.customFields) {
      updateData.customFields = this.encryption.encryptObject(dto.customFields);
    }

    return this.prisma.profile.update({
      where: { userId },
      data: updateData,
    });
  }

  /**
   * Get profile by user ID (full data for owner)
   */
  async getMyProfile(userId: string): Promise<any> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            publicId: true,
            email: true,
            phone: true,
            membershipTier: true,
          },
        },
      },
    });

    if (!profile) {
      return null;
    }

    // Decrypt sensitive fields for owner
    return {
      ...profile,
      lastName: this.encryption.decrypt(profile.lastName),
      dateOfBirth: this.encryption.decrypt(profile.dateOfBirth),
      biodata: this.encryption.decryptObject(profile.biodata),
      customFields: this.encryption.decryptObject(profile.customFields as string),
    };
  }

  /**
   * Get public profile by public ID (limited data)
   */
  async getPublicProfile(publicId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { publicId },
      include: {
        profile: true,
        photos: {
          where: {
            type: 'AI_AVATAR',
            isPublic: true,
          },
          take: 1,
        },
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundException('Profile not found');
    }

    // Return only public fields
    return {
      publicId: user.publicId,
      firstName: user.profile.firstName,
      gender: user.profile.gender,
      ethnicity: user.profile.ethnicity,
      city: user.profile.city,
      state: user.profile.state,
      ageRange: `${user.profile.ageRangeMin}-${user.profile.ageRangeMax}`,
      avatar: user.photos[0]?.gcsPathThumb || null,
    };
  }

  /**
   * Browse profiles with filters (authenticated users)
   */
  async browseProfiles(
    currentUserId: string,
    filters: ProfileFiltersDto,
  ): Promise<{ profiles: any[]; total: number; page: number; pageSize: number }> {
    const { page = 1, pageSize = 20, ethnicity, gender, minAge, maxAge, sortBy = 'rankBoost' } = filters;

    // Get skipped profile IDs
    const skipped = await this.prisma.skipReason.findMany({
      where: { requesterId: currentUserId },
      select: { targetId: true },
    });
    const skippedIds = skipped.map(s => s.targetId);

    // Build where clause
    const where: any = {
      userId: {
        not: currentUserId,
        notIn: skippedIds,
      },
      isComplete: true,
      user: {
        isActive: true,
      },
    };

    if (ethnicity) {
      where.ethnicity = ethnicity;
    }
    if (gender) {
      where.gender = gender;
    }
    if (minAge) {
      where.ageRangeMin = { gte: minAge };
    }
    if (maxAge) {
      where.ageRangeMax = { lte: maxAge };
    }

    // Get total count
    const total = await this.prisma.profile.count({ where });

    // Get profiles
    const profiles = await this.prisma.profile.findMany({
      where,
      include: {
        user: {
          select: {
            publicId: true,
            rankBoost: true,
            membershipTier: true,
            photos: {
              where: {
                type: 'AI_AVATAR',
                isPublic: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: sortBy === 'age' 
        ? { ageRangeMin: 'asc' }
        : { user: { rankBoost: 'desc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Return public fields only
    const publicProfiles = profiles.map(p => ({
      publicId: p.user.publicId,
      firstName: p.firstName,
      gender: p.gender,
      ethnicity: p.ethnicity,
      city: p.city,
      state: p.state,
      ageRange: `${p.ageRangeMin}-${p.ageRangeMax}`,
      avatar: p.user.photos[0]?.gcsPathThumb || null,
      membershipTier: p.user.membershipTier,
    }));

    return {
      profiles: publicProfiles,
      total,
      page,
      pageSize,
    };
  }

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
