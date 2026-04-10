import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date().toISOString();

    // 만료된 group_pending 예약 조회
    const { data: expiredReservations } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('payment_status', 'group_pending')
      .lt('group_expires_at', now);

    if (!expiredReservations || expiredReservations.length === 0) {
      return NextResponse.json({ message: 'No expired group reservations found', processed: 0 });
    }

    // 그룹별로 분류
    const groupMap = new Map<string, any[]>();
    expiredReservations.forEach(r => {
      const gid = r.group_id;
      if (!groupMap.has(gid)) groupMap.set(gid, []);
      groupMap.get(gid)!.push(r);
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    let processedCount = 0;

    for (const [gid, expiredMembers] of groupMap) {
      // 해당 그룹의 전체 정보 조회 (확정된 멤버 + 리더 포함)
      const { data: allGroupMembers } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('group_id', gid);

      const leaderRes = allGroupMembers?.find(m => m.is_group_leader);
      const confirmedMembers = allGroupMembers?.filter(m => !m.is_group_leader && m.payment_status === 'confirmed') || [];

      // 만료된 멤버 삭제
      const expiredIds = expiredMembers.map(m => m.id);
      await supabaseAdmin.from('reservations').delete().in('id', expiredIds);

      // 만료 멤버에게 취소 메일 발송
      for (const expired of expiredMembers) {
        const email = getEmail(expired);
        if (email) {
          try {
            await transporter.sendMail({
              from: `"영화대교 예매시스템" <${process.env.GMAIL_USER}>`,
              to: email,
              subject: `[영화대교] ${expired.student_name}님의 단체 예매가 시간 초과로 취소되었습니다`,
              html: buildCancelEmail(expired.student_name, expired.seat_number, leaderRes?.student_name || '알 수 없음')
            });
          } catch (e) { console.error('Cancel email error:', e); }
        }
      }

      // 리더에게 결과 안내 메일 발송
      if (leaderRes) {
        const leaderEmail = getEmail(leaderRes);
        if (leaderEmail) {
          try {
            await transporter.sendMail({
              from: `"영화대교 예매시스템" <${process.env.GMAIL_USER}>`,
              to: leaderEmail,
              subject: `[영화대교] 단체 예매 결과 안내 - ${confirmedMembers.length}명 확정`,
              html: buildResultEmail(leaderRes.student_name, confirmedMembers, expiredMembers)
            });
          } catch (e) { console.error('Result email error:', e); }
        }
      }

      // 로그 기록
      await supabaseAdmin.from('activity_logs').insert([{
        student_id: leaderRes?.student_id || 'system',
        student_name: leaderRes?.student_name || 'system',
        description: `단체 예매 만료 처리: ${expiredMembers.length}명 취소, ${confirmedMembers.length}명 확정`
      }]);

      processedCount += expiredMembers.length;
    }

    return NextResponse.json({ message: 'Group check completed', processed: processedCount });
  } catch (error) {
    console.error('Group check error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function getEmail(reservation: any): string | null {
  // 학번→이메일 매핑은 서버에서 직접 접근하기 어려우므로 간접 구현
  // USER_EMAILS를 여기서도 사용
  try {
    const { USER_EMAILS } = require('@/lib/emails');
    const key = reservation.student_id === "교직원" ? reservation.student_name : reservation.student_id;
    return USER_EMAILS[key] || null;
  } catch { return null; }
}

function buildCancelEmail(name: string, seat: string, leaderName: string): string {
  return `
    <!DOCTYPE html><html><head><meta name="color-scheme" content="light"></head>
    <body style="margin:0;padding:0;">
      <div style="background-color:#fceea7;padding:40px 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;text-align:center;">
        <div style="max-width:380px;margin:0 auto;background-color:#2C3338;border-radius:16px;overflow:hidden;box-shadow:0 15px 25px rgba(0,0,0,0.2);">
          <div style="padding:30px 25px;color:white;">
            <p style="color:#ef4444;font-weight:bold;font-size:12px;letter-spacing:1px;margin:0 0 5px 0;">⏰ 시간 초과</p>
            <h1 style="margin:0 0 20px 0;font-size:20px;line-height:1.4;">${name}님의 단체 예매가<br/>시간 초과로 취소되었습니다</h1>
            <p style="color:#94a3b8;font-size:14px;">리더 ${leaderName}님의 단체 관람 초대에<br/>1시간 이내에 응답하지 않아 좌석(${seat})이 해제되었습니다.</p>
          </div>
          <div style="background-color:#F3EFE6;padding:20px;text-align:center;">
            <div style="font-size:36px;font-weight:900;color:#ef4444;text-decoration:line-through;">${seat}</div>
            <div style="margin-top:10px;padding:8px;background-color:#FEE2E2;border-radius:8px;font-weight:bold;font-size:13px;color:#991B1B;border:1px solid #991B1B;">예매 취소됨</div>
          </div>
        </div>
      </div>
    </body></html>
  `;
}

function buildResultEmail(leaderName: string, confirmed: any[], expired: any[]): string {
  const confirmedList = confirmed.map(m => `<li style="color:#10b981;margin:5px 0;">${m.student_name} (${m.seat_number}) - ✅ 확정</li>`).join('');
  const expiredList = expired.map(m => `<li style="color:#ef4444;margin:5px 0;">${m.student_name} (${m.seat_number}) - ❌ 시간 초과</li>`).join('');

  return `
    <!DOCTYPE html><html><head><meta name="color-scheme" content="light"></head>
    <body style="margin:0;padding:0;">
      <div style="background-color:#fceea7;padding:40px 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;text-align:center;">
        <div style="max-width:400px;margin:0 auto;background-color:#2C3338;border-radius:16px;overflow:hidden;box-shadow:0 15px 25px rgba(0,0,0,0.2);text-align:left;">
          <div style="padding:25px;color:white;">
            <p style="color:#10b981;font-weight:bold;font-size:12px;letter-spacing:1px;margin:0 0 5px 0;">📊 단체 예매 결과</p>
            <h1 style="margin:0 0 20px 0;font-size:18px;">${leaderName}님의 단체 예매 최종 결과</h1>
            ${confirmed.length > 0 ? `
              <p style="color:#10b981;font-weight:bold;font-size:13px;margin:15px 0 5px 0;">확정된 멤버 (${confirmed.length}명)</p>
              <ul style="list-style:none;padding:0;margin:0;">${confirmedList}</ul>
            ` : ''}
            ${expired.length > 0 ? `
              <p style="color:#ef4444;font-weight:bold;font-size:13px;margin:15px 0 5px 0;">시간 초과 (${expired.length}명)</p>
              <ul style="list-style:none;padding:0;margin:0;">${expiredList}</ul>
            ` : ''}
          </div>
        </div>
      </div>
    </body></html>
  `;
}
