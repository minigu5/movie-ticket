// app/api/current-seats/route.ts
// 현재 상영 중인(is_active=true) 회차의 좌석 점유 현황을 비로그인 사용자에게도 공개하기 위한 전용 엔드포인트.
// reservations 테이블은 RLS로 anon select가 막혀있어(개인정보 보호), service-role로 seat_number/payment_status/
// group_expires_at만 골라 응답한다 — student_name/student_id/email 등은 이 경로로도 절대 반환하지 않는다.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: movie, error: movieError } = await supabaseAdmin
    .from('movie_settings')
    .select('db_date')
    .eq('is_active', true)
    .maybeSingle();
  if (movieError) return NextResponse.json({ success: false, error: movieError.message }, { status: 500 });
  if (!movie) return NextResponse.json({ success: true, data: [] });

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('seat_number, payment_status, group_expires_at')
    .eq('movie_date', movie.db_date);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data });
}
