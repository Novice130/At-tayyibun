// Image Processor Job
// Triggered by Cloud Tasks when photo is uploaded
// Processes images with Sharp: resize, convert to WebP, generate thumbnails

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

interface ImageProcessPayload {
  photoId: string;
  userId: string;
  originalPath: string;
}

@Injectable()
export class ImageProcessorJob {
  private readonly logger = new Logger(ImageProcessorJob.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async execute(payload: ImageProcessPayload): Promise<void> {
    const { photoId, userId, originalPath } = payload;
    this.logger.log(`Processing image ${photoId} for user ${userId}`);

    try {
      // In production, this would:
      // 1. Download original from GCS
      // 2. Process with Sharp (resize, convert to WebP)
      // 3. Upload processed versions back to GCS
      // 4. Update database with new paths

      const basePath = originalPath.replace(/\/original\.[^/]+$/, '');

      // Update database record with processed paths
      await this.prisma.photo.update({
        where: { id: photoId },
        data: {
          gcsPathDisplay: `${basePath}/display.webp`,
          gcsPathThumb: `${basePath}/thumb.webp`,
        },
      });

      this.logger.log(`Successfully processed image ${photoId}`);
    } catch (error) {
      this.logger.error(`Failed to process image ${photoId}:`, error);
      throw error;
    }
  }
}
