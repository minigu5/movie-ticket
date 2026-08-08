import { NextResponse } from 'next/server';

const MAX_BYTES = 8 * 1024 * 1024;

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
  if (target.protocol !== 'https:') {
    return new NextResponse('Only https URLs are allowed', { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MovieBridgeBot/1.0)' },
    });
    if (!upstream.ok) return new NextResponse('Upstream error', { status: 502 });

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 415 });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
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
