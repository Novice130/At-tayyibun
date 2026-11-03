import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM encryption service for sensitive biodata fields.
 * Key stored in Secret Manager (accessed via environment variable).
 */
@Injectable()
export class EncryptionService {
  private static readonly AUTH_TAG_LENGTH = 16;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyBuffer: Buffer;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      const msg = '❌ CRITICAL ERROR: ENCRYPTION_KEY environment variable is required.';
      console.error(msg);
      throw new Error(msg);
    }
    this.keyBuffer = Buffer.from(key, 'hex');

    if (this.keyBuffer.length !== 32) {
      const msg = `❌ CRITICAL ERROR: ENCRYPTION_KEY must be a 32-byte hex string (64 characters). Found ${this.keyBuffer.length} bytes from the provided hex string.`;
      console.error(msg);
      throw new Error(msg);
    }
  }

  /**
   * HMAC under a key derived for one purpose, so a signature for one feature
   * cannot be replayed in another and the raw encryption key never signs.
   * Rotating ENCRYPTION_KEY invalidates signatures already handed out.
   */
  signFor(purpose: string, value: string): string {
    const key = Buffer.from(crypto.hkdfSync('sha256', this.keyBuffer, Buffer.alloc(0), `at-tayyibun/${purpose}`, 32));
    return crypto.createHmac('sha256', key).update(value).digest('base64url');
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * Returns: iv:authTag:ciphertext (all base64)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96 bits for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.keyBuffer, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt ciphertext encrypted with AES-256-GCM
   */
  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivBase64, authTagBase64, ciphertext] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    // GCM accepts tags as short as 4 bytes unless the length is pinned, which
    // makes forging a ciphertext far easier. encrypt() always writes 16.
    if (authTag.length !== EncryptionService.AUTH_TAG_LENGTH) {
      throw new Error('Invalid auth tag length');
    }

    const decipher = crypto.createDecipheriv(this.algorithm, this.keyBuffer, iv, {
      authTagLength: EncryptionService.AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt JSON object
   */
  encryptJson(data: object): string {
    return this.encrypt(JSON.stringify(data));
  }

  /**
   * Decrypt JSON object
   */
  decryptJson<T = unknown>(encryptedData: string): T {
    return JSON.parse(this.decrypt(encryptedData)) as T;
  }

  /**
   * Generate a secure random token
   */
  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
