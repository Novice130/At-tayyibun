/**
 * Paces and retries calls to Resend's API.
 *
 * Design: one in-process scheduler per API instance (Resend allows 2 requests
 * per second per team by default). Every call reserves a start slot; slots are
 * at least `intervalMs` apart. Campaign sends additionally keep a wider gap
 * from each other (they use CAMPAIGN_SHARE of the rate), so a transactional
 * email, such as a password reset, always finds a free slot within one
 * interval and a campaign cannot starve it. This is only correct while a
 * single API instance sends; with more instances, divide the rate between them
 * through RESEND_RATE_LIMIT_RPS.
 *
 * Retry: HTTP 429 (not quota errors) is always retried, since Resend rejected
 * the request before processing it. 5xx and network errors are ambiguous (the
 * email may have gone out), so they are retried only when an idempotency key
 * is set, which makes Resend return the first result instead of sending twice.
 */

export type SendKind = 'campaign' | 'transactional';

export interface ResendSenderOptions {
  /** Requests per second. Default 2. */
  rps: number;
  /** Total attempts per message, including the first. Default 5. */
  maxAttempts: number;
  /** First backoff step in ms. Default 1000. */
  baseDelayMs: number;
  /** Longest single wait in ms. Default 30000. */
  maxDelayMs: number;
}

export const CAMPAIGN_SHARE = 0.8;

export const DEFAULT_SENDER_OPTIONS: ResendSenderOptions = {
  rps: 2,
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export interface ResendError {
  name?: string;
  message?: string;
  statusCode?: number | null;
}

export interface ResendResult {
  data?: unknown;
  error?: ResendError | null;
  headers?: Record<string, string> | null;
}

export class ResendSendError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Failure = 'rate-limit' | 'transient' | 'permanent';

function classify(error: ResendError): Failure {
  const status = error.statusCode ?? null;
  if (error.name === 'daily_quota_exceeded' || error.name === 'monthly_quota_exceeded') return 'permanent';
  if (status === 429 || error.name === 'rate_limit_exceeded') return 'rate-limit';
  // The SDK reports network failures as application_error with no status.
  if (status === null && error.name === 'application_error') return 'transient';
  if (status !== null && status >= 500) return 'transient';
  if (error.name === 'internal_server_error') return 'transient';
  // concurrent_idempotent_requests: the first request is still in flight.
  if (error.name === 'concurrent_idempotent_requests') return 'transient';
  return 'permanent';
}

/** Seconds from Retry-After / ratelimit-reset (the SDK lowercases header names). */
export function retryAfterMs(headers?: Record<string, string> | null): number | null {
  if (!headers) return null;
  const raw = headers['retry-after'] ?? headers['ratelimit-reset'];
  if (raw === undefined) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.ceil(seconds * 1000);
}

export class ResendSender {
  private nextSlot = 0;
  private lastCampaignSlot = -Infinity;
  private readonly opts: ResendSenderOptions;

  constructor(opts: Partial<ResendSenderOptions> = {}) {
    const merged = { ...DEFAULT_SENDER_OPTIONS, ...opts };
    this.opts = {
      rps: merged.rps > 0 ? merged.rps : DEFAULT_SENDER_OPTIONS.rps,
      maxAttempts: Math.max(1, Math.floor(merged.maxAttempts)),
      baseDelayMs: merged.baseDelayMs,
      maxDelayMs: merged.maxDelayMs,
    };
  }

  private get intervalMs() {
    return 1000 / this.opts.rps;
  }

  /** Reserve the next start slot synchronously (no await between read and write), then wait for it. */
  private async acquire(kind: SendKind): Promise<void> {
    const now = Date.now();
    let start = Math.max(now, this.nextSlot);
    if (kind === 'campaign') start = Math.max(start, this.lastCampaignSlot + this.intervalMs / CAMPAIGN_SHARE);
    this.nextSlot = start + this.intervalMs;
    if (kind === 'campaign') this.lastCampaignSlot = start;
    if (start > now) await sleep(start - now);
  }

  /** Everyone waits out a server-announced rate limit. */
  private pauseUntil(ts: number) {
    this.nextSlot = Math.max(this.nextSlot, ts);
  }

  private backoff(attempt: number, headerMs: number | null): number {
    const exp = Math.min(this.opts.maxDelayMs, this.opts.baseDelayMs * 2 ** (attempt - 1));
    const jittered = exp / 2 + Math.random() * (exp / 2);
    const wait = headerMs !== null ? Math.max(headerMs, jittered) : jittered;
    return Math.min(this.opts.maxDelayMs, wait);
  }

  /**
   * Run `send` under the limiter. Resolves with the successful result; throws
   * ResendSendError when it is refused or attempts run out.
   */
  async run(
    send: () => Promise<ResendResult>,
    opts: { kind: SendKind; idempotent: boolean },
  ): Promise<ResendResult> {
    for (let attempt = 1; ; attempt++) {
      await this.acquire(opts.kind);

      let result: ResendResult;
      try {
        result = await send();
      } catch (err) {
        // Thrown before or during the request: ambiguous, like a network error.
        result = { error: { name: 'application_error', statusCode: null, message: String(err) } };
      }
      if (!result.error) return result;

      const failure = classify(result.error);
      const code = result.error.name;
      const retryable = failure === 'rate-limit' || (failure === 'transient' && opts.idempotent);
      if (!retryable || attempt >= this.opts.maxAttempts) {
        throw new ResendSendError(`Resend refused the email: ${code}`, attempt, code);
      }
      const wait = this.backoff(attempt, retryAfterMs(result.headers));
      if (failure === 'rate-limit') this.pauseUntil(Date.now() + wait);
      else await sleep(wait);
    }
  }
}
