import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GetSignedUrlConfig } from '@google-cloud/storage';
import type { Storage } from '@google-cloud/storage';
import * as path from 'path';

@Injectable()
export class StorageService {
  private storage: Storage | null = null;
  private bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME', 'at-tayyibun-photos');
  }

  private getStorage(): Storage {
    if (!this.storage) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Storage } = require('@google-cloud/storage') as { Storage: new (opts: any) => Storage };
      this.storage = new Storage({
        projectId: this.configService.get<string>('GCS_PROJECT_ID'),
      });
    }
    return this.storage!;
  }

  /**
   * Upload a file to GCS
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string,
    directory = 'photos',
  ): Promise<string> {
    const destination = `${directory}/${fileName}`;
    const bucket = this.getStorage().bucket(this.bucketName);
    const file = bucket.file(destination);

    await file.save(fileBuffer, {
      metadata: {
        contentType,
        cacheControl: 'private, max-age=31536000',
      },
    });

    return destination;
  }

  /**
   * Generate a signed URL for private file access
   */
  async getSignedUrl(filePath: string, expiresInMinutes = 60): Promise<string> {
    const bucket = this.getStorage().bucket(this.bucketName);
    const file = bucket.file(filePath);

    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    };

    const [url] = await file.getSignedUrl(options);
    return url;
  }

  /**
   * Generate a one-time access signed URL (24h expiry)
   */
  async getOneTimeSignedUrl(filePath: string): Promise<string> {
    return this.getSignedUrl(filePath, 24 * 60); // 24 hours
  }

  /**
   * Delete a file from GCS
   */
  async deleteFile(filePath: string): Promise<void> {
    const bucket = this.getStorage().bucket(this.bucketName);
    const file = bucket.file(filePath);

    await file.delete({ ignoreNotFound: true });
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    const bucket = this.getStorage().bucket(this.bucketName);
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    return exists;
  }

  /**
   * Generate a unique filename
   */
  generateFileName(originalName: string, userId: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${userId}/${timestamp}-${random}${ext}`;
  }
}
