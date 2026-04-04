import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { chunk, movieInfo, baseUrl } = await req.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    // Vercel 타임아웃 방지를 위해 전달받은 묶음(chunk)만 병렬로 발송
    await Promise.all(chunk.map(async (user: any) => {
      
      // 날짜 포맷 예쁘게 변경
      const deadline = new Date(movieInfo.deadline_date);
      const formattedDeadline = `${deadline.getMonth() + 1}월 ${deadline.getDate()}일 ${deadline.getHours()}시 ${deadline.getMinutes()}분`;

      const htmlContent = `
        <div style="background-color: #111827; padding: 40px 10px; font-family: 'Helvetica Neue', Helvetica, sans-serif; text-align: center;">
          
          <!-- 🌟 이메일 전용 영화대교 로고 구역 -->
          <div style="margin-bottom: 25px;">
            <!-- 웹 폰트 로드 시도 (지원되는 메일 클라이언트용) -->
            <style>@import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');</style>
            
            <!-- 송명 폰트 및 은은한 노란색 텍스트 그림자(Glow) 적용 -->
            <div style="font-family: 'Song Myung', 'Batang', 'Myungjo', serif; color: #f9fafb; font-size: 38px; line-height: 1.1; letter-spacing: 4px; text-shadow: 0px 0px 20px rgba(234, 179, 8, 0.6); font-weight: normal;">
              <div style="margin-bottom: 5px;">영화</div>
              <div>대교</div>
            </div>
            
            <!-- 작게 들어가는 안내 문구 -->
            <p style="color: #60a5fa; font-size: 13px; font-weight: bold; letter-spacing: 2px; margin: 15px 0 0 0;">
              이달의 상영작 오픈
            </p>
          </div>
          
          <div style="max-width: 400px; margin: 0 auto; background-color: #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 15px 30px rgba(0,0,0,0.5); text-align: left; border: 1px solid #374151;">
            
            <img src="${movieInfo.poster_url}" alt="영화 포스터" style="width: 100%; height: auto; display: block; border-bottom: 3px solid #3b82f6;" />
            
            <div style="padding: 30px;">
              <h1 style="color: white; font-size: 24px; margin: 0 0 10px 0; line-height: 1.3;">${movieInfo.title}</h1>
              <p style="color: #9ca3af; font-size: 14px; margin: 0 0 20px 0;">📍 ${movieInfo.venue}<br/>⏰ ${movieInfo.date_string}</p>
              
              <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
                <p style="color: #fca5a5; font-size: 13px; margin: 0;">🚨 <strong>예매 마감:</strong> ${formattedDeadline}까지</p>
              </div>

              <p style="color: #e5e7eb; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
                안녕하세요, <strong>${user.name}</strong>님!<br/>
                이번 달에도 어김없이 명작 영화와 함께 돌아왔습니다. 🍿 팝콘과 함께 즐거운 관람을 원하신다면 지금 바로 예매해주세요!
              </p>

              <a href="${baseUrl}" style="display: block; background-color: #3b82f6; color: white; text-align: center; text-decoration: none; padding: 16px; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 10px rgba(59,130,246,0.3);">🎟️ 영화 예매하러 가기</a>
            </div>
          </div>
          
          <p style="color: #4b5563; font-size: 11px; margin-top: 30px; letter-spacing: 1px;">
            CRAFTED BY SHIN MINGYU | POWERED BY GOOGLE AI STUDIO
          </p>
        </div>
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