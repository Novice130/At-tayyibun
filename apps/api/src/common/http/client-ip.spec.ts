import * as express from 'express';
import { getClientIp, ipRateLimitBucket } from './client-ip';

// The repo has supertest but not @types/supertest; adding it would change the lockfile.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

// A real Express app with the same setting as main.ts, so these cases exercise
// Express's own X-Forwarded-For handling rather than a hand-built req.ip.
// supertest connects over loopback, which stands in for the private Docker hop
// from Caddy (production) or Traefik (staging) to the API.
function app() {
  const a = express();
  a.set('trust proxy', 1);
  a.get('/', (req, res) => {
    res.json({ clientIp: getClientIp(req), reqIp: req.ip });
  });
  return a;
}

const CF_EDGE = '162.158.10.20';
const CF_EDGE_V6 = '2606:4700:10::6816:1';
const VISITOR = '203.0.113.9';
const ATTACKER = '198.51.100.7';
const FORGED = '8.8.8.8';

async function resolve(headers: Record<string, string>) {
  const res = await request(app()).get('/').set(headers).expect(200);
  return res.body as { clientIp: string; reqIp: string };
}

describe('getClientIp', () => {
  describe('production: Cloudflare -> Caddy -> API', () => {
    it('documents the bug: req.ip alone is the Cloudflare edge, not the visitor', async () => {
      const { reqIp } = await resolve({
        'x-forwarded-for': `${VISITOR}, ${CF_EDGE}`,
        'cf-connecting-ip': VISITOR,
      });
      expect(reqIp).toBe(CF_EDGE);
    });

    it('uses CF-Connecting-IP when the last hop is a Cloudflare edge', async () => {
      const { clientIp } = await resolve({
        'x-forwarded-for': `${VISITOR}, ${CF_EDGE}`,
        'cf-connecting-ip': VISITOR,
      });
      expect(clientIp).toBe(VISITOR);
    });

    it('accepts an IPv6 Cloudflare edge and an IPv6 visitor', async () => {
      const { clientIp } = await resolve({
        'x-forwarded-for': `2001:db8::1, ${CF_EDGE_V6}`,
        'cf-connecting-ip': '2001:db8::1',
      });
      expect(clientIp).toBe('2001:db8::1');
    });

    it('ignores what a visitor forges through Cloudflare: Cloudflare overwrites CF-Connecting-IP and appends to XFF', async () => {
      const { clientIp } = await resolve({
        'x-forwarded-for': `${FORGED}, ${VISITOR}, ${CF_EDGE}`,
        'cf-connecting-ip': VISITOR,
      });
      expect(clientIp).toBe(VISITOR);
    });
  });

  describe('spoofing when Cloudflare is not the last hop', () => {
    it('ignores a forged CF-Connecting-IP from a non-Cloudflare peer (Caddy replaces XFF with the peer)', async () => {
      const { clientIp } = await resolve({
        'x-forwarded-for': ATTACKER,
        'cf-connecting-ip': FORGED,
      });
      expect(clientIp).toBe(ATTACKER);
    });

    it('is not fooled by a Cloudflare address placed earlier in XFF', async () => {
      const { clientIp } = await resolve({
        'x-forwarded-for': `${CF_EDGE}, ${ATTACKER}`,
        'cf-connecting-ip': FORGED,
      });
      expect(clientIp).toBe(ATTACKER);
    });

    it('never honours CF-Connecting-IP with no forwarding header at all', async () => {
      const { clientIp } = await resolve({ 'cf-connecting-ip': FORGED });
      expect(clientIp).toBe('127.0.0.1');
    });

    it('ignores forged headers when the socket peer is public (API port exposed by mistake)', () => {
      const req = {
        ip: CF_EDGE, // what trust proxy 1 would derive from a forged XFF
        socket: { remoteAddress: ATTACKER },
        headers: { 'cf-connecting-ip': FORGED, 'x-forwarded-for': `${FORGED}, ${CF_EDGE}` },
      };
      expect(getClientIp(req)).toBe(ATTACKER);
    });
  });

  describe('staging: Cloudflare -> tunnel -> Traefik -> API', () => {
    it('does not trust CF-Connecting-IP: the hop before Traefik is the private tunnel connector, which a LAN client could also be', async () => {
      const { clientIp } = await resolve({
        'x-forwarded-for': '172.18.0.5',
        'cf-connecting-ip': FORGED,
      });
      expect(clientIp).toBe('172.18.0.5');
    });
  });

  describe('malformed input falls back to the last hop', () => {
    it.each([
      ['garbage', 'not-an-ip'],
      ['duplicate header folded into a list', `${FORGED}, ${VISITOR}`],
      ['empty', ''],
      ['port suffix', `${VISITOR}:443`],
    ])('%s', async (_label, value) => {
      const { clientIp } = await resolve({
        'x-forwarded-for': `${VISITOR}, ${CF_EDGE}`,
        'cf-connecting-ip': value,
      });
      expect(clientIp).toBe(CF_EDGE);
    });
  });

  it('strips the IPv4-mapped prefix', () => {
    const req = {
      ip: '::ffff:10.0.0.5',
      socket: { remoteAddress: '::ffff:10.0.0.5' },
      headers: {},
    };
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('returns "unknown" rather than throwing when nothing is available', () => {
    expect(getClientIp({ headers: {} })).toBe('unknown');
  });
});

describe('ipRateLimitBucket', () => {
  it('keeps an IPv4 address whole', () => {
    expect(ipRateLimitBucket('203.0.113.9')).toBe('203.0.113.9');
  });

  it('groups an IPv6 address by /64 so rotating inside one allocation does not escape the limit', () => {
    expect(ipRateLimitBucket('2001:db8:1:2:aaaa::1')).toBe(ipRateLimitBucket('2001:db8:1:2:bbbb::2'));
    expect(ipRateLimitBucket('2001:db8:1:2::1')).not.toBe(ipRateLimitBucket('2001:db8:1:3::1'));
  });

  it('expands compressed forms to the same bucket', () => {
    expect(ipRateLimitBucket('2001:db8::1')).toBe(ipRateLimitBucket('2001:0db8:0000:0000:ffff::2'));
  });

  it('passes non-addresses through', () => {
    expect(ipRateLimitBucket('unknown')).toBe('unknown');
  });
});
