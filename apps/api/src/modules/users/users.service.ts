import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { users } from '../../db/schema';

@Injectable()
export class UsersService {
  constructor(private readonly drizzle: DrizzleService) {}

  private async findWithProfile(where: any) {
    const user = await this.drizzle.db.query.users.findFirst({
      where,
      with: { profiles: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { profiles: profileRows, ...rest } = user as any;
    return {
      ...rest,
      profile: Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null,
    };
  }

  findById(id: string) {
    return this.findWithProfile(eq(users.id, id));
  }

  findByPublicId(publicId: string) {
    return this.findWithProfile(eq(users.publicId, publicId));
  }

  async findByEmail(email: string) {
    const [row] = await this.drizzle.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return row ?? null;
  }

  async findByPhone(phone: string) {
    const [row] = await this.drizzle.db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return row ?? null;
  }
}
