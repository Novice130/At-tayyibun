import { BlockList, isIP } from 'net';

/**
 * Who is really on the other end of a request.
 *
 * `trust proxy` is 1 (main.ts), so req.ip is the rightmost X-Forwarded-For
 * entry: the peer of our own proxy, which that proxy wrote and a client cannot
 * forge. That peer is not the visitor:
 *
 *   Production: Cloudflare -> Caddy -> API. Caddy appends its TCP peer to XFF.
 *     `client_ip_headers CF-Connecting-IP` only changes Caddy's own {client_ip}
 *     (reverseproxy.go addForwardedHeaders appends req.RemoteAddr), so req.ip
 *     is a Cloudflare edge address, shared by unrelated visitors.
 *   Staging: Cloudflare -> tunnel -> Traefik -> API. req.ip is the tunnel
 *     connector's private address, or a LAN client's if one reaches Traefik.
 *
 * CF-Connecting-IP holds the visitor, and Cloudflare overwrites whatever a
 * client sends, but Caddy and Traefik both pass it through untouched. So it
 * counts only when the hop that handed us the request is provably Cloudflare.
 * Production passes that test. Staging does not and stays on req.ip, which
 * groups its anonymous traffic but cannot be spoofed from the LAN.
 */

// Same list as trusted_proxies in infra/hetzner/caddy/Caddyfile, from
// https://www.cloudflare.com/ips/. A range missing here degrades safely: those
// visitors are grouped by edge address again.
const CLOUDFLARE_IPV4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];
const CLOUDFLARE_IPV6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];
const PRIVATE_IPV4 = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'];
const PRIVATE_IPV6 = ['fc00::/7', '::1/128', 'fe80::/10'];

function blockList(v4: string[], v6: string[]): BlockList {
  const list = new BlockList();
  const add = (cidr: string, family: 'ipv4' | 'ipv6') => {
    const [net, prefix] = cidr.split('/');
    list.addSubnet(net, Number(prefix), family);
  };
  v4.forEach((c) => add(c, 'ipv4'));
  v6.forEach((c) => add(c, 'ipv6'));
  return list;
}

const cloudflare = blockList(CLOUDFLARE_IPV4, CLOUDFLARE_IPV6);
const privateNets = blockList(PRIVATE_IPV4, PRIVATE_IPV6);

function inList(list: BlockList, ip: string): boolean {
  return list.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}

/** The address as text, without an IPv4-mapped prefix, or null if it is not one address. */
function parseIp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const unmapped = trimmed.toLowerCase().startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  return isIP(unmapped) ? unmapped : null;
}

export interface ClientIpRequest {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}

export function getClientIp(req: ClientIpRequest): string {
  const socketPeer = parseIp(req.socket?.remoteAddress);

  // Our proxies reach the API over a private Docker network. A public socket
  // peer means no proxy of ours is involved, so every forwarding header on the
  // request, and the req.ip derived from them, is the caller's own claim.
  if (socketPeer && !inList(privateNets, socketPeer)) return socketPeer;

  const lastHop = parseIp(req.ip);
  if (lastHop && inList(cloudflare, lastHop)) {
    const visitor = parseIp(req.headers['cf-connecting-ip']);
    if (visitor) return visitor;
  }
  return lastHop ?? socketPeer ?? 'unknown';
}

/**
 * The rate-limit key for an address. One customer holds a whole IPv6 /64, so
 * counting single addresses would let them rotate past any limit.
 */
export function ipRateLimitBucket(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  const groups = [...headGroups, ...Array(Math.max(missing, 0)).fill('0'), ...tailGroups];
  return `${groups.slice(0, 4).map((g) => g.padStart(4, '0')).join(':')}::/64`;
}
