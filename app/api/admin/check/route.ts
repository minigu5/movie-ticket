// app/api/admin/check/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export const runtime = 'edge';

export async function GET(req: Request) {
  const result = await requireAdmin(req);
  return NextResponse.json({ success: true, isAdmin: result.ok });
}
