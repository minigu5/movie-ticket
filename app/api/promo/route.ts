import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { chunk, movieInfo, baseUrl } = await req.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    await Promise.all(chunk.map(async (user: any) => {
      
      const utcDate = new Date(movieInfo.deadline_date);
      const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
      
      const formattedMonth = kstDate.getUTCMonth() + 1;
      const formattedDay = kstDate.getUTCDate();
      const formattedHour = kstDate.getUTCHours();
      const formattedMinute = String(kstDate.getUTCMinutes()).padStart(2, '0');

      const formattedDeadline = `${formattedMonth}월 ${formattedDay}일 ${formattedHour}시 ${formattedMinute}분`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="dark">
          <meta name="supported-color-schemes" content="dark">
          <style>
            :root {
              color-scheme: dark;
              supported-color-schemes: dark;
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #020617; -webkit-font-smoothing: antialiased;">
          <div style="background-color: #020617; padding: 40px 15px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center;">
            
            <div style="margin-bottom: 30px; text-align: center;">
              <style>@import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');</style>
              <div style="font-family: 'Song Myung', serif; color: #f8fafc; font-size: 42px; line-height: 1.2; letter-spacing: 5px; text-shadow: 0 0 20px rgba(245,158,11,0.5); font-weight: normal;">
                영화대교
              </div>
              <p style="color: #d97706; font-size: 12px; font-weight: bold; letter-spacing: 4px; margin: 10px 0 0 0; text-transform: uppercase;">
                Special Invitation
              </p>
            </div>
            
            <div style="width: 100%; max-width: 420px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); text-align: left; border: 1px solid #1e293b;">
              
              <div style="padding: 30px 25px;">
                <p style="color: #f59e0b; font-size: 14px; font-weight: bold; margin: 0 0 15px 0;">특별 초청장</p>
                <h1 style="color: #f8fafc; font-size: 26px; margin: 0 0 20px 0; line-height: 1.4; word-break: keep-all;">${user.name}님을 이달의 명작 상영회에 초대합니다.</h1>
                
                <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 30px 0; word-break: keep-all;">
                  귀하를 모시게 되어 영광입니다.<br/>
                  최고의 좌석과 감동적인 영화가 준비되어 있습니다.<br/>
                  함께하셔서 특별한 추억을 만들어보시길 바랍니다.
                </p>

                <div style="background-color: #020617; border-left: 3px solid #d97706; padding: 15px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
                  <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 8px 0;"><strong>🎬 영화:</strong> ${movieInfo.title}</p>
                  <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 8px 0;"><strong>📍 장소:</strong> ${movieInfo.venue}</p>
                  <p style="color: #cbd5e1; font-size: 14px; margin: 0;"><strong>⏰ 일시:</strong> ${movieInfo.date_string}</p>
                </div>

                <a href="${baseUrl}?invite=true&id=${user.studentId}&name=${encodeURIComponent(user.name)}" style="display: block; background-color: #d97706; color: #020617; text-align: center; text-decoration: none; padding: 18px; border-radius: 12px; font-weight: 900; font-size: 16px; box-shadow: 0 0 20px rgba(217,119,6,0.4); letter-spacing: 1px;">🎫 초청 수락 및 좌석 예매하기</a>
                
                <p style="color: #ef4444; font-size: 12px; text-align: center; margin-top: 15px;">※ 예매 기한: ${formattedDeadline}까지</p>
              </div>
            </div>
            
            <p style="color: #334155; font-size: 10px; margin-top: 40px; letter-spacing: 2px;">
              Powered by Google AI Studio
            </p>
          </div>
        </body>
        </html>
      `;

      return transporter.sendMail({
        from: `"영화대교" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `[영화대교] 💌 ${user.name}님을 위한 특별 초청장이 도착했습니다.`,
        html: htmlContent
      });
    }));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}