import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
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

export interface AuthResponse {
  accessToken: string;
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
  ) {}

  /**
   * Register a new user with email/password
   */
  async signup(dto: SignupDto, ipAddress?: string): Promise<AuthResponse> {
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

    // Generate unique public ID
    const publicId = nanoid(12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        publicId,
        role: Role.USER,
        isVerified: false,
        isPhoneVerified: false,
        profile: {
          create: {
            firstName: dto.firstName,
            lastNameEnc: '', // Will be set when user completes profile
            dob: new Date('2000-01-01'), // Default, user updates later
            gender: dto.gender as Gender,
            ethnicity: '', // Will be set when user completes profile
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
      action: 'SIGNUP',
      resourceType: 'auth',
      ipAddress,
    });

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
   * Login with email/password
   */
  async login(dto: LoginDto, ipAddress?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
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
