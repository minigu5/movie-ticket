import { NextResponse } from 'next/server';
import { getTransporter } from '@/lib/mailer';

export async function POST(req: Request) {
  try {
    const { email, name, seat, movieTitle, movieDate, statusType, popcorn, ticketId, baseUrl, isRefundNeeded } = await req.json();

    const { transporter, user } = getTransporter();

    // 🌟 [추가됨] 다중 팝콘 분석 및 총액 계산
    const popcornArray = popcorn && popcorn !== 'none' ? popcorn.split(',') :[];
    const totalPrice = popcornArray.length * 2500;
    const formattedPrice = totalPrice.toLocaleString();

    let badgeBg = '#D1FAE5'; let badgeColor = '#065F46'; let badgeText = '예매 완료';
    let priceText = '0 원 (무료)'; let subject = `[영화대교] ${name}님의 티켓 예매 안내 - ${seat} 좌석`;

    if (statusType === 'pending') {
      badgeBg = '#FDE68A'; badgeColor = '#B45309'; badgeText = '결제 대기중'; priceText = `${formattedPrice} 원`;
    } else if (statusType === 'changed') {
      badgeBg = '#DBEAFE'; badgeColor = '#1E40AF'; badgeText = '좌석 변경됨';
      subject = `[영화대교] ${name}님의 좌석 변경 안내 - ${seat} 좌석`;
      priceText = popcornArray.length > 0 ? `${formattedPrice} 원` : '0 원 (무료)';
    } else if (statusType === 'canceled') {
      badgeBg = '#FEE2E2'; badgeColor = '#991B1B'; badgeText = '예매 취소됨';
      subject = `[영화대교] ${name}님의 예매 취소 안내`;
      if (popcornArray.length > 0) {
        priceText = isRefundNeeded ? `${formattedPrice} 원 (환불 요망)` : `${formattedPrice} 원 (미결제 취소)`;
      } else {
        priceText = '0 원 (무료)';
      }
    } else {
      if(popcornArray.length > 0) priceText = `${formattedPrice} 원 (결제완료)`;
    }

    // 🌟 [추가됨] 팝콘 종류별 개수 요약 생성 (예: 오리지널 버터 2개, 카라멜맛 1개)
    const popcornNames: Record<string, string> = { original: '오리지널 버터 팝콘', consomme: '콘소메맛 팝콘', caramel: '카라멜맛 팝콘' };
    let popcornText = '음료/팝콘 없음';
    
    if (popcornArray.length > 0) {
      const counts: Record<string, number> = {};
      popcornArray.forEach((p: string) => { counts[p] = (counts[p] || 0) + 1; });
      popcornText = Object.entries(counts).map(([key, count]) => `🍿 ${popcornNames[key]} ${count}개`).join('<br/>');
    }

    const displayId = ticketId ? ticketId.split('-')[0].toUpperCase() : 'UNKNOWN';

    const ticketHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="color-scheme" content="light">
      </head>
      <body style="margin:0; padding:0;">
        <div style="background-color: #fceea7; padding: 40px 10px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px; font-size: 20px;">🎬 영화대교 예매 내역 안내</h2>
          
          <div style="margin: 0 auto; width: 100%; max-width: 380px; background-color: #2C3338; border-radius: 16px; overflow: hidden; box-shadow: 0 15px 25px rgba(0,0,0,0.2); text-align: left;">
            <div style="padding: 30px 25px; color: white; border-bottom: 3px dashed #fceea7;">
              <p style="margin: 0 0 5px 0; color: #E85D04; font-weight: bold; font-size: 12px; letter-spacing: 1px;">🎬 CINEMA HALL</p>
              <h1 style="margin: 0 0 25px 0; font-size: 22px; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.3;">${movieTitle}</h1>
              
              <div style="margin-bottom: 15px;">
                <div style="color: #E85D04; font-size: 11px; font-weight: bold; margin-bottom: 4px;">DATE</div>
                <div style="color: white; font-size: 14px; font-weight: 500;">${movieDate}</div>
              </div>
              <div style="margin-bottom: 15px;">
                <div style="color: #E85D04; font-size: 11px; font-weight: bold; margin-bottom: 4px;">OPTION</div>
                <div style="color: white; font-size: 14px; font-weight: 500; line-height: 1.5;">${popcornText}</div>
              </div>

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
            <p style="margin-top: 25px; color: #d97706; font-weight: bold; font-size: 14px;">⚠️ 30분 내로 아래 QR코드로 입금해주세요. (총액: ${formattedPrice}원)</p>
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

          ${statusType !== 'canceled' ? `
            <div style="margin-top: 35px; border-top: 1px dashed #ccc; padding-top: 20px; text-align: center;">
              <p style="font-size: 13px; color: #555; margin-bottom: 12px;">본인이 예매하지 않으셨거나, 예매를 취소하고 싶으신가요?</p>
              <a href="${baseUrl}/cancel?ticketId=${ticketId}" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: bold;">🚨 비밀번호 변경 및 예매 취소</a>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({ from: `"영화대교 예매시스템" <${user}>`, to: email, subject, html: ticketHTML });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Mail Failed' }, { status: 500 });
  }
}