// app/api/ticket/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, name, seat, movieTitle, movieDate, statusType, popcorn, ticketId, baseUrl } = await req.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // 🌟 상태별 디자인(색상/텍스트) 변수 설정
    let badgeBg = '#D1FAE5'; 
    let badgeColor = '#065F46'; 
    let badgeText = '예매 완료';
    let priceText = '0 원 (무료)';
    let subject = `[영화대교] ${name}님의 티켓 예매 안내 - ${seat} 좌석`;

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

    // 🌟 세부 팝콘 이름 매칭
    const popcornNames: Record<string, string> = {
      original: '오리지널 버터 팝콘',
      consomme: '콘소메맛 팝콘',
      caramel: '카라멜맛 팝콘',
      none: '음료/팝콘 없음'
    };
    const popcornText = popcorn !== 'none' ? `🍿 ${popcornNames[popcorn]}` : popcornNames['none'];
    
    // 🌟 고유 번호 추출 (DB ID의 앞 8자리)
    const displayId = ticketId ? ticketId.split('-')[0].toUpperCase() : 'UNKNOWN';

    const ticketHTML = `
      <div style="background-color: #fceea7; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center;">
        <h2 style="color: #333; margin-bottom: 30px;">🎬 영화대교 예매 내역 안내</h2>
        
        <table cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 100%; max-width: 600px; background-color: #2C3338; border-radius: 12px; overflow: hidden; box-shadow: 0 15px 25px rgba(0,0,0,0.2);">
          <tr>
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
                  <td style="padding-bottom: 5px; font-size: 18px; color: #fff;">${statusType === 'canceled' ? '<s>'+seat+'</s>' : seat} <span style="font-size:12px; color:#aaa; font-weight:normal;">(${name})</span></td>
                </tr>
                <tr>
                  <td style="color: #E85D04; padding-bottom: 5px;">OPTION</td>
                  <td style="padding-bottom: 5px;">${popcornText}</td>
                </tr>
              </table>
              
              <!-- 🌟 PRICE 우측 정렬을 위한 테이블 구조 -->
              <table style="width: 100%; border-top: 1px solid #555; padding-top: 15px; font-size: 12px;">
                <tr>
                  <td style="color: #aaa; text-align: left;"># ${displayId}</td>
                  <td style="color: white; font-weight: bold; font-size: 14px; text-align: right;">PRICE: ${priceText}</td>
                </tr>
              </table>
            </td>
            
            <td style="background-color: #F3EFE6; padding: 20px; text-align: center; color: #2C3338; width: 35%; vertical-align: middle;">
              <div style="font-size: 10px; color: #888; text-align: right; margin-bottom: 20px;"># ${displayId}</div>
              
              <div style="font-size: 42px; font-weight: 900; color: #E85D04; margin-bottom: 5px; text-decoration: ${statusType === 'canceled' ? 'line-through' : 'none'};">${seat}</div>
              <div style="font-size: 14px; font-weight: bold; letter-spacing: 2px;">SEAT</div>
              
              <!-- 🌟 상태에 따른 뱃지 색상 및 글자 변경 -->
              <div style="margin: 20px 0; padding: 10px; background-color: ${badgeBg}; border-radius: 6px; font-weight: bold; font-size: 13px; color: ${badgeColor}; border: 1px solid ${badgeColor};">
                ${badgeText}
              </div>
              
              <div style="font-family: monospace; font-size: 24px; font-weight: normal; letter-spacing: -2px; margin-top: 20px;">
                ||| || ||| | |||
              </div>
            </td>
          </tr>
        </table>

        <!-- 🌟 상태별 맞춤형 하단 메시지 및 QR 코드 중앙 배치 -->
        ${statusType === 'pending' ? `
          <p style="margin-top: 30px; color: #d97706; font-weight: bold; font-size: 15px;">
            ⚠️ 30분 내로 아래 QR코드로 입금하지 않으시면 자동으로 예매가 취소됩니다.
          </p>
          <div style="margin-top: 20px; text-align: center;">
            <img src="${baseUrl}/qr.jpeg" alt="토스 송금 QR코드" width="160" height="160" style="border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); display: inline-block;" />
          </div>
        ` : statusType === 'changed' ? `
          <p style="margin-top: 30px; color: #1d4ed8; font-weight: bold; font-size: 15px;">
            🔄 좌석 변경이 완료되었습니다. 상영 당일 이 티켓을 보여주세요!
          </p>
        ` : statusType === 'canceled' ? `
          <p style="margin-top: 30px; color: #b91c1c; font-weight: bold; font-size: 15px;">
            ❌ 귀하의 예매가 취소되었습니다.
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
      subject,
      html: ticketHTML,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('메일 전송 실패:', error);
    return NextResponse.json({ success: false, error: 'Mail Failed' }, { status: 500 });
  }
}