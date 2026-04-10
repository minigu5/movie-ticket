import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTransporter } from '@/lib/mailer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date().toISOString();
    // 1. 결과 메일이 발송되지 않았고 만료 시간이 지난 단체 리더 조회
    const { data: leadersToReport } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('is_group_leader', true)
      .eq('group_report_sent', false)
      .lt('group_expires_at', now);

    if (!leadersToReport || leadersToReport.length === 0) {
      return NextResponse.json({ message: 'No groups to report found', processed: 0 });
    }

    const { transporter, user: senderUser } = getTransporter();
    let processedGroups = 0;

    for (const leader of leadersToReport) {
      const gid = leader.group_id;

      // 2. 해당 그룹의 모든 멤버 조회
      const { data: allMembers } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('group_id', gid);

      if (!allMembers) continue;

      const confirmedMembers = allMembers.filter(m => m.payment_status === 'confirmed');
      const expiredMembers = allMembers.filter(m => m.payment_status === 'group_pending');

      // 3. 만료된 멤버 삭제
      if (expiredMembers.length > 0) {
        const expiredIds = expiredMembers.map(m => m.id);
        await supabaseAdmin.from('reservations').delete().in('id', expiredIds);
      }

      // 4. 리더 및 확정된 멤버 전원에게 결과 리포트 발송
      const recipients = confirmedMembers; // 리더도 confirmed 상태이므로 포함됨
      const reportHtml = buildResultEmail(leader.student_name, confirmedMembers, expiredMembers);

      for (const member of recipients) {
        const email = getEmail(member);
        if (email) {
          try {
            await transporter.sendMail({
              from: `"영화대교 예매시스템" <${senderUser}>`,
              to: email,
              subject: `[영화대교] 단체 예매 최종 결과 안내 (${confirmedMembers.length}명 확정)`,
              html: reportHtml
            });
          } catch (e) { console.error('Report email error:', e); }
        }
      }

      // 5. 만료된 멤버들에게 취소 안내 메일 발송
      for (const expired of expiredMembers) {
        const email = getEmail(expired);
        if (email) {
          try {
            await transporter.sendMail({
              from: `"영화대교 예매시스템" <${senderUser}>`,
              to: email,
              subject: `[영화대교] ${expired.student_name}님의 단체 예매가 시간 초과로 취소되었습니다`,
              html: buildCancelEmail(expired.student_name, expired.seat_number, leader.student_name)
            });
          } catch (e) { console.error('Cancel email error:', e); }
        }
      }

      // 6. 리더의 리포트 발송 상태 업데이트
      await supabaseAdmin.from('reservations')
        .update({ group_report_sent: true })
        .eq('id', leader.id);

      // 7. 로그 기록
      await supabaseAdmin.from('activity_logs').insert([{
        student_id: leader.student_id,
        student_name: leader.student_name,
        description: `단체 예매 리포트 발송 완료: ${confirmedMembers.length}명 성공, ${expiredMembers.length}명 취소`
      }]);

      processedGroups++;
    }

    return NextResponse.json({ message: 'Group check completed', processedGroups });
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
  const isFullSuccess = expired.length === 0;
  
  const confirmedList = confirmed.map(m => `
    <li style="margin:8px 0;padding:12px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;list-style:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#10b981;font-weight:bold;">${m.student_name}</span>
        <span style="background:#10b981;color:white;padding:2px 8px;border-radius:5px;font-size:11px;">${m.seat_number}</span>
      </div>
    </li>
  `).join('');

  const expiredList = expired.map(m => `
    <li style="margin:8px 0;padding:12px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:10px;list-style:none;opacity:0.7;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#ef4444;">${m.student_name}</span>
        <span style="background:#ef4444;color:white;padding:2px 8px;border-radius:5px;font-size:11px;">${m.seat_number}</span>
      </div>
    </li>
  `).join('');

  return `
    <!DOCTYPE html><html><head><meta name="color-scheme" content="light"></head>
    <body style="margin:0;padding:0;background-color:#fceea7;">
      <div style="padding:40px 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;text-align:center;">
        <div style="max-width:440px;margin:0 auto;background-color:#2C3338;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.3);text-align:left;">
          <div style="padding:30px 25px;color:white;">
            <div style="text-align:center;margin-bottom:20px;">
              <span style="font-size:40px;">${isFullSuccess ? '🎉' : '📋'}</span>
            </div>
            <p style="color:${isFullSuccess ? '#10b981' : '#fbbf24'};font-weight:bold;font-size:12px;letter-spacing:2px;margin:0 0 10px 0;text-align:center;text-transform:uppercase;">
              ${isFullSuccess ? 'Mission Accomplished' : 'Group Status Report'}
            </p>
            <h1 style="margin:0 0 10px 0;font-size:22px;text-align:center;line-height:1.4;">
              ${leaderName}님의 단체 예매<br/>최종 결과 안내
            </h1>
            <p style="color:#94a3b8;font-size:14px;text-align:center;margin-bottom:30px;">
              주어진 1시간의 유효 시간이 만료되었습니다.<br/>최종 확정된 멤버 명단을 확인해 주세요.
            </p>

            ${confirmed.length > 0 ? `
              <div style="margin-bottom:25px;">
                <p style="color:#10b981;font-weight:bold;font-size:14px;margin-bottom:10px;display:flex;align-items:center;gap:5px;">
                  ✨ 확정된 멤버 (${confirmed.length}명)
                </p>
                <div style="padding:0;margin:0;">${confirmedList}</div>
              </div>
            ` : ''}

            ${expired.length > 0 ? `
              <div style="margin-bottom:10px;">
                <p style="color:#ef4444;font-weight:bold;font-size:14px;margin-bottom:10px;">
                  ⏰ 시간 초과 (${expired.length}명)
                </p>
                <div style="padding:0;margin:0;">${expiredList}</div>
                <p style="color:#64748b;font-size:11px;margin-top:10px;">* 위 좌석은 시간 초과로 인해 자동으로 예매가 취소 및 해제되었습니다.</p>
              </div>
            ` : ''}
          </div>
          
          <div style="background-color:rgba(0,0,0,0.2);padding:20px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="color:#94a3b8;font-size:12px;margin:0;">본 메일은 시스템에 의해 자동으로 발송되었습니다.</p>
            <p style="color:#4f46e5;font-weight:bold;font-size:13px;margin:5px 0 0 0;">🎬 영화대교 Ticketing System</p>
          </div>
        </div>
      </div>
    </body></html>
  `;
}
