/**
 * POST one email to Resend, retrying 429s.
 *
 * The API paces its own sends (apps/api/src/services/resend-sender.ts) but
 * cannot see these: the web app's auth emails (password reset, verification,
 * admin OTP) go to Resend directly, on the same team-wide rate limit. A 429 is
 * a refusal before processing, so retrying it cannot send twice. Nothing else
 * is retried: a 5xx or a network error may already have sent the email.
 *
 * These run inside a member's request, so the total wait is capped.
 */

export const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export interface ResendPostOptions {
  /** Total attempts, including the first. */
  maxAttempts?: number;
  /** First backoff step in ms; doubles each retry. */
  baseDelayMs?: number;
  /** Give up rather than wait past this many ms in total. */
  budgetMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after") ?? res.headers.get("ratelimit-reset");
  if (raw === null) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : null;
}

export async function postToResend(
  apiKey: string,
  payload: Record<string, unknown>,
  opts: ResendPostOptions = {},
): Promise<void> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 600;
  const budgetMs = opts.budgetMs ?? 5000;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  let waited = 0;

  for (let attempt = 1; ; attempt++) {
    const res = await doFetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;

    const body = await res.text().catch(() => "");
    const error = new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    if (res.status !== 429 || attempt >= maxAttempts) throw error;

    const backoff = baseDelayMs * 2 ** (attempt - 1);
    const wait = Math.max(backoff, retryAfterMs(res) ?? 0);
    if (waited + wait > budgetMs) throw error;
    waited += wait;
    await sleep(wait);
  }
}
