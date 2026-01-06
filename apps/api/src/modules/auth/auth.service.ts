import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../services/audit.service';
import { SignupDto, LoginDto } from './dto';
import { Gender, Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  publicId: string;
}

export interface TwoFactorTempPayload {
  sub: string;
  type: 'two_factor_pending';
}

export interface AuthResponse {
  accessToken?: string;
  tempToken?: string;
  requires2FA?: boolean;
  user: {
    id: string;
    publicId: string;
    email: string;
    role: Role;
    isVerified: boolean;
    isPhoneVerified: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    console.log('DEBUG: Initializing AuthService');
  }

  /**
   * Register a new user with email/password
   */
  async signup(dto: SignupDto, ipAddress?: string): Promise<{ message: string; requiresEmailVerification: boolean }> {
    // Check if email already exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    // Check if phone already exists
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Phone number already registered');
    }

    // Hash password with Argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Generate unique public ID and email verification token
    const publicId = nanoid(12);
    const emailVerificationToken = nanoid(32);
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user (unverified)
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          passwordHash,
          publicId,
          role: Role.USER,
          isVerified: false,
          isPhoneVerified: false,
          emailVerificationToken,
          emailVerificationExpiry,
          profile: {
            create: {
              firstName: dto.firstName,
              lastNameEnc: '',
              dob: new Date('2000-01-01'),
              gender: dto.gender as Gender,
              ethnicity: '',
            },
          },
        },
        include: {
          profile: true,
        },
      });

      // Log signup
      await this.auditService.log({
        userId: user.id,
        action: 'SIGNUP_PENDING_VERIFICATION',
        resourceType: 'auth',
        ipAddress,
      });

      // TODO: Send verification email via EmailService
      // For now, log the verification link
      const webUrl = this.configService.get('WEB_URL', 'http://localhost:3000');
      console.log(`\n📧 Email Verification Link for ${user.email}:`);
      console.log(`   ${webUrl}/verify-email?token=${emailVerificationToken}\n`);

      return {
        message: 'Account created. Please check your email to verify your account.',
        requiresEmailVerification: true,
      };
    } catch (error) {
      console.error('SERVER ERROR DURING SIGNUP:', error);
      throw error;
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string, ipAddress?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Mark email as verified
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        isVerified: true,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      resourceType: 'auth',
      ipAddress,
    });

    // Generate JWT and log them in
    const accessToken = this.generateToken(updatedUser);

    return {
      accessToken,
      user: {
        id: updatedUser.id,
        publicId: updatedUser.publicId,
        email: updatedUser.email,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
      },
    };
  }

  /**
   * Login with email/password
   */
  async login(dto: LoginDto, ipAddress?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Block unverified users
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Please verify your email before logging in. Check your inbox for the verification link.');
    }

    // Verify password
    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA verification
      const tempPayload: TwoFactorTempPayload = {
        sub: user.id,
        type: 'two_factor_pending',
      };
      const tempToken = this.jwtService.sign(tempPayload, { expiresIn: '5m' });
      
      await this.auditService.log({
        userId: user.id,
        action: 'LOGIN_2FA_REQUIRED',
        resourceType: 'auth',
        ipAddress,
      });

      return {
        requires2FA: true,
        tempToken,
        user: {
          id: user.id,
          publicId: user.publicId,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          isPhoneVerified: user.isPhoneVerified,
        },
      };
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log login
    await this.auditService.logLogin(user.id, ipAddress);

    // Generate JWT
    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }

  /**
   * Generate access token for user by ID (used after 2FA verification)
   */
  async generateTokenForUser(userId: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }

  /**
   * Handle OAuth login/signup
   */
  async handleOAuthUser(
    provider: string,
    profile: { email: string; firstName: string; lastName: string },
    ipAddress?: string,
  ): Promise<AuthResponse> {
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
    });

    if (!user) {
      // Create new user from OAuth
      const publicId = nanoid(12);

      user = await this.prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          phone: '', // Will need to be set during onboarding
          publicId,
          role: Role.USER,
          isVerified: true, // OAuth emails are pre-verified
          isPhoneVerified: false,
          profile: {
            create: {
              firstName: profile.firstName,
              lastNameEnc: '', // Will encrypt during profile completion
              dob: new Date('2000-01-01'),
              gender: Gender.MALE, // Default, user updates during onboarding
              ethnicity: '',
            },
          },
        },
      });

      await this.auditService.log({
        userId: user.id,
        action: 'OAUTH_SIGNUP',
        resourceType: 'auth',
        ipAddress,
        metadata: { provider },
      });
    } else {
      // Log OAuth login
      await this.auditService.log({
        userId: user.id,
        action: 'OAUTH_LOGIN',
        resourceType: 'auth',
        ipAddress,
        metadata: { provider },
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }

  /**
   * Validate JWT payload and return user
   */
  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: { id: string; email: string; role: Role; publicId: string }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      publicId: user.publicId,
    };

    return this.jwtService.sign(payload);
  }
}
