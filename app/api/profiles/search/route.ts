// app/api/profiles/search/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserFromRequest } from '@/lib/api-auth';

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });

  const url = new URL(req.url);
  const rawQ = url.searchParams.get('q') || '';
  // PostgREST .or() 필터 문자열에 그대로 들어가므로 위험 문자를 제거한다.
  const q = rawQ.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim().slice(0, 20);
  if (q.length < 1) return NextResponse.json({ success: true, results: [] });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, student_id, name, email')
    .neq('id', user.id)
    .or(`name.ilike.%${q}%,student_id.eq.${q}`)
    .limit(10);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, results: data });
}
