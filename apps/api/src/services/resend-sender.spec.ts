import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { ResendSendError, ResendSender, retryAfterMs } from './resend-sender';

const ok = { data: { id: 'e1' }, error: null };
const limited = (headers: Record<string, string> | null = null) => ({
  data: null,
  error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'slow down' },
  headers,
});

describe('ResendSender', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps starts at least 1/rps apart', async () => {
    const sender = new ResendSender({ rps: 2 });
    const starts: number[] = [];
    const send = jest.fn(async () => {
      starts.push(Date.now());
      return ok;
    });
    const all = Promise.all(Array.from({ length: 5 }, () => sender.run(send, { kind: 'transactional', idempotent: false })));
    await jest.advanceTimersByTimeAsync(5000);
    await all;
    expect(starts).toHaveLength(5);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(500);
  });

  it('paces campaign sends below the full rate, leaving room for transactional mail', async () => {
    const sender = new ResendSender({ rps: 2 });
    const starts: number[] = [];
    const send = jest.fn(async () => {
      starts.push(Date.now());
      return ok;
    });
    const all = Promise.all(Array.from({ length: 4 }, () => sender.run(send, { kind: 'campaign', idempotent: true })));
    await jest.advanceTimersByTimeAsync(5000);
    await all;
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(625);
  });

  it('does not make a transactional email wait behind a queued campaign', async () => {
    const sender = new ResendSender({ rps: 2 });
    const order: string[] = [];
    const mk = (n: string) => async () => {
      order.push(n);
      return ok;
    };
    const c1 = sender.run(mk('c1'), { kind: 'campaign', idempotent: true });
    const c2 = sender.run(mk('c2'), { kind: 'campaign', idempotent: true });
    await jest.advanceTimersByTimeAsync(0);
    const t = sender.run(mk('t'), { kind: 'transactional', idempotent: false });
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.all([c1, c2, t]);
    expect(order.indexOf('t')).toBeLessThanOrEqual(2);
  });

  it('retries a 429 with backoff, then succeeds', async () => {
    const sender = new ResendSender({ rps: 100, baseDelayMs: 1000 });
    const send = jest.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(limited()).mockResolvedValueOnce(ok);
    const p = sender.run(send, { kind: 'transactional', idempotent: false });
    await jest.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(600); // jitter 0.5 => 750ms
    expect(send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(200);
    expect(send).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1100); // second wait 1500ms
    expect(send).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toEqual(ok);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('honours Retry-After when it is longer than the backoff', async () => {
    const sender = new ResendSender({ rps: 100, baseDelayMs: 1000 });
    const send = jest.fn().mockResolvedValueOnce(limited({ 'retry-after': '10' })).mockResolvedValueOnce(ok);
    const p = sender.run(send, { kind: 'transactional', idempotent: false });
    await jest.advanceTimersByTimeAsync(9000);
    expect(send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1100);
    await expect(p).resolves.toEqual(ok);
    expect(retryAfterMs({ 'ratelimit-reset': '3' })).toBe(3000);
    expect(retryAfterMs({})).toBeNull();
  });

  it('gives up after maxAttempts and throws, never reporting success', async () => {
    const sender = new ResendSender({ rps: 100, maxAttempts: 3, baseDelayMs: 100 });
    const send = jest.fn(async () => limited());
    const p = sender.run(send, { kind: 'campaign', idempotent: true });
    const assertion = expect(p).rejects.toBeInstanceOf(ResendSendError);
    await jest.advanceTimersByTimeAsync(60000);
    await assertion;
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('does not retry quota or validation errors', async () => {
    const sender = new ResendSender({ rps: 100 });
    for (const [name, statusCode] of [['daily_quota_exceeded', 429], ['validation_error', 422]] as const) {
      const send = jest.fn(async () => ({ data: null, error: { name, statusCode } }));
      const p = expect(sender.run(send, { kind: 'campaign', idempotent: true })).rejects.toThrow(name);
      await jest.advanceTimersByTimeAsync(1000);
      await p;
      expect(send).toHaveBeenCalledTimes(1);
    }
  });

  it('retries 5xx and network errors only with an idempotency key', async () => {
    const boom = { data: null, error: { name: 'application_error', statusCode: null } };
    const sender = new ResendSender({ rps: 100, baseDelayMs: 10 });

    const unkeyed = jest.fn(async () => boom);
    await expect(sender.run(unkeyed, { kind: 'transactional', idempotent: false })).rejects.toThrow();
    expect(unkeyed).toHaveBeenCalledTimes(1);

    // The SDK returns a network failure as application_error with no status.
    const keyed = jest.fn().mockResolvedValueOnce(boom).mockResolvedValueOnce(ok);
    const p = sender.run(keyed, { kind: 'campaign', idempotent: true });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual(ok);
    expect(keyed).toHaveBeenCalledTimes(2);
  });

  it('rethrows an exception from send unchanged and never retries it', async () => {
    const sender = new ResendSender({ rps: 100, baseDelayMs: 10 });
    const send = jest.fn(async () => {
      throw new Error('RESEND_API_KEY not configured; email sending disabled');
    });
    await expect(sender.run(send, { kind: 'campaign', idempotent: true })).rejects.toThrow('RESEND_API_KEY not configured');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('fails fast, without sending, when the next slot starts after the deadline', async () => {
    const sender = new ResendSender({ rps: 2 });
    const send = jest.fn(async () => ok);
    // Hold the next 3 slots (0, 500, 1000 ms).
    const queued = Promise.all([1, 2, 3].map(() => sender.run(send, { kind: 'transactional', idempotent: false })));
    const late = sender.run(send, { kind: 'transactional', idempotent: false, deadline: Date.now() + 1200 });
    await expect(late).rejects.toMatchObject({ code: 'wait_budget_exceeded' });
    await jest.advanceTimersByTimeAsync(2000);
    await queued;
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('gives up instead of waiting out a Retry-After past the deadline', async () => {
    const sender = new ResendSender({ rps: 100 });
    const send = jest.fn(async () => limited({ 'retry-after': '20' }));
    const p = sender.run(send, { kind: 'transactional', idempotent: false, deadline: Date.now() + 5000 });
    await expect(p).rejects.toMatchObject({ code: 'wait_budget_exceeded' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('EmailService with Resend limits', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function make(env: Record<string, string> = {}) {
    const service = new EmailService(new ConfigService({ EMAIL_POSTAL_ADDRESS: '1 Main St', ...env }));
    const send = jest.fn();
    (service as any).resendInstance = { emails: { send } };
    return { service, send };
  }
  const mail = {
    to: 'm@example.com',
    subject: 's',
    html: '<p>x</p>',
    unsubscribeUrl: 'https://x.test/u',
    oneClickUrl: 'https://x.test/o',
  };

  it('sends the same idempotency key on every retry', async () => {
    const { service, send } = make();
    send.mockResolvedValueOnce(limited()).mockResolvedValueOnce(limited()).mockResolvedValueOnce(ok);
    const p = service.sendCampaignEmail({ ...mail, idempotencyKey: 'campaign/c1/u1' });
    await jest.advanceTimersByTimeAsync(20000);
    await p;
    expect(send).toHaveBeenCalledTimes(3);
    for (const call of send.mock.calls) expect(call[1]).toEqual({ idempotencyKey: 'campaign/c1/u1' });
  });

  it('marks a campaign email failed (throws) once retries are exhausted', async () => {
    const { service, send } = make({ RESEND_MAX_ATTEMPTS: '2' });
    send.mockResolvedValue(limited());
    const p = service.sendCampaignEmail({ ...mail, idempotencyKey: 'k' });
    const assertion = expect(p).rejects.toThrow('rate_limit_exceeded');
    await jest.advanceTimersByTimeAsync(20000);
    await assertion;
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('retries a transactional 429 and then sends', async () => {
    const { service, send } = make();
    send.mockResolvedValueOnce(limited()).mockResolvedValueOnce(ok);
    const p = service.sendEmail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });
    await jest.advanceTimersByTimeAsync(5000);
    await p;
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reads the rate from RESEND_RATE_LIMIT_RPS (default 2)', async () => {
    const { service, send } = make({ RESEND_RATE_LIMIT_RPS: '1' });
    const starts: number[] = [];
    send.mockImplementation(async () => {
      starts.push(Date.now());
      return ok;
    });
    const ps = [1, 2, 3].map(() => service.sendEmail({ to: 'a@b.c', subject: 's', html: 'x' }));
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.all(ps);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(1000);
  });
});
