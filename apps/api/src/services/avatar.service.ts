import { Injectable } from '@nestjs/common';
import { Gender } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * Avatar generation service using DiceBear API
 * Generates consistent avatars based on user seed (user ID)
 */
@Injectable()
export class AvatarService {
  private readonly baseUrl = 'https://api.dicebear.com/7.x';

  /**
   * Generate avatar URL for a user
   * @param seed - Unique seed (usually user ID)
   * @param gender - User's gender for appropriate style
   * @param size - Avatar size in pixels
   */
  generateAvatarUrl(seed: string, gender: Gender, size = 200): string {
    // Use different styles based on gender for a more personalized look
    const style = gender === 'MALE' ? 'personas' : 'personas';

    // Generate a hash of the seed for consistent appearance
    const hash = crypto.createHash('md5').update(seed).digest('hex');

    // Build URL with parameters
    const params = new URLSearchParams({
      seed: hash,
      size: size.toString(),
      backgroundColor: 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf',
      radius: '50',
    });

    return `${this.baseUrl}/${style}/svg?${params.toString()}`;
  }

  /**
   * Generate and save avatar to storage
   * For now, we just return the URL - the frontend will use it directly
   */
  async createAvatar(userId: string, gender: Gender): Promise<string> {
    return this.generateAvatarUrl(userId, gender, 256);
  }

  /**
   * Get thumbnail avatar URL
   */
  getAvatarThumbnail(seed: string, gender: Gender): string {
    return this.generateAvatarUrl(seed, gender, 80);
  }

  /**
   * Get display avatar URL
   */
  getAvatarDisplay(seed: string, gender: Gender): string {
    return this.generateAvatarUrl(seed, gender, 256);
  }
}
