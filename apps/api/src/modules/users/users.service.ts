import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { User, MembershipTier } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByPublicId(publicId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { publicId } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async updateMembership(userId: string, tier: MembershipTier, expiresAt: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { membershipTier: tier, membershipExpiresAt: expiresAt },
    });
  }

  async deactivateUser(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }
}
