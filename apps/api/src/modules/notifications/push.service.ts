import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { DevicesService } from './devices.service';

/**
 * What a push says. Generic on purpose: a lock screen is visible to anyone
 * holding the phone, so no names, contact details or profile facts. The app
 * opens `path` when the notification is tapped.
 */
export const PUSH_MESSAGES = {
  REQUEST_RECEIVED: { title: 'You have a new request', body: 'Open At-Tayyibun to respond.', path: '/requests' },
  REQUEST_APPROVED: { title: 'Your request was approved', body: 'Open At-Tayyibun to see the details.', path: '/requests' },
} as const;

export type PushKind = keyof typeof PUSH_MESSAGES;

/** FCM error codes that mean the token will never work again. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

const APP_NAME = 'attayyibun-push';

/** Same cleanup as the web app's firebase-admin.ts, for the same env vars. */
function cleanEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
}

/**
 * Sends push notifications through FCM HTTP v1 (firebase-admin).
 *
 * Never throws and never blocks the caller: `notify` returns at once and the
 * send runs in the background. Without FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY it does nothing, so local and
 * test environments run without credentials.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  /** undefined: not tried yet; null: not configured or failed to start. */
  private messaging: Messaging | null | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly devices: DevicesService,
  ) {}

  /** Fire-and-forget. Call only after the change it announces is committed. */
  notify(userId: string, kind: PushKind): void {
    void this.send(userId, kind).catch((err: unknown) => {
      this.logger.warn(`Push ${kind} failed: ${errorCode(err)}`);
    });
  }

  /** Awaitable form of `notify`, for tests. Resolves to the number of devices reached. */
  async send(userId: string, kind: PushKind): Promise<number> {
    const messaging = this.getMessaging();
    if (!messaging) return 0;

    const tokens = await this.devices.tokensFor(userId);
    if (tokens.length === 0) return 0;

    const { title, body, path } = PUSH_MESSAGES[kind];
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { path },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    const dead = result.responses
      .map((r, i) => (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code) ? tokens[i] : null))
      .filter((t): t is string => t !== null);
    if (dead.length > 0) await this.devices.removeTokens(dead);

    if (result.failureCount > dead.length) {
      const codes = result.responses.filter((r) => !r.success).map((r) => errorCode(r.error));
      this.logger.warn(`Push ${kind}: ${result.failureCount} of ${tokens.length} failed (${[...new Set(codes)].join(', ')})`);
    }
    return result.successCount;
  }

  private getMessaging(): Messaging | null {
    if (this.messaging !== undefined) return this.messaging;

    const projectId = cleanEnv(this.config.get<string>('FIREBASE_PROJECT_ID'));
    const clientEmail = cleanEnv(this.config.get<string>('FIREBASE_CLIENT_EMAIL'));
    const rawKey = cleanEnv(this.config.get<string>('FIREBASE_PRIVATE_KEY'));
    if (!projectId || !clientEmail || !rawKey) {
      this.logger.log('Push notifications disabled: FIREBASE_* credentials are not set');
      this.messaging = null;
      return null;
    }

    try {
      // Hosting providers store the PEM on one line with literal "\n".
      const privateKey = rawKey.replace(/\\n/g, '\n');
      const app =
        getApps().find((a) => a.name === APP_NAME) ??
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, APP_NAME);
      this.messaging = getMessaging(app);
    } catch (err) {
      // Never log the error object itself: a PEM parse error can echo key text.
      this.logger.error(`Push notifications disabled: Firebase failed to start (${errorCode(err)})`);
      this.messaging = null;
    }
    return this.messaging;
  }
}

/** A loggable reason with no message text, which can carry tokens or key material. */
function errorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    return (err as { name?: string }).name ?? 'error';
  }
  return 'error';
}
