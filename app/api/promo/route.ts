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
          <meta name="color-scheme" content="light dark">
          <meta name="supported-color-schemes" content="light dark">
        </head>
        <body style="margin: 0; padding: 0; background-color: #111827;">
          <div style="background-color: #111827; padding: 30px 15px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center;">
            
            <div style="margin-bottom: 25px; padding: 20px 0; background: radial-gradient(circle, #422006 0%, #111827 60%); text-align: center;">
              <style>@import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');</style>
              <div style="font-family: 'Song Myung', 'Batang', 'Myungjo', serif; color: #f9fafb; font-size: 38px; line-height: 1.1; letter-spacing: 4px; text-shadow: 0 0 8px #eab308, 0 0 15px #ca8a04; font-weight: normal;">
                <div style="margin-bottom: 5px;">영화</div>
                <div>대교</div>
              </div>
              <p style="color: #60a5fa; font-size: 13px; font-weight: bold; letter-spacing: 2px; margin: 15px 0 0 0;">
                이달의 상영작 오픈
              </p>
            </div>
            
            <div style="width: 100%; max-width: 400px; margin: 0 auto; background-color: #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 15px 30px rgba(0,0,0,0.5); text-align: left; border: 1px solid #374151;">
              
              <img src="${movieInfo.poster_url}" alt="영화 포스터" style="width: 100%; max-width: 100%; height: auto; display: block; border-bottom: 3px solid #3b82f6; margin: 0; padding: 0;" />
              
              <div style="padding: 25px 20px;">
                <h1 style="color: white; font-size: 22px; margin: 0 0 10px 0; line-height: 1.3;">${movieInfo.title}</h1>
                <p style="color: #9ca3af; font-size: 14px; margin: 0 0 20px 0;">📍 ${movieInfo.venue}<br/>⏰ ${movieInfo.date_string}</p>
                
                <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
                  <p style="color: #fca5a5; font-size: 13px; margin: 0;">🚨 <strong>예매 마감:</strong> ${formattedDeadline}까지</p>
                </div>

                <p style="color: #e5e7eb; font-size: 15px; line-height: 1.6; margin-bottom: 30px; word-break: keep-all;">
                  안녕하세요, <strong>${user.name}</strong>님!<br/>
                  이번 달에도 어김없이 명작 영화와 함께 돌아왔습니다. 즐거운 관람을 원하신다면 지금 바로 예매해 주세요!
                </p>

                <a href="${baseUrl}" style="display: block; background-color: #3b82f6; color: white; text-align: center; text-decoration: none; padding: 16px; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 10px rgba(59,130,246,0.3);">🎟️ 영화 예매하러 가기</a>
              </div>
            </div>
            
            <p style="color: #4b5563; font-size: 10px; margin-top: 30px; letter-spacing: 1px;">
              CRAFTED BY SHIN MINGYU | POWERED BY GOOGLE AI STUDIO
            </p>
          </div>
        </body>
        </html>
      `;

      return transporter.sendMail({
        from: `"영화대교" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `[영화대교] 🎬 '${movieInfo.title}' 예매가 오픈되었습니다!`,
        html: htmlContent
      });
    }));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}