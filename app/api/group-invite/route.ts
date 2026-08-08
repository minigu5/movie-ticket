import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { escapeHtml } from '@/lib/escapeHtml';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { members, leaderName, movieTitle, movieDate, venue, posterUrl, groupId, baseUrl } = await req.json();
    const posterSrc = escapeHtml(posterUrl || `${baseUrl}/next.svg`);
    const safeMovieTitle = escapeHtml(movieTitle);
    const safeMovieDate = escapeHtml(movieDate);
    const safeVenue = escapeHtml(venue);
    const safeLeaderName = escapeHtml(leaderName);

    const memberIds = members.map((m: { memberId: string }) => m.memberId);
    const { data: rows } = await supabaseAdmin.from('reservations').select('id, email').in('id', memberIds);
    const emailByMemberId = new Map((rows || []).map((r: any) => [r.id, r.email]));

    const sendPromises = members.map((member: { name: string, seat: string, studentId: string, memberId: string }) => {
      const email = emailByMemberId.get(member.memberId);
      if (!email) return Promise.resolve();

      const confirmUrl = `${baseUrl}/group-confirm?groupId=${groupId}&memberId=${member.memberId}`;
      const safeMemberName = escapeHtml(member.name);
      const safeMemberSeat = escapeHtml(member.seat);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="color-scheme" content="light">
          <style>
            @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
            @import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');
          </style>
        </head>
        <body style="margin:0; padding:0; -webkit-font-smoothing: antialiased; background-color:#0b1120;">
          <div style="position:relative; background-color: #0b1120;">
            <div style="position:absolute; inset:0; overflow:hidden;">
              <img src="${posterSrc}" alt="" style="position:absolute; top:50%; left:50%; width:160%; height:160%; transform: translate(-50%, -50%) scale(1.15); object-fit:cover; filter: blur(50px) saturate(1.3) brightness(0.55);" />
              <div style="position:absolute; inset:0; background: rgba(11,17,32,0.55);"></div>
            </div>

            <div style="position:relative; padding: 40px 12px; font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; text-align: center;">

              <div style="margin-bottom: 26px;">
                <div style="font-family: 'Song Myung', serif; color: #f1f5f9; font-size: 28px; line-height: 1.15; letter-spacing: 0.1em; text-shadow: 0 0 18px rgba(255,255,255,0.25);">
                  영화<br/>대교
                </div>
              </div>

              <div style="position: relative; margin: 0 auto; width: 100%; max-width: 380px; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 45px rgba(0,0,0,0.55); text-align: left;">

                <img src="${posterSrc}" alt="${safeMovieTitle}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position: top; background-color:#0b1120;" />
                <div style="position:absolute; inset:0; background: linear-gradient(180deg, rgba(8,10,18,0.05) 0%, rgba(8,10,18,0.1) 22%, rgba(8,10,18,0.6) 42%, rgba(8,10,18,0.88) 62%, rgba(8,10,18,0.97) 82%, rgba(8,10,18,0.97) 100%);"></div>

                <div style="position:relative; padding: 18px 22px 26px 22px;">
                  <div style="display:inline-block; background-color:rgba(0,0,0,0.4); padding:4px 9px; border-radius:6px; color:#e2e8f0; font-size:11px; font-weight:600; letter-spacing:0.5px;">🎬 단체 관람 초대장</div>

                  <div style="height:170px;"></div>

                  <div style="color:#ffffff; font-size:20px; font-weight:800; line-height:1.4; text-wrap: balance; text-shadow: 0 2px 10px rgba(0,0,0,0.5); margin-bottom: 20px;">${safeMemberName}님, 단체 관람에<br/>초대되었습니다</div>

                  <div style="color:#f1f5f9; font-size:15px; font-weight:700; margin-bottom: 4px;">${safeMovieTitle}</div>
                  <div style="color:#94a3b8; font-size:13px; font-weight:600; margin-bottom: 4px;">${safeMovieDate}</div>
                  ${venue ? `<div style="color:#94a3b8; font-size:13px; font-weight:600;">📍 ${safeVenue}</div>` : ''}
                  <div style="color:#94a3b8; font-size:13px; font-weight:600; margin-top:4px;">리더 ${safeLeaderName}님</div>

                  <div style="margin: 18px 0; padding: 12px 14px; background-color: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.4); border-radius: 10px;">
                    <div style="color:#fbbf24; font-size:13px; font-weight:700; margin-bottom: 4px;">⏰ 1시간 내로 예매를 확정해주세요</div>
                    <div style="color:#e5c07b; font-size:12px; font-weight:600;">미응답 시 좌석이 자동으로 해제됩니다.</div>
                  </div>

                  <div style="font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #64748b; margin-bottom: 4px;">YOUR SEAT</div>
                  <div style="font-size: 44px; font-weight: 800; color: #ef4444; line-height: 1; font-variant-numeric: tabular-nums;">${safeMemberSeat}</div>
                </div>

                <div style="position:relative; height:16px; background: radial-gradient(circle at 8px 8px, #0b1120 8px, transparent 8.5px) 0 0 / 16px 16px repeat-x; background-color: rgba(8,10,18,0.97);"></div>
              </div>

              <div style="margin-top: 30px;">
                <a href="${confirmUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 800;">✅ 예매 확정하러 가기</a>
              </div>

              <p style="color: #475569; font-size: 10px; margin-top: 24px; letter-spacing: 2px;">
                Powered by 영화대교
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      return sendMail({
        to: email,
        subject: `[영화대교] 🎬 ${member.name}님, 단체 관람에 초대되었습니다 - ${member.seat} 좌석`,
        html: htmlContent
      });
    });

    await Promise.all(sendPromises);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Group invite email error:', error);
    return NextResponse.json({ success: false, error: 'Mail Failed' }, { status: 500 });
  }
}
