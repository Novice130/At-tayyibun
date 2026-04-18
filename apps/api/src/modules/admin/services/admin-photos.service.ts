import { Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';
import { photos, profiles } from '../../../db/schema';
import { AuditService } from '../../../services/audit.service';

@Injectable()
export class AdminPhotosService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
  ) {}

  async getPendingPhotos(page = 1, limit = 20) {
    const db = this.drizzle.db;

    const data = await db.select({
      id: photos.id,
      type: photos.type,
      dataUri: photos.dataUri,
      gcsDisplayPath: photos.gcsDisplayPath,
      adminApproved: photos.adminApproved,
      createdAt: photos.createdAt,
      uploaderId: photos.userId,
      uploaderName: profiles.firstName,
    })
    .from(photos)
    .leftJoin(profiles, eq(photos.userId, profiles.userId))
    .where(eq(photos.adminApproved, false))
    .orderBy(desc(photos.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

    return data;
  }

  async approvePhoto(adminId: string, photoId: string) {
    const db = this.drizzle.db;
    
    const [photo] = await db.select().from(photos).where(eq(photos.id, photoId));
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    await db.update(photos)
      .set({ adminApproved: true })
      .where(eq(photos.id, photoId));

    await this.auditService.logAdminAction(adminId, 'APPROVE_PHOTO', 'photo', photoId);

    return { success: true, message: 'Photo approved' };
  }

  async rejectPhoto(adminId: string, photoId: string) {
    const db = this.drizzle.db;
    
    const [photo] = await db.select().from(photos).where(eq(photos.id, photoId));
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // For avocados (avatars) or real photos, rejecting might just delete it or mark it as rejected.
    // For now we will delete it from DB.
    await db.delete(photos).where(eq(photos.id, photoId));
    
    // Profile aiAvatarId handles nulling via cascade config we checked
    await this.auditService.logAdminAction(adminId, 'REJECT_PHOTO', 'photo', photoId);

    return { success: true, message: 'Photo rejected and removed' };
  }
}
