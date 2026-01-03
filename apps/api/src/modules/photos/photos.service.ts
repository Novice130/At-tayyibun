import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Storage } from '@google-cloud/storage';
import * as sharp from 'sharp';
import { nanoid } from 'nanoid';
import { PhotoType } from '@prisma/client';

@Injectable()
export class PhotosService {
  private storage: Storage;
  private photoBucket: string;
  private avatarBucket: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.storage = new Storage();
    this.photoBucket = this.configService.get<string>('security.gcs.bucketPhotos')!;
    this.avatarBucket = this.configService.get<string>('security.gcs.bucketAvatars')!;
  }

  /**
   * Upload and process a real photo
   */
  async uploadPhoto(
    userId: string,
    file: any,
    isPrimary: boolean = false,
  ) {
    // Validate file
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB max
      throw new BadRequestException('File size must be less than 10MB');
    }

    const photoId = nanoid(16);
    const basePath = `users/${userId}/photos/${photoId}`;

    // Process image with Sharp
    const imageBuffer = file.buffer;

    // Generate optimized versions
    const [displayBuffer, thumbBuffer] = await Promise.all([
      // Display version: max 1200px, WebP format
      sharp(imageBuffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
      // Thumbnail: 200px, WebP format
      sharp(imageBuffer)
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 70 })
        .toBuffer(),
    ]);

    // Upload to GCS
    const bucket = this.storage.bucket(this.photoBucket);

    await Promise.all([
      // Original (private, for admin review if needed)
      bucket.file(`${basePath}/original.${file.mimetype.split('/')[1]}`).save(imageBuffer, {
        metadata: { contentType: file.mimetype },
      }),
      // Display version
      bucket.file(`${basePath}/display.webp`).save(displayBuffer, {
        metadata: { contentType: 'image/webp' },
      }),
      // Thumbnail
      bucket.file(`${basePath}/thumb.webp`).save(thumbBuffer, {
        metadata: { contentType: 'image/webp' },
      }),
    ]);

    // If setting as primary, unset other primaries
    if (isPrimary) {
      await this.prisma.photo.updateMany({
        where: { userId, type: 'REAL_PHOTO', isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Create database record
    const photo = await this.prisma.photo.create({
      data: {
        userId,
        type: 'REAL_PHOTO',
        gcsPathOriginal: `${basePath}/original.${file.mimetype.split('/')[1]}`,
        gcsPathDisplay: `${basePath}/display.webp`,
        gcsPathThumb: `${basePath}/thumb.webp`,
        isPrimary,
        isPublic: false, // Real photos are never public
        isApproved: false,
      },
    });

    return photo;
  }

  /**
   * Generate AI avatar for user
   */
  async generateAvatar(userId: string, seed?: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new BadRequestException('User profile required to generate avatar');
    }

    // Use DiceBear API for avatar generation
    const avatarSeed = seed || userId;
    const style = 'avataaars'; // Safe, friendly avatar style
    const avatarUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${avatarSeed}`;

    // Fetch and convert to WebP
    const response = await fetch(avatarUrl);
    const svgBuffer = await response.arrayBuffer();

    // Convert SVG to WebP
    const webpBuffer = await sharp(Buffer.from(svgBuffer))
      .resize(400, 400)
      .webp({ quality: 90 })
      .toBuffer();

    const thumbBuffer = await sharp(Buffer.from(svgBuffer))
      .resize(100, 100)
      .webp({ quality: 80 })
      .toBuffer();

    // Upload to avatars bucket
    const avatarId = nanoid(16);
    const basePath = `users/${userId}/avatars/${avatarId}`;
    const bucket = this.storage.bucket(this.avatarBucket);

    await Promise.all([
      bucket.file(`${basePath}/display.webp`).save(webpBuffer, {
        metadata: { contentType: 'image/webp' },
      }),
      bucket.file(`${basePath}/thumb.webp`).save(thumbBuffer, {
        metadata: { contentType: 'image/webp' },
      }),
    ]);

    // Remove old AI avatar if exists
    await this.prisma.photo.deleteMany({
      where: { userId, type: 'AI_AVATAR' },
    });

    // Create database record
    const photo = await this.prisma.photo.create({
      data: {
        userId,
        type: 'AI_AVATAR',
        gcsPathDisplay: `${basePath}/display.webp`,
        gcsPathThumb: `${basePath}/thumb.webp`,
        isPrimary: true,
        isPublic: true, // AI avatars are public
        isApproved: true,
      },
    });

    return photo;
  }

  /**
   * Get user's photos
   */
  async getUserPhotos(userId: string) {
    return this.prisma.photo.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Generate signed URL for photo access (15 min expiry)
   */
  async getSignedUrl(gcsPath: string, expiresInMinutes: number = 15): Promise<string> {
    const bucket = gcsPath.includes('/avatars/') 
      ? this.storage.bucket(this.avatarBucket)
      : this.storage.bucket(this.photoBucket);

    const [url] = await bucket.file(gcsPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

    return url;
  }

  /**
   * Delete a photo
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.photo.findFirst({
      where: { id: photoId, userId },
    });

    if (!photo) {
      throw new BadRequestException('Photo not found');
    }

    // Delete from GCS
    const bucket = photo.type === 'AI_AVATAR' 
      ? this.storage.bucket(this.avatarBucket)
      : this.storage.bucket(this.photoBucket);

    const paths = [photo.gcsPathDisplay, photo.gcsPathThumb];
    if (photo.gcsPathOriginal) paths.push(photo.gcsPathOriginal);

    await Promise.all(
      paths.map(path => bucket.file(path).delete().catch(() => {})),
    );

    // Delete from database
    await this.prisma.photo.delete({ where: { id: photoId } });
  }
}
