// app/api/ticket/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, name, seat, movieTitle, movieDate, isPending, popcorn } = await req.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    
    const statusText = isPending ? '결제 대기중' : '예매 완료 (CONFIRMED)';
    const priceText = isPending ? '2,500 원' : '0 원 (무료)';
    const popcornText = popcorn !== 'none' ? '🍿 팝콘 포함' : '음료/팝콘 없음';

    // 첨부하신 이미지의 디자인을 HTML 코드로 구현한 "웹 티켓"
    const ticketHTML = `
      <div style="background-color: #fceea7; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center;">
        <h2 style="color: #333; margin-bottom: 30px;">🎬 영화대교 예매 내역 안내</h2>
        
        <!-- 티켓 본체 -->
        <table cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 100%; max-width: 600px; background-color: #2C3338; border-radius: 12px; overflow: hidden; box-shadow: 0 15px 25px rgba(0,0,0,0.2);">
          <tr>
            <!-- 왼쪽 다크 그레이 영역 -->
            <td style="padding: 30px; color: white; text-align: left; border-right: 3px dashed #fceea7; width: 65%;">
              <h1 style="margin: 0 0 5px 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">${movieTitle}</h1>
              <p style="margin: 0 0 20px 0; color: #E85D04; font-weight: bold; font-size: 14px;">🎬 CINEMA HALL - 중강당</p>
              
              <table style="width: 100%; color: white; font-size: 12px; font-weight: bold; margin-bottom: 20px;">
                <tr>
                  <td style="color: #E85D04; padding-bottom: 5px;">DATE</td>
                  <td style="padding-bottom: 5px;">${movieDate}</td>
                </tr>
                <tr>
                  <td style="color: #E85D04; padding-bottom: 5px;">SEAT</td>
                  <td style="padding-bottom: 5px; font-size: 18px; color: #fff;">${seat} <span style="font-size:12px; color:#aaa; font-weight:normal;">(${name})</span></td>
                </tr>
                <tr>
                  <td style="color: #E85D04; padding-bottom: 5px;">OPTION</td>
                  <td style="padding-bottom: 5px;">${popcornText}</td>
                </tr>
              </table>
              
              <div style="border-top: 1px solid #555; padding-top: 15px; display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: #aaa;"># ${new Date().getTime().toString().slice(0, 8)}</span>
                <span style="color: white; font-weight: bold; font-size: 14px;">PRICE: ${priceText}</span>
              </div>
            </td>
            
            <!-- 오른쪽 크림색 절취선 영역 -->
            <td style="background-color: #F3EFE6; padding: 20px; text-align: center; color: #2C3338; width: 35%; vertical-align: middle;">
              <div style="font-size: 10px; color: #888; text-align: right; margin-bottom: 20px;"># ${new Date().getTime().toString().slice(0, 8)}</div>
              
              <div style="font-size: 42px; font-weight: 900; color: #E85D04; margin-bottom: 5px;">${seat}</div>
              <div style="font-size: 14px; font-weight: bold; letter-spacing: 2px;">SEAT</div>
              
              <div style="margin: 20px 0; padding: 10px; background-color: ${isPending ? '#FDE68A' : '#D1FAE5'}; border-radius: 6px; font-weight: bold; font-size: 13px; color: ${isPending ? '#B45309' : '#065F46'};">
                ${statusText}
              </div>
              
              <!-- 바코드 모양 -->
              <div style="font-family: monospace; font-size: 24px; font-weight: normal; letter-spacing: -2px; margin-top: 20px;">
                ||| || ||| | |||
              </div>
            </td>
          </tr>
        </table>

        ${isPending ? `
          <p style="margin-top: 30px; color: #d97706; font-weight: bold; font-size: 15px;">
            ⚠️ 30분 내로 지정된 계좌(QR코드)로 입금하지 않으시면 자동으로 예매가 취소됩니다.
          </p>
        ` : `
          <p style="margin-top: 30px; color: #059669; font-weight: bold; font-size: 15px;">
            ✅ 예매가 확정되었습니다. 상영 당일 이 티켓을 보여주세요!
          </p>
        `}
      </div>
    `;

    await transporter.sendMail({
      from: `"영화대교 예매시스템" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `[영화대교] ${name}님의 티켓 예매 안내 - ${seat} 좌석`,
      html: ticketHTML,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('메일 전송 실패:', error);
    return NextResponse.json({ success: false, error: 'Mail Failed' }, { status: 500 });
  }
}