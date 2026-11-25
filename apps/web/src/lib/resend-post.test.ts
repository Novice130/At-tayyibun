import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { postToResend, RESEND_EMAILS_URL } from "./resend-post";

function fakeFetch(responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const limited = (retryAfter?: string) =>
  new Response('{"name":"rate_limit_exceeded"}', {
    status: 429,
    headers: retryAfter ? { "retry-after": retryAfter } : {},
  });

describe("postToResend", () => {
  it("posts once and resolves on success", async () => {
    const { impl, calls } = fakeFetch([new Response("{}", { status: 200 })]);
    await postToResend("key", { to: ["a@example.com"] }, { fetchImpl: impl, sleep: async () => {} });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, RESEND_EMAILS_URL);
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer key");
  });

  it("retries a 429 with backoff and then succeeds", async () => {
    const waits: number[] = [];
    const { impl, calls } = fakeFetch([limited(), limited(), new Response("{}", { status: 200 })]);
    await postToResend("key", {}, { fetchImpl: impl, sleep: async (ms) => void waits.push(ms) });
    assert.equal(calls.length, 3);
    assert.deepEqual(waits, [600, 1200]);
  });

  it("honours a longer Retry-After", async () => {
    const waits: number[] = [];
    const { impl } = fakeFetch([limited("2"), new Response("{}", { status: 200 })]);
    await postToResend("key", {}, { fetchImpl: impl, sleep: async (ms) => void waits.push(ms) });
    assert.deepEqual(waits, [2000]);
  });

  it("gives up rather than wait past the budget", async () => {
    const { impl, calls } = fakeFetch([limited("30")]);
    await assert.rejects(
      postToResend("key", {}, { fetchImpl: impl, sleep: async () => {} }),
      /Resend 429/,
    );
    assert.equal(calls.length, 1);
  });

  it("never retries a 5xx, which may already have sent the email", async () => {
    const { impl, calls } = fakeFetch([new Response("oops", { status: 500 })]);
    await assert.rejects(postToResend("key", {}, { fetchImpl: impl, sleep: async () => {} }), /Resend 500/);
    assert.equal(calls.length, 1);
  });

  it("stops after maxAttempts", async () => {
    const { impl, calls } = fakeFetch([limited(), limited(), limited()]);
    await assert.rejects(postToResend("key", {}, { fetchImpl: impl, sleep: async () => {} }), /Resend 429/);
    assert.equal(calls.length, 3);
  });
});
