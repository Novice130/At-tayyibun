import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
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

  describe('signFor', () => {
    afterEach(() => jest.restoreAllMocks());

    it('derives each purpose key once and keeps the signatures stable', () => {
      const fresh = makeService();
      const hkdf = jest.spyOn(crypto, 'hkdfSync');
      const first = fresh.signFor('unsubscribe/v1', 'pub1');
      expect(fresh.signFor('unsubscribe/v1', 'pub1')).toBe(first);
      fresh.signFor('unsubscribe/v1', 'pub2');
      expect(hkdf).toHaveBeenCalledTimes(1);
      fresh.signFor('other/v1', 'pub1');
      expect(hkdf).toHaveBeenCalledTimes(2);
    });

    it('signs differently per purpose', () => {
      expect(service.signFor('a/v1', 'pub1')).not.toBe(service.signFor('b/v1', 'pub1'));
    });

    it('matches HKDF-SHA256 then HMAC-SHA256, so issued links keep working', () => {
      const key = Buffer.from(
        crypto.hkdfSync('sha256', Buffer.from(KEY, 'hex'), Buffer.alloc(0), 'at-tayyibun/unsubscribe/v1', 32),
      );
      const expected = crypto.createHmac('sha256', key).update('pub1').digest('base64url');
      expect(service.signFor('unsubscribe/v1', 'pub1')).toBe(expected);
    });
  });
});
