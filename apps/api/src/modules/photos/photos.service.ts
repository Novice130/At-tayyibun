import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../services/storage.service';
import { ImageProcessorService } from './image-processor.service';
import { PhotoType, PhotoVisibility } from '@prisma/client';

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  /**
   * Upload a photo
   */
  async uploadPhoto(
    userId: string,
    fileBuffer: Buffer,
    filename: string,
    type: PhotoType = PhotoType.REAL_PHOTO,
  ) {
    // Validate image
    const validation = await this.imageProcessor.validateImage(fileBuffer);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Process image
    const processed = await this.imageProcessor.processImage(fileBuffer);

    // Generate file paths
    const baseName = this.storageService.generateFileName(filename, userId);
    const originalPath = `originals/${baseName}.webp`;
    const thumbnailPath = `thumbnails/${baseName}.webp`;
    const displayPath = `display/${baseName}.webp`;

    // Upload to GCS
    await Promise.all([
      this.storageService.uploadFile(processed.original, originalPath, 'image/webp', 'photos'),
      this.storageService.uploadFile(processed.thumbnail, thumbnailPath, 'image/webp', 'photos'),
      this.storageService.uploadFile(processed.display, displayPath, 'image/webp', 'photos'),
    ]);

    // Check if user has a primary photo
    const hasPrimary = await this.prisma.photo.findFirst({
      where: { userId, isPrimary: true },
    });

    // Create photo record
    const photo = await this.prisma.photo.create({
      data: {
        userId,
        type,
        gcsOriginalPath: `photos/${originalPath}`,
        gcsThumbnailPath: `photos/${thumbnailPath}`,
        gcsDisplayPath: `photos/${displayPath}`,
        isPrimary: !hasPrimary,
        visibility: PhotoVisibility.PRIVATE,
      },
    });

    return {
      id: photo.id,
      type: photo.type,
      isPrimary: photo.isPrimary,
      visibility: photo.visibility,
    };
  }

  /**
   * Delete a photo
   */
  async deletePhoto(userId: string, photoId: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (photo.userId !== userId) {
      throw new BadRequestException('You can only delete your own photos');
    }

    // Delete from GCS
    await Promise.all([
      photo.gcsOriginalPath && this.storageService.deleteFile(photo.gcsOriginalPath),
      photo.gcsThumbnailPath && this.storageService.deleteFile(photo.gcsThumbnailPath),
      photo.gcsDisplayPath && this.storageService.deleteFile(photo.gcsDisplayPath),
    ]);

    // Delete record
    await this.prisma.photo.delete({ where: { id: photoId } });

    // If was primary, set another as primary
    if (photo.isPrimary) {
      const nextPhoto = await this.prisma.photo.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (nextPhoto) {
        await this.prisma.photo.update({
          where: { id: nextPhoto.id },
          data: { isPrimary: true },
        });
      }
    }

    return { success: true };
  }

  /**
   * Set primary photo
   */
  async setPrimaryPhoto(userId: string, photoId: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo || photo.userId !== userId) {
      throw new NotFoundException('Photo not found');
    }

    // Unset current primary
    await this.prisma.photo.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });

    // Set new primary
    await this.prisma.photo.update({
      where: { id: photoId },
      data: { isPrimary: true },
    });

    return { success: true };
  }

  /**
   * Get signed URL for a photo (for approved requests)
   */
  async getSignedUrl(photoId: string, expiresInMinutes = 60) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo || !photo.gcsDisplayPath) {
      throw new NotFoundException('Photo not found');
    }

    return this.storageService.getSignedUrl(photo.gcsDisplayPath, expiresInMinutes);
  }
}
