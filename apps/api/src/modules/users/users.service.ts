import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { DrizzleService } from '../../db/drizzle.service';
import { users, account } from '../../db/schema';
import { ModerationService } from '../moderation/moderation.service';

/** Separate from the push service's app so neither depends on the other starting first. */
const FIREBASE_APP_NAME = 'attayyibun-account-deletion';

/** Same cleanup as the push service and the web app's firebase-admin.ts. */
function cleanEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
}

/** A loggable reason with no message text, which can carry key material or phone numbers. */
function errorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    return (err as { name?: string }).name ?? 'error';
  }
  return 'error';
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  /** undefined: not tried yet; null: not configured or failed to start. */
  private firebaseAuth: Auth | null | undefined;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly moderationService: ModerationService,
    private readonly configService: ConfigService,
  ) {}

  private async findWithProfile(where: any) {
    const user = await this.drizzle.db.query.users.findFirst({
      where,
      with: { profiles: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { profiles: profileRows, ...rest } = user as any;
    return {
      ...rest,
      profile: Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null,
    };
  }

  findById(id: string) {
    return this.findWithProfile(eq(users.id, id));
  }

  findByPublicId(publicId: string) {
    return this.findWithProfile(eq(users.publicId, publicId));
  }

  async findByEmail(email: string) {
    const [row] = await this.drizzle.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return row ?? null;
  }

  async findByPhone(phone: string) {
    const [row] = await this.drizzle.db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return row ?? null;
  }

  /**
   * Permanently delete the caller's own account. Apple review explicitly tests
   * that "delete" is not a disguised deactivation — everything goes, now.
   */
  async deleteOwnAccount(userId: string) {
    await this.revokeAppleTokenIfPresent(userId);

    // Read the phone before the row is gone: it is the only link to the
    // Firebase Auth user that phone verification created.
    const [row] = await this.drizzle.db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    await this.moderationService.hardDeleteUser(userId, userId);
    await this.deleteFirebasePhoneUser(row?.phone ?? null);
    return { ok: true };
  }

  /**
   * Phone verification signs the user in to Firebase Auth with their number,
   * which leaves a Firebase user holding that number. Delete it so account
   * deletion removes the phone record too.
   *
   * Runs after the database delete and never throws: the account is already
   * gone, and a Firebase outage must not turn that into an error. A number with
   * no Firebase user (never verified there, or already removed) is fine.
   */
  private async deleteFirebasePhoneUser(phone: string | null) {
    if (!phone) return;
    const auth = this.getFirebaseAuth();
    if (!auth) return;
    try {
      const fbUser = await auth.getUserByPhoneNumber(phone);
      await auth.deleteUser(fbUser.uid);
    } catch (err) {
      const code = errorCode(err);
      if (code === 'auth/user-not-found') return;
      this.logger.warn(`Firebase phone user delete failed: ${code}`);
    }
  }

  private getFirebaseAuth(): Auth | null {
    if (this.firebaseAuth !== undefined) return this.firebaseAuth;

    const projectId = cleanEnv(this.configService.get<string>('FIREBASE_PROJECT_ID'));
    const clientEmail = cleanEnv(this.configService.get<string>('FIREBASE_CLIENT_EMAIL'));
    const rawKey = cleanEnv(this.configService.get<string>('FIREBASE_PRIVATE_KEY'));
    if (!projectId || !clientEmail || !rawKey) {
      this.firebaseAuth = null;
      return null;
    }

    try {
      // Hosting providers store the PEM on one line with literal "\n".
      const privateKey = rawKey.replace(/\\n/g, '\n');
      const app =
        getApps().find((a) => a.name === FIREBASE_APP_NAME) ??
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, FIREBASE_APP_NAME);
      this.firebaseAuth = getAuth(app);
    } catch (err) {
      // Never log the error object itself: a PEM parse error can echo key text.
      this.logger.error(`Firebase phone cleanup disabled: Firebase failed to start (${errorCode(err)})`);
      this.firebaseAuth = null;
    }
    return this.firebaseAuth;
  }

  /**
   * Apple requires apps using Sign in with Apple to revoke the user's token on
   * account deletion. Without the Apple secret in env this is skipped — the
   * deletion itself must not fail because of a missing configuration.
   */
  private async revokeAppleTokenIfPresent(userId: string) {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('APPLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) return;

    // Must filter on providerId: a user with both Google and Apple linked has
    // several account rows, and the Google row carries no Apple refresh token,
    // so taking the first row silently skipped the revoke.
    const [appleAccount] = await this.drizzle.db
      .select()
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, 'apple')))
      .limit(1);

    const token = appleAccount?.refreshToken ?? appleAccount?.accessToken;
    if (!token) return;

    try {
      const response = await fetch('https://appleid.apple.com/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token,
          token_type_hint: 'refresh_token',
        }),
      });
      if (!response.ok) {
        console.error('Apple token revoke failed:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Apple token revoke request failed:', error);
    }
  }
}
