import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const KEY = 'a'.repeat(64);

function makeService(): EncryptionService {
  const config = { get: (name: string) => (name === 'ENCRYPTION_KEY' ? KEY : undefined) };
  return new EncryptionService(config as unknown as ConfigService);
}

describe('EncryptionService', () => {
  const service = makeService();

  it('round-trips plaintext', () => {
    expect(service.decrypt(service.encrypt('biodata'))).toBe('biodata');
  });

  it('rejects a truncated auth tag', () => {
    const [iv, tag, ciphertext] = service.encrypt('biodata').split(':');
    const shortTag = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');
    expect(() => service.decrypt(`${iv}:${shortTag}:${ciphertext}`)).toThrow('Invalid auth tag length');
  });

  it('rejects a tampered ciphertext', () => {
    const [iv, tag, ciphertext] = service.encrypt('biodata').split(':');
    const bytes = Buffer.from(ciphertext, 'base64');
    bytes[0] ^= 1;
    expect(() => service.decrypt(`${iv}:${tag}:${bytes.toString('base64')}`)).toThrow();
  });
});
