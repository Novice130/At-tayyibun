import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Field-level encryption service for sensitive data
 * Uses AES-256-GCM with keys from Secret Manager
 * Supports key rotation via key ID versioning
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyMap: Map<string, Buffer> = new Map();
  private readonly currentKeyId: string;

  constructor(private configService: ConfigService) {
    // Load encryption key from config (in production, from Secret Manager)
    const encryptionKey = this.configService.get<string>('security.encryptionKey');
    this.currentKeyId = this.configService.get<string>('security.encryptionKeyId') || 'v1';

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Decode base64 key (must be 32 bytes for AES-256)
    const keyBuffer = Buffer.from(encryptionKey, 'base64');
    if (keyBuffer.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits) when decoded');
    }

    this.keyMap.set(this.currentKeyId, keyBuffer);
  }

  /**
   * Add a key for rotation support
   * Call this when rotating keys to add new versions
   */
  addKey(keyId: string, keyBase64: string): void {
    const keyBuffer = Buffer.from(keyBase64, 'base64');
    if (keyBuffer.length !== 32) {
      throw new Error('Key must be 32 bytes (256 bits) when decoded');
    }
    this.keyMap.set(keyId, keyBuffer);
  }

  /**
   * Encrypt a string value
   * Returns: keyId:iv:authTag:ciphertext (all base64 encoded)
   */
  encrypt(plaintext: string): string {
    const key = this.keyMap.get(this.currentKeyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${this.currentKeyId}`);
    }

    // Generate random IV (12 bytes for GCM)
    const iv = randomBytes(12);

    // Create cipher
    const cipher = createCipheriv(this.algorithm, key, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Return formatted string: keyId:iv:authTag:ciphertext
    return `${this.currentKeyId}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt a string value
   * Input format: keyId:iv:authTag:ciphertext
   */
  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [keyId, ivBase64, authTagBase64, ciphertext] = parts;

    const key = this.keyMap.get(keyId);
    if (!key) {
      throw new Error(`Decryption key not found: ${keyId}`);
    }

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    // Create decipher
    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt a JSON object
   */
  encryptObject(obj: object): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt to a JSON object
   */
  decryptObject<T = any>(encryptedData: string): T {
    const json = this.decrypt(encryptedData);
    return JSON.parse(json) as T;
  }

  /**
   * Check if a value is encrypted (has the expected format)
   */
  isEncrypted(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    const parts = value.split(':');
    return parts.length === 4 && this.keyMap.has(parts[0]);
  }

  /**
   * Re-encrypt with current key (for key rotation)
   */
  reEncrypt(encryptedData: string): string {
    const decrypted = this.decrypt(encryptedData);
    return this.encrypt(decrypted);
  }
}
