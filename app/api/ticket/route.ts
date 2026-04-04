// app/api/ticket/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, name, seat, movieTitle, movieDate, statusType, popcorn, ticketId, baseUrl } = await req.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    let badgeBg = '#D1FAE5'; let badgeColor = '#065F46'; let badgeText = '예매 완료';
    let priceText = '0 원 (무료)'; let subject = `[영화대교] ${name}님의 티켓 예매 안내 - ${seat} 좌석`;

    if (statusType === 'pending') {
      badgeBg = '#FDE68A'; badgeColor = '#B45309'; badgeText = '결제 대기중'; priceText = '2,500 원';
    } else if (statusType === 'changed') {
      badgeBg = '#DBEAFE'; badgeColor = '#1E40AF'; badgeText = '좌석 변경됨';
      subject = `[영화대교] ${name}님의 좌석 변경 안내 - ${seat} 좌석`;
      priceText = popcorn !== 'none' ? '2,500 원' : '0 원 (무료)';
    } else if (statusType === 'canceled') {
      badgeBg = '#FEE2E2'; badgeColor = '#991B1B'; badgeText = '예매 취소됨';
      subject = `[영화대교] ${name}님의 예매 취소 안내`;
      priceText = popcorn !== 'none' ? '2,500 원 (환불 요망)' : '0 원 (무료)';
    } else {
      if(popcorn !== 'none') priceText = '2,500 원 (결제완료)';
    }

    const popcornNames: Record<string, string> = { original: '오리지널 버터 팝콘', consomme: '콘소메맛 팝콘', caramel: '카라멜맛 팝콘', none: '음료/팝콘 없음' };
    const popcornText = popcorn !== 'none' ? `🍿 ${popcornNames[popcorn]}` : popcornNames['none'];
    const displayId = ticketId ? ticketId.split('-')[0].toUpperCase() : 'UNKNOWN';

    // 🌟 모바일에서 절대 안 깨지는 세로형(수직) 카드 레이아웃으로 변경!
    const ticketHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">
        <style> :root { color-scheme: light; } </style>
      </head>
      <body style="margin:0; padding:0;">
        <div style="background-color: #fceea7; padding: 40px 10px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px; font-size: 20px;">🎬 영화대교 예매 내역 안내</h2>
          
          <div style="margin: 0 auto; width: 100%; max-width: 380px; background-color: #2C3338; border-radius: 16px; overflow: hidden; box-shadow: 0 15px 25px rgba(0,0,0,0.2); text-align: left;">
            <div style="padding: 30px 25px; color: white; border-bottom: 3px dashed #fceea7;">
              <p style="margin: 0 0 5px 0; color: #E85D04; font-weight: bold; font-size: 12px; letter-spacing: 1px;">🎬 CINEMA HALL - 중강당</p>
              <h1 style="margin: 0 0 25px 0; font-size: 22px; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.3;">${movieTitle}</h1>
              
              <div style="margin-bottom: 15px;">
                <div style="color: #E85D04; font-size: 11px; font-weight: bold; margin-bottom: 4px;">DATE</div>
                <div style="color: white; font-size: 14px; font-weight: 500;">${movieDate}</div>
              </div>
              <div style="margin-bottom: 15px;">
                <div style="color: #E85D04; font-size: 11px; font-weight: bold; margin-bottom: 4px;">OPTION</div>
                <div style="color: white; font-size: 14px; font-weight: 500;">${popcornText}</div>
              </div>

              <!-- 🌟 데스크톱 정렬 깨짐 해결: Flex 대신 고전적인 Table 구조 사용 -->
              <table cellpadding="0" cellspacing="0" style="width: 100%; border-top: 1px solid #555; margin-top: 25px; padding-top: 15px;">
                <tr>
                  <td style="color: #aaa; font-size: 12px; text-align: left; vertical-align: bottom;"># ${displayId}</td>
                  <td style="color: white; font-weight: bold; font-size: 15px; text-align: right; vertical-align: bottom;">PRICE: ${priceText}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #F3EFE6; padding: 25px; text-align: center; color: #2C3338;">
              <div style="font-size: 13px; font-weight: bold; letter-spacing: 2px; color: #666; margin-bottom: 5px;">SEAT</div>
              <div style="font-size: 48px; font-weight: 900; color: #E85D04; margin-bottom: 5px; text-decoration: ${statusType === 'canceled' ? 'line-through' : 'none'}; line-height: 1;">${seat}</div>
              <div style="font-size: 14px; color: #555; font-weight: 500; margin-bottom: 20px;">${name} 님</div>
              
              <div style="margin: 0 auto 20px auto; padding: 10px; background-color: ${badgeBg}; border-radius: 8px; font-weight: bold; font-size: 14px; color: ${badgeColor}; border: 1px solid ${badgeColor}; max-width: 200px;">
                ${badgeText}
              </div>
              <div style="font-family: monospace; font-size: 28px; font-weight: normal; letter-spacing: -1px; color: #333;">
                |||| || |||| | ||||
              </div>
            </div>
          </div>

          ${statusType === 'pending' ? `
            <p style="margin-top: 25px; color: #d97706; font-weight: bold; font-size: 14px;">⚠️ 30분 내로 아래 QR코드로 입금해주세요.</p>
            <div style="margin-top: 15px; text-align: center;">
              <img src="${baseUrl}/qr.jpeg" alt="송금 QR" width="150" height="150" style="border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);" />
            </div>
          ` : statusType === 'changed' ? `
            <p style="margin-top: 25px; color: #1d4ed8; font-weight: bold; font-size: 14px;">🔄 좌석 변경이 완료되었습니다.</p>
          ` : statusType === 'canceled' ? `
            <p style="margin-top: 25px; color: #b91c1c; font-weight: bold; font-size: 14px;">❌ 예매가 취소되었습니다.</p>
          ` : `
            <p style="margin-top: 25px; color: #059669; font-weight: bold; font-size: 14px;">✅ 예매가 확정되었습니다. 상영 당일 보여주세요!</p>
          `}
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({ from: `"영화대교 예매시스템" <${process.env.GMAIL_USER}>`, to: email, subject, html: ticketHTML });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Mail Failed' }, { status: 500 });
  }
}