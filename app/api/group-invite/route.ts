import { NextResponse } from 'next/server';
import { getTransporter } from '@/lib/mailer';

export async function POST(req: Request) {
  try {
    const { members, leaderName, movieTitle, movieDate, groupId, baseUrl } = await req.json();

    const { transporter, user: senderUser } = getTransporter();

    const sendPromises = members.map((member: { email: string, name: string, seat: string, studentId: string, memberId: string }) => {
      if (!member.email) return Promise.resolve();

      const confirmUrl = `${baseUrl}/group-confirm?groupId=${groupId}&memberId=${member.memberId}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="color-scheme" content="light">
        </head>
        <body style="margin:0; padding:0;">
          <div style="background-color: #0f172a; padding: 40px 10px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center;">
            <div style="max-width: 420px; margin: 0 auto; background-color: #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border: 1px solid #334155;">
              
              <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 25px 20px; text-align: center;">
                <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 0 0 8px 0; letter-spacing: 2px; font-weight: bold;">🎬 단체 관람 초대장</p>
                <h1 style="color: white; font-size: 22px; margin: 0; line-height: 1.4;">${member.name}님,<br/>단체 관람에 초대되었습니다</h1>
              </div>

              <div style="padding: 30px 25px;">
                <div style="background-color: #0f172a; border-left: 3px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
                  <p style="color: #94a3b8; font-size: 13px; margin: 0 0 5px 0;"><strong style="color: #10b981;">리더:</strong> ${leaderName}</p>
                  <p style="color: #94a3b8; font-size: 13px; margin: 0 0 5px 0;"><strong style="color: #10b981;">🎬 영화:</strong> ${movieTitle}</p>
                  <p style="color: #94a3b8; font-size: 13px; margin: 0;"><strong style="color: #10b981;">⏰ 일시:</strong> ${movieDate}</p>
                </div>

                <div style="background-color: #0f172a; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                  <p style="color: #64748b; font-size: 12px; font-weight: bold; letter-spacing: 2px; margin: 0 0 5px 0;">YOUR SEAT</p>
                  <p style="color: #10b981; font-size: 42px; font-weight: 900; margin: 0; line-height: 1;">${member.seat}</p>
                </div>

                <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 25px;">
                  <p style="color: #92400e; font-size: 13px; font-weight: bold; margin: 0;">⏰ 1시간 내로 예매를 확정해야 단체 관람에 포함됩니다.</p>
                  <p style="color: #a16207; font-size: 11px; margin: 5px 0 0 0;">미응답 시 좌석이 자동으로 해제됩니다.</p>
                </div>

                <a href="${confirmUrl}" style="display: block; background-color: #10b981; color: white; text-align: center; text-decoration: none; padding: 18px; border-radius: 12px; font-weight: 900; font-size: 16px; box-shadow: 0 0 20px rgba(16,185,129,0.4); letter-spacing: 1px;">✅ 예매 확정하러 가기</a>
              </div>
            </div>

            <p style="color: #475569; font-size: 10px; margin-top: 20px; letter-spacing: 2px;">
              Powered by 영화대교
            </p>
          </div>
        </body>
        </html>
      `;

      return transporter.sendMail({
        from: `"영화대교 예매시스템" <${senderUser}>`,
        to: member.email,
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
