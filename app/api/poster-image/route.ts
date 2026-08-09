import { NextResponse } from 'next/server';
import { fetchSafeImage } from '@/lib/safeImageFetch';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const src = searchParams.get('src');
  if (!src) return new NextResponse('Missing src', { status: 400 });

  const result = await fetchSafeImage(src);
  if (!result.ok) return new NextResponse(result.message, { status: result.status });

  return new NextResponse(result.body, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
