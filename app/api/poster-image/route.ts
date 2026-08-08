import { NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

function ipv4ToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inRange(ip: number, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (ipv4ToInt(base) & mask);
}

// RFC 1918/5735/6598 private, loopback, link-local (incl. cloud metadata 169.254.169.254),
// CGNAT, multicast, and reserved ranges — all disallowed as fetch targets.
function isPublicIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const blocked: [string, number][] = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ];
  return !blocked.some(([base, bits]) => inRange(n, base, bits));
}

function isPublicIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return false;
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return false; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return false; // unique local (fc00::/7)
  if (lower.startsWith('ff')) return false; // multicast
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicIpv4(mapped[1]);
  return true;
}

function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPublicIpv4(ip);
  if (family === 6) return isPublicIpv6(ip);
  return false;
}

async function assertSafeTarget(target: URL): Promise<void> {
  if (target.protocol !== 'https:') {
    throw new Error('Only https URLs are allowed');
  }
  if (target.port && target.port !== '443') {
    throw new Error('Only default https port is allowed');
  }

  const hostname = target.hostname;
  // Reject literal IP targets and require a resolvable hostname so every
  // target goes through the DNS-based private/metadata IP check below.
  if (isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new Error('Target host is not allowed');
    return;
  }

  const records = await lookup(hostname, { all: true });
  // workerd's node:dns lookup() polyfill can include CNAME chain entries
  // alongside resolved A/AAAA records; isIP() rejects those, so filter to
  // actual IP addresses before validating.
  const ipRecords = records.filter((r) => isIP(r.address) !== 0);
  if (ipRecords.length === 0) throw new Error('Could not resolve host');
  for (const { address } of ipRecords) {
    if (!isPublicIp(address)) throw new Error('Target host is not allowed');
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const src = searchParams.get('src');
  if (!src) return new NextResponse('Missing src', { status: 400 });

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    let redirects = 0;
    let upstream: Response;
    for (;;) {
      await assertSafeTarget(target);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        upstream = await fetch(target.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MovieBridgeBot/1.0)' },
          redirect: 'manual',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location');
        if (!location) return new NextResponse('Redirect missing location', { status: 502 });
        if (++redirects > MAX_REDIRECTS) {
          return new NextResponse('Too many redirects', { status: 502 });
        }
        target = new URL(location, target);
        continue;
      }
      break;
    }

    if (!upstream.ok) return new NextResponse('Upstream error', { status: 502 });

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 415 });
    }

    const declaredLength = Number(upstream.headers.get('content-length') || '0');
    if (declaredLength > MAX_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }

    if (!upstream.body) return new NextResponse('Upstream error', { status: 502 });
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return new NextResponse('Image too large', { status: 413 });
      }
      chunks.push(value);
    }

    const buf = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return new NextResponse('Fetch failed', { status: 502 });
  }
}
