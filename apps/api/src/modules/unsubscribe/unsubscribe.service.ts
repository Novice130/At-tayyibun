import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { randomUUID, timingSafeEqual } from 'crypto';
import { DrizzleService } from '../../db/drizzle.service';
import { unsubscribes, users } from '../../db/schema';
import { AuditService } from '../../services/audit.service';
import { EncryptionService } from '../../services/encryption.service';

const TOKEN_PURPOSE = 'unsubscribe/v1';
const INVALID_LINK = 'This unsubscribe link is not valid.';

/**
 * Campaign opt-out. A token is `<publicId>.<signature>`: it names one member,
 * never expires (a recipient may click years later), and exposes no internal id.
 */
@Injectable()
export class UnsubscribeService {
  private readonly webUrl: string;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.webUrl = (config.get<string>('WEB_URL') || 'http://localhost:3000').replace(/\/+$/, '');
  }

  tokenFor(publicId: string): string {
    return `${publicId}.${this.encryption.signFor(TOKEN_PURPOSE, publicId)}`;
  }

  /** The confirmation page linked from the email footer. */
  pageUrl(publicId: string): string {
    return this.linksFor(publicId).pageUrl;
  }

  /** The RFC 8058 target mail clients POST to from their own unsubscribe button. */
  oneClickUrl(publicId: string): string {
    return this.linksFor(publicId).oneClickUrl;
  }

  /** Both links from one signed token, so a campaign signs once per recipient. */
  linksFor(publicId: string): { pageUrl: string; oneClickUrl: string } {
    const token = encodeURIComponent(this.tokenFor(publicId));
    return {
      pageUrl: `${this.webUrl}/unsubscribe?token=${token}`,
      oneClickUrl: `${this.webUrl}/api/unsubscribe?token=${token}`,
    };
  }

  private publicIdFrom(token: unknown): string | null {
    if (typeof token !== 'string') return null;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const publicId = token.slice(0, dot);
    const given = Buffer.from(token);
    const expected = Buffer.from(this.tokenFor(publicId));
    return given.length === expected.length && timingSafeEqual(given, expected) ? publicId : null;
  }

  /** Idempotent: a repeat click or a client retry is still a success. */
  async unsubscribe(token: unknown): Promise<{ success: true }> {
    const publicId = this.publicIdFrom(token);
    if (!publicId) throw new BadRequestException(INVALID_LINK);

    const db = this.drizzle.db;
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.publicId, publicId)).limit(1);
    if (!user) throw new BadRequestException(INVALID_LINK);

    const [inserted] = await db
      .insert(unsubscribes)
      .values({ id: randomUUID(), userId: user.id })
      .onConflictDoNothing()
      .returning({ id: unsubscribes.id });

    if (inserted) {
      await this.audit.log({ userId: user.id, action: 'EMAIL_UNSUBSCRIBED', resourceType: 'user', resourceId: user.id });
    }
    return { success: true };
  }
}
