import { Injectable } from '@nestjs/common';
import { Gender } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * Avatar generation service using DiceBear API
 * Uses cartoon-style avatars only (never realistic/human-like)
 */
@Injectable()
export class AvatarService {
  private readonly baseUrl = 'https://api.dicebear.com/9.x';

  /**
   * Generate avatar URL for a user
   * Uses 'adventurer' style - clearly cartoon, not real people
   */
  generateAvatarUrl(seed: string, _gender: Gender, size = 200): string {
    const hash = crypto.createHash('md5').update(seed).digest('hex');

    const params = new URLSearchParams({
      seed: hash,
      size: size.toString(),
      backgroundColor: 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf',
      radius: '50',
    });

    return `${this.baseUrl}/adventurer/svg?${params.toString()}`;
  }

  async createAvatar(userId: string, gender: Gender): Promise<string> {
    return this.generateAvatarUrl(userId, gender, 256);
  }

  getAvatarThumbnail(seed: string, gender: Gender): string {
    return this.generateAvatarUrl(seed, gender, 80);
  }

  getAvatarDisplay(seed: string, gender: Gender): string {
    return this.generateAvatarUrl(seed, gender, 256);
  }
}
