import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DrizzleService } from '../../db/drizzle.service';
import { profiles, users, blocks, infoRequests } from '../../db/schema';
import { EncryptionService } from '../../services/encryption.service';
import { AvatarService } from '../../services/avatar.service';
import { AuditService } from '../../services/audit.service';
import {
  DEFAULT_SIDE,
  hasCompleteProfile,
  isMutualMatch,
  MaritalStatus,
  mutualMatchSql,
  toMatchSide,
} from './marital-match';
import { Gender } from '../../common/types/role';

export interface BrowseFilters {
  ethnicity?: string;
  gender?: Gender;
  minAge?: number;
  maxAge?: number;
  sortBy?: 'age' | 'createdAt' | 'rankBoost';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Biodata keys safe to show to other members. The encrypted blob also holds
 * guardian* details captured at signup and nikahIntent (a private consent
 * flag) — those must never leave the owner's own view.
 */
const PUBLIC_BIODATA_KEYS = [
  'legalStatus',
  'education',
  'profession',
  'relocate',
  'religiousPractice',
  'prayerFrequency',
  'dietaryPreference',
  'sect',
  'partnerPreferences',
  'dealBreakers',
] as const;

/**
 * Private marital-status answers. Owner view only: never add these to
 * publicFields, PUBLIC_BIODATA_KEYS, browse or the public profile view.
 */
const MARITAL_KEYS = [
  'maritalStatus',
  'hasChildren',
  'childrenCount',
  'openToDivorced',
  'openToWidowed',
  'openToChildren',
] as const;

/** The columns the two-way matching rule reads. */
const MATCH_COLUMNS = {
  maritalStatus: profiles.maritalStatus,
  hasChildren: profiles.hasChildren,
  openToDivorced: profiles.openToDivorced,
  openToWidowed: profiles.openToWidowed,
  openToChildren: profiles.openToChildren,
};

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly encryptionService: EncryptionService,
    private readonly avatarService: AvatarService,
    private readonly auditService: AuditService,
  ) {}

  async browseProfiles(filters: BrowseFilters, viewerId?: string) {
    const {
      ethnicity,
      gender,
      minAge,
      maxAge,
      sortBy = 'rankBoost',
      order = 'desc',
      page = 1,
      limit = 20,
    } = filters;

    let targetGender: Gender | undefined = gender;
    // Anonymous viewers count as never married, no children, open to nobody
    // else: they only ever see profiles that everyone may see.
    let viewerSide = DEFAULT_SIDE;

    // Strict Islamic Matrimony Gender Filtering:
    // If viewer is authenticated, look up their gender and strictly enforce opposite gender.
    // Brothers only ever see Sisters, and Sisters only ever see Brothers.
    if (viewerId && viewerId.trim()) {
      const [viewerProfile] = await this.drizzle.db
        .select({ gender: profiles.gender, profileComplete: profiles.profileComplete, ...MATCH_COLUMNS })
        .from(profiles)
        .where(eq(profiles.userId, viewerId))
        .limit(1);

      // Without their own answers the two-way rule cannot protect the members
      // they would see, so an incomplete viewer does not browse at all.
      if (!hasCompleteProfile(viewerProfile)) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'PROFILE_INCOMPLETE',
          message: 'Please complete your profile to browse.',
        });
      }

      viewerSide = toMatchSide(viewerProfile);
      if (viewerProfile.gender) {
        targetGender = viewerProfile.gender === 'MALE' ? Gender.FEMALE : Gender.MALE;
      }
    }

    // Fall back to FEMALE if no gender is known, guaranteeing no mixed results
    if (!targetGender) {
      targetGender = Gender.FEMALE;
    }

    // mutualMatchSql references the unaliased `profiles` table, so both the
    // page and the count query below must select from `profiles` directly.
    const conds: SQL[] = [
      eq(profiles.profileComplete, true),
      eq(profiles.gender, targetGender),
      mutualMatchSql(viewerSide),
    ];
    if (ethnicity && ethnicity.trim() && ethnicity !== 'All Ethnicities' && ethnicity !== 'Any') {
      const eth = ethnicity.trim();
      conds.push(sql`(LOWER(${profiles.ethnicity}) = LOWER(${eth}) OR ${profiles.ethnicity} ILIKE ${'%' + eth + '%'})`);
    }

    // Exclude caller's own profile and respect blocks if viewerId is present
    if (viewerId && viewerId.trim()) {
      conds.push(sql`${profiles.userId} <> ${viewerId}::uuid`);
      conds.push(sql`NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = ${profiles.userId})
           OR (b.blocker_id = ${profiles.userId} AND b.blocked_id = ${viewerId}::uuid)
      )`);
    }

    if (minAge !== undefined && minAge !== null && !isNaN(minAge)) {
      conds.push(sql`DATE_PART('year', AGE(CURRENT_DATE, ${profiles.dob})) >= ${minAge}`);
    }
    if (maxAge !== undefined && maxAge !== null && !isNaN(maxAge)) {
      conds.push(sql`DATE_PART('year', AGE(CURRENT_DATE, ${profiles.dob})) <= ${maxAge}`);
    }

    const whereClause = and(...conds);
    const dir = order === 'desc' ? desc : asc;
    const ageDir = order === 'asc' ? desc : asc;

    const orderBy =
      sortBy === 'age'
        ? [ageDir(profiles.dob)]
        : sortBy === 'createdAt'
          ? [dir(users.createdAt)]
          : [dir(users.rankBoost)];

    const db = this.drizzle.db;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          profile: profiles,
          user: {
            publicId: users.publicId,
            image: users.image,
            rankBoost: users.rankBoost,
            membershipTier: users.membershipTier,
            createdAt: users.createdAt,
          },
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ value: sql<number>`COUNT(*)` }).from(profiles).where(whereClause),
    ]);

    const data = rows.map(({ profile, user }) => {
      const pf = (profile.publicFields && typeof profile.publicFields === 'object') ? (profile.publicFields as any) : {};
      const nameHidden = !!pf['hideName'];
      return {
        publicId: user.publicId,
        firstName: nameHidden ? null : profile.firstName,
        age: this.calculateAgeFromString(profile.dob),
        gender: profile.gender,
        ethnicity: profile.ethnicity,
        city: profile.city,
        state: profile.state,
        avatarUrl: user.image?.trim()
          ? user.image
          : this.avatarService.getAvatarDisplay(profile.userId, profile.gender),
        bio: 'bio' in pf ? pf['bio'] : null,
        membershipTier: user.membershipTier,
      };
    });

    const total = Number(totalRow.value);
    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getProfileByPublicId(publicId: string, isAuthenticated: boolean, viewerId?: string) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.publicId, publicId),
      with: { profiles: true },
    });
    if (!user) throw new NotFoundException('Profile not found');

    const profile = Array.isArray((user as any).profiles) ? (user as any).profiles[0] : (user as any).profiles;
    if (!profile) throw new NotFoundException('Profile not found');

    // A blocked viewer gets a 404, not 403 — "you are blocked" leaks that the
    // user exists and is itself information. Hide, don't announce.
    if (viewerId && viewerId !== user.id) {
      const [blockRow] = await this.drizzle.db
        .select({ id: blocks.id })
        .from(blocks)
        .where(
          sql`(${blocks.blockerId} = ${viewerId} AND ${blocks.blockedId} = ${user.id})
              OR (${blocks.blockerId} = ${user.id} AND ${blocks.blockedId} = ${viewerId})`,
        )
        .limit(1);
      if (blockRow) throw new NotFoundException('Profile not found');

      // Two-way matching: someone who ruled the viewer out (or whom the viewer
      // ruled out) gets the same 404 as a block. An info request between them,
      // in either direction and any status, keeps links from the requests
      // page working after either side changes their answers.
      const [viewerProfile] = await this.drizzle.db
        .select(MATCH_COLUMNS)
        .from(profiles)
        .where(eq(profiles.userId, viewerId))
        .limit(1);
      if (!isMutualMatch(toMatchSide(viewerProfile), toMatchSide(profile))) {
        const [requestRow] = await this.drizzle.db
          .select({ id: infoRequests.id })
          .from(infoRequests)
          .where(
            sql`(${infoRequests.requesterId} = ${viewerId} AND ${infoRequests.targetId} = ${user.id})
                OR (${infoRequests.requesterId} = ${user.id} AND ${infoRequests.targetId} = ${viewerId})`,
          )
          .limit(1);
        if (!requestRow) throw new NotFoundException('Profile not found');
      }
    }

    // The full bio is members-only. Anonymous visitors get the 200-character
    // preview stored in publicFields, same as browse.
    let fullBio: string | null = null;
    if (isAuthenticated && profile.bioEnc) {
      try {
        fullBio = this.encryptionService.decrypt(profile.bioEnc);
      } catch {
        /* keep null */
      }
    }

    let biodata: Record<string, unknown> = {};
    if (profile.biodataJsonEnc) {
      try {
        biodata = this.encryptionService.decryptJson(profile.biodataJsonEnc);
      } catch {
        /* keep empty */
      }
    }
    const publicBiodata = Object.fromEntries(
      PUBLIC_BIODATA_KEYS.map((k) => [k, biodata[k]] as const).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
      ),
    );

    const pf = (profile.publicFields && typeof profile.publicFields === 'object') ? (profile.publicFields as any) : {};
    const nameHidden = !!pf['hideName'];
    const publicData = {
      publicId: user.publicId,
      firstName: nameHidden ? null : profile.firstName,
      age: this.calculateAgeFromString(profile.dob),
      gender: profile.gender,
      ethnicity: profile.ethnicity,
      city: profile.city,
      state: profile.state,
      avatarUrl: user.image?.trim()
        ? user.image
        : this.avatarService.getAvatarDisplay(profile.userId, profile.gender),
      bio: fullBio || ('bio' in pf ? pf['bio'] : null),
      profileComplete: profile.profileComplete,
    };

    if (!isAuthenticated) return { ...publicData, isFullView: false };
    return {
      ...publicData,
      biodata: publicBiodata,
      membershipTier: user.membershipTier,
      isFullView: true,
    };
  }

  async getMyProfile(userId: string) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { profiles: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const profile = Array.isArray((user as any).profiles) ? (user as any).profiles[0] ?? null : (user as any).profiles ?? null;

    let lastName = '';
    let biodata: Record<string, unknown> = {};
    if (profile?.lastNameEnc) {
      try { lastName = this.encryptionService.decrypt(profile.lastNameEnc); } catch { /* keep empty */ }
    }
    if (profile?.biodataJsonEnc) {
      try { biodata = this.encryptionService.decryptJson(profile.biodataJsonEnc); } catch { /* keep empty */ }
    }

    let bio: string | null = null;
    if (profile?.bioEnc) {
      // Match the tolerance used for lastName/biodata above — an undecryptable
      // blob should blank one field, not 500 the whole profile page.
      try { bio = this.encryptionService.decrypt(profile.bioEnc); } catch { /* keep null */ }
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
      image: user.image ?? null,
      profile: profile
        ? {
            firstName: profile.firstName,
            lastName,
            dob: profile.dob,
            age: this.calculateAgeFromString(profile.dob),
            gender: profile.gender,
            ethnicity: profile.ethnicity,
            city: profile.city,
            state: profile.state,
            bio,
            biodata,
            profileComplete: profile.profileComplete,
            maritalStatus: profile.maritalStatus ?? null,
            hasChildren: profile.hasChildren ?? null,
            childrenCount: profile.childrenCount ?? null,
            openToDivorced: profile.openToDivorced ?? false,
            openToWidowed: profile.openToWidowed ?? false,
            openToChildren: profile.openToChildren ?? false,
          }
        : null,
    };
  }

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
      maritalStatus?: MaritalStatus;
      hasChildren?: boolean;
      childrenCount?: number | null;
      openToDivorced?: boolean;
      openToWidowed?: boolean;
      openToChildren?: boolean;
    },
  ) {
    try {
      const db = this.drizzle.db;
      const [existingProfile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

      // Age gate (App Store 1.1.4 + 2.3.x): matrimony is 18+. The client caps
      // its date picker, but the server enforces it too — a curl request must
      // not be able to create an under-18 profile.
      if (data.dob !== undefined && this.calculateAgeFromString(data.dob) < 18) {
        throw new BadRequestException('You must be at least 18 years old to use At-Tayyibun.');
      }

      // Guard on `!== undefined`, not truthiness: a truthiness check makes an
      // empty string a no-op, so a user could never clear a field they had
      // already filled in.
      const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) {
        updateData.lastNameEnc = data.lastName ? this.encryptionService.encrypt(data.lastName) : '';
      }
      if (data.dob !== undefined) updateData.dob = data.dob.toISOString().slice(0, 10);
      if (data.gender !== undefined) updateData.gender = data.gender;
      if (data.ethnicity !== undefined) updateData.ethnicity = data.ethnicity;
      if (data.city !== undefined) updateData.city = data.city || null;
      if (data.state !== undefined) updateData.state = data.state || null;
      if (data.bio !== undefined) {
        updateData.bioEnc = data.bio ? this.encryptionService.encrypt(data.bio) : null;
      }
      if (data.biodata !== undefined) {
        updateData.biodataJsonEnc = this.encryptionService.encryptJson(data.biodata);
      }

      // Marital answers. Columns are only written when sent, so a partial PUT
      // (the signup seed) leaves stored answers alone. children_count is kept
      // only while the resulting hasChildren is true.
      if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus;
      if (data.hasChildren !== undefined) updateData.hasChildren = data.hasChildren;
      if (data.openToDivorced !== undefined) updateData.openToDivorced = data.openToDivorced;
      if (data.openToWidowed !== undefined) updateData.openToWidowed = data.openToWidowed;
      if (data.openToChildren !== undefined) updateData.openToChildren = data.openToChildren;
      // Use the value actually being stored: `??` would fall back to the stored
      // answer when null is sent, so a cleared answer could still look complete.
      const effectiveHasChildren =
        data.hasChildren !== undefined ? data.hasChildren : (existingProfile?.hasChildren ?? null);
      const effectiveMaritalStatus =
        data.maritalStatus !== undefined ? data.maritalStatus : (existingProfile?.maritalStatus ?? null);
      if (effectiveHasChildren !== true) {
        if (data.childrenCount !== undefined || data.hasChildren !== undefined) updateData.childrenCount = null;
      } else if (data.childrenCount !== undefined) {
        updateData.childrenCount = data.childrenCount;
      }
      const maritalKeysSent = MARITAL_KEYS.filter((k) => data[k] !== undefined);

      // Profile is complete when every required field is present after this update.
      const after = {
        firstName: data.firstName ?? existingProfile?.firstName,
        lastName: data.lastName ?? existingProfile?.lastNameEnc,
        dob: data.dob ?? existingProfile?.dob,
        gender: data.gender ?? existingProfile?.gender,
        ethnicity: data.ethnicity ?? existingProfile?.ethnicity,
        bio: data.bio ?? existingProfile?.bioEnc,
        maritalStatus: effectiveMaritalStatus,
        hasChildren: effectiveHasChildren,
      };
      const isComplete = !!(
        after.firstName && after.lastName && after.dob && after.gender && after.ethnicity && after.bio &&
        after.maritalStatus && after.hasChildren !== null && after.hasChildren !== undefined
      );
      updateData.profileComplete = isComplete;

      // Merge into the stored publicFields rather than replacing it. A partial
      // PUT (e.g. the signup seed, which sends only firstName + gender) used to
      // wipe the public bio and reset both privacy flags to false, so a saved
      // profile would silently lose its bio on browse and un-hide the user's
      // name and location.
      const existingPublicFields =
        existingProfile?.publicFields && typeof existingProfile.publicFields === 'object'
          ? (existingProfile.publicFields as Record<string, unknown>)
          : {};
      const publicFields: Record<string, unknown> = { ...existingPublicFields };
      if (data.bio !== undefined) {
        publicFields.bio = data.bio ? data.bio.substring(0, 200) : null;
      }
      if (data.biodata !== undefined) {
        if (data.biodata.hideName !== undefined) publicFields.hideName = !!data.biodata.hideName;
      }
      // Location is always visible to other members now, so never persist a
      // hide flag — and clear any stale `true` left over from before.
      publicFields.hideLocation = false;
      publicFields.hideName = publicFields.hideName ?? false;
      publicFields.bio = publicFields.bio ?? null;
      updateData.publicFields = publicFields;

      if (existingProfile) {
        await db.update(profiles).set(updateData).where(eq(profiles.userId, userId));
      } else {
        await db.insert(profiles).values({
          id: randomUUID(),
          userId,
          firstName: (data.firstName ?? '') as string,
          lastNameEnc: (updateData.lastNameEnc as string) ?? '',
          dob: (updateData.dob as string) ?? new Date().toISOString().slice(0, 10),
          gender: (data.gender as any) ?? 'MALE',
          ethnicity: data.ethnicity ?? '',
          city: data.city ?? null,
          state: data.state ?? null,
          bioEnc: (updateData.bioEnc as string) ?? null,
          biodataJsonEnc: (updateData.biodataJsonEnc as string) ?? null,
          publicFields: updateData.publicFields as any,
          maritalStatus: data.maritalStatus ?? null,
          hasChildren: data.hasChildren ?? null,
          childrenCount: (updateData.childrenCount as number | null | undefined) ?? null,
          openToDivorced: data.openToDivorced ?? false,
          openToWidowed: data.openToWidowed ?? false,
          openToChildren: data.openToChildren ?? false,
          profileComplete: isComplete,
          updatedAt: new Date().toISOString(),
        });
      }

      // Which answers changed, never their values: these are private. The
      // profile is already saved, so a failed audit write must not turn the
      // response into an error; log that it failed, without the error text
      // (a driver error can echo query params).
      if (maritalKeysSent.length > 0) {
        try {
          await this.auditService.log({
            userId,
            action: 'profile.marital_prefs_updated',
            resourceType: 'profile',
            metadata: { fields: maritalKeysSent },
          });
        } catch (auditError) {
          const kind = auditError instanceof Error ? auditError.name : 'unknown error';
          this.logger.warn(`Audit entry profile.marital_prefs_updated was not written (${kind})`);
        }
      }

      return await this.getMyProfile(userId);
    } catch (error) {
      console.error('[ProfilesService] updateMyProfile FAILED for userId:', userId);
      console.error('[ProfilesService] Error:', error);
      throw error;
    }
  }

  private calculateAgeFromString(dob: string | Date): number {
    if (!dob) return 0;
    if (typeof dob === 'string') {
      const parts = dob.slice(0, 10).split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [year, month, day] = parts;
        const today = new Date();
        let age = today.getFullYear() - year;
        const monthDiff = (today.getMonth() + 1) - month;
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
        return Math.max(0, age);
      }
    }
    const d = typeof dob === 'string' ? new Date(dob) : dob;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const monthDiff = today.getMonth() - d.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age--;
    return Math.max(0, age);
  }
}
