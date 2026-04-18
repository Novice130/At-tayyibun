import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DrizzleService } from '../../db/drizzle.service';
import { photos } from '../../db/schema';
import { StorageService } from '../../services/storage.service';
import { ImageProcessorService } from './image-processor.service';
import { PhotoType, PhotoVisibility } from '../../common/types/role';

@Injectable()
export class PhotosService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  async uploadPhoto(userId: string, fileBuffer: Buffer, filename: string, type: PhotoType = PhotoType.REAL_PHOTO) {
    const validation = await this.imageProcessor.validateImage(fileBuffer);
    if (!validation.valid) throw new BadRequestException(validation.error);

    const processed = await this.imageProcessor.processImage(fileBuffer);
    const baseName = this.storageService.generateFileName(filename, userId);
    const originalPath = `originals/${baseName}.webp`;
    const thumbnailPath = `thumbnails/${baseName}.webp`;
    const displayPath = `display/${baseName}.webp`;

    await Promise.all([
      this.storageService.uploadFile(processed.original, originalPath, 'image/webp', 'photos'),
      this.storageService.uploadFile(processed.thumbnail, thumbnailPath, 'image/webp', 'photos'),
      this.storageService.uploadFile(processed.display, displayPath, 'image/webp', 'photos'),
    ]);

    const db = this.drizzle.db;
    const [hasPrimary] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.userId, userId), eq(photos.isPrimary, true)))
      .limit(1);

    const [photo] = await db
      .insert(photos)
      .values({
        id: randomUUID(),
        userId,
        type: type as any,
        gcsOriginalPath: `photos/${originalPath}`,
        gcsThumbnailPath: `photos/${thumbnailPath}`,
        gcsDisplayPath: `photos/${displayPath}`,
        isPrimary: !hasPrimary,
        visibility: PhotoVisibility.PRIVATE as any,
      })
      .returning();

    return { id: photo.id, type: photo.type, isPrimary: photo.isPrimary, visibility: photo.visibility };
  }

  async deletePhoto(userId: string, photoId: string) {
    const db = this.drizzle.db;
    const [photo] = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
    if (!photo) throw new NotFoundException('Photo not found');
    if (photo.userId !== userId) throw new BadRequestException('You can only delete your own photos');

    await Promise.all([
      photo.gcsOriginalPath && this.storageService.deleteFile(photo.gcsOriginalPath),
      photo.gcsThumbnailPath && this.storageService.deleteFile(photo.gcsThumbnailPath),
      photo.gcsDisplayPath && this.storageService.deleteFile(photo.gcsDisplayPath),
    ]);

    await db.delete(photos).where(eq(photos.id, photoId));

    if (photo.isPrimary) {
      const [next] = await db
        .select({ id: photos.id })
        .from(photos)
        .where(eq(photos.userId, userId))
        .orderBy(desc(photos.createdAt))
        .limit(1);
      if (next) await db.update(photos).set({ isPrimary: true }).where(eq(photos.id, next.id));
    }

    return { success: true };
  }

  async setPrimaryPhoto(userId: string, photoId: string) {
    const db = this.drizzle.db;
    const [photo] = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
    if (!photo || photo.userId !== userId) throw new NotFoundException('Photo not found');

    await db
      .update(photos)
      .set({ isPrimary: false })
      .where(and(eq(photos.userId, userId), eq(photos.isPrimary, true)));
    await db.update(photos).set({ isPrimary: true }).where(eq(photos.id, photoId));

    return { success: true };
  }

  async getSignedUrl(photoId: string, expiresInMinutes = 60) {
    const [photo] = await this.drizzle.db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
    if (!photo || !photo.gcsDisplayPath) throw new NotFoundException('Photo not found');
    return this.storageService.getSignedUrl(photo.gcsDisplayPath, expiresInMinutes);
  }
}
