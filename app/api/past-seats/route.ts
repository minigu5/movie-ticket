// app/api/past-seats/route.ts
// 보관 중인(is_active=false) 회차의 좌석 점유 현황을 비로그인 사용자에게도 공개하기 위한 전용 엔드포인트.
// reservations 테이블은 RLS로 anon select가 막혀있어(개인정보 보호), service-role로 seat_number/payment_status만
// 골라 응답한다 — student_name/student_id/email 등은 이 경로로도 절대 반환하지 않는다.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const movieSettingsId = Number(searchParams.get('movieSettingsId'));
  if (!Number.isInteger(movieSettingsId)) {
    return NextResponse.json({ success: false, error: 'movieSettingsId가 필요합니다.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: movie, error: movieError } = await supabaseAdmin
    .from('movie_settings')
    .select('id, is_active')
    .eq('id', movieSettingsId)
    .maybeSingle();
  if (movieError) return NextResponse.json({ success: false, error: movieError.message }, { status: 500 });
  if (!movie || movie.is_active) {
    return NextResponse.json({ success: false, error: '보관 중인 회차만 조회할 수 있습니다.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('seat_number, payment_status')
    .eq('movie_settings_id', movieSettingsId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data });
}
