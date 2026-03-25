import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../services/audit.service';
import { Role } from '@prisma/client';

/**
 * AuthService - now a thin utility layer.
 * Signup/login are handled by BetterAuth on the frontend.
 * This service provides helper methods for the NestJS backend
 * (e.g., user lookup, audit logging, legacy compatibility).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    console.log('DEBUG: Initializing AuthService (BetterAuth mode)');
  }

  /**
   * Get the currently authenticated user from the session (used by /auth/me)
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isPhoneVerified: user.isPhoneVerified,
      name: user.name,
      profile: user.profile,
    };
  }

  /**
   * Log a login event (called from controller when needed)
   */
  async logLogin(userId: string, ipAddress?: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    await this.auditService.logLogin(userId, ipAddress);
  }
}
