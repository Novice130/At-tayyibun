import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';

export interface ProcessedImages {
  original: Buffer;
  thumbnail: Buffer;
  display: Buffer;
}

/**
 * Image processing service using Sharp
 * Generates optimized WebP versions for efficient storage
 */
@Injectable()
export class ImageProcessorService {
  private readonly thumbnailSize = 150;
  private readonly displaySize = 600;
  private readonly quality = 80;

  /**
   * Process an uploaded image
   * Returns original, thumbnail (150px), and display (600px) versions
   */
  async processImage(buffer: Buffer): Promise<ProcessedImages> {
    // Validate image
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image');
    }

    // Generate thumbnail
    const thumbnail = await sharp(buffer)
      .resize(this.thumbnailSize, this.thumbnailSize, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: this.quality })
      .toBuffer();

    // Generate display version
    const display = await sharp(buffer)
      .resize(this.displaySize, this.displaySize, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: this.quality })
      .toBuffer();

    // Keep original but convert to WebP for storage efficiency
    const original = await sharp(buffer)
      .webp({ quality: 90 })
      .toBuffer();

    return {
      original,
      thumbnail,
      display,
    };
  }

  /**
   * Validate image file
   */
  async validateImage(buffer: Buffer, maxSizeMB = 10): Promise<{ valid: boolean; error?: string }> {
    // Check size
    if (buffer.length > maxSizeMB * 1024 * 1024) {
      return { valid: false, error: `Image exceeds ${maxSizeMB}MB limit` };
    }

    try {
      const metadata = await sharp(buffer).metadata();

      // Check format
      const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'heif', 'heic'];
      if (!metadata.format || !allowedFormats.includes(metadata.format)) {
        return { valid: false, error: 'Invalid image format. Allowed: JPG, PNG, WebP, HEIC' };
      }

      // Check dimensions
      if (!metadata.width || !metadata.height) {
        return { valid: false, error: 'Could not read image dimensions' };
      }

      if (metadata.width < 200 || metadata.height < 200) {
        return { valid: false, error: 'Image too small. Minimum 200x200 pixels' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid or corrupted image file' };
    }
  }
}
