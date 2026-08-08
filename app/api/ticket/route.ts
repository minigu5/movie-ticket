import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/escapeHtml';

export async function POST(req: Request) {
  try {
    const { email, name, seat, movieTitle, movieDate, venue, ageRating, posterUrl, statusType, popcorn, ticketId, baseUrl, isRefundNeeded } = await req.json();

    // 🌟 [추가됨] 다중 팝콘 분석 및 총액 계산
    const popcornArray = popcorn && popcorn !== 'none' ? popcorn.split(',') :[];
    const totalPrice = popcornArray.length * 2500;
    const formattedPrice = totalPrice.toLocaleString();

    let badgeColor = '#34d399'; let badgeText = '예매 완료';
    let priceText = '0 원 (무료)'; let subject = `[영화대교] ${name}님의 티켓 예매 안내 - ${seat} 좌석`;

    if (statusType === 'pending') {
      badgeColor = '#fbbf24'; badgeText = '결제 대기중'; priceText = `${formattedPrice} 원`;
    } else if (statusType === 'changed') {
      badgeColor = '#60a5fa'; badgeText = '좌석 변경됨';
      subject = `[영화대교] ${name}님의 좌석 변경 안내 - ${seat} 좌석`;
      priceText = popcornArray.length > 0 ? `${formattedPrice} 원` : '0 원 (무료)';
    } else if (statusType === 'canceled') {
      badgeColor = '#f87171'; badgeText = '예매 취소됨';
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

    const posterSrc = escapeHtml(posterUrl || `${baseUrl}/next.svg`);
    const safeBaseUrl = escapeHtml(baseUrl);
    const safeMovieTitle = escapeHtml(movieTitle);
    const safeMovieDate = escapeHtml(movieDate);
    const safeVenue = escapeHtml(venue);
    const safeAgeRating = escapeHtml(ageRating);
    const safeSeat = escapeHtml(seat);
    const safeName = escapeHtml(name);

    const ticketHTML = `
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
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:inline-block; background-color:rgba(0,0,0,0.4); padding:4px 9px; border-radius:6px; color:#e2e8f0; font-size:11px; font-weight:600; letter-spacing:0.5px; font-variant-numeric: tabular-nums;">🎫 판매번호 ${displayId}</div>
                <div style="width:44px; height:44px; flex-shrink:0; background-color:#ffffff; border-radius:10px; box-shadow: 0 6px 14px rgba(0,0,0,0.35); text-align:center; line-height:44px; font-size:22px;">🎬</div>
              </div>

              <div style="height:170px;"></div>

              <div style="color:#ffffff; font-size:23px; font-weight:800; line-height:1.3; text-wrap: balance; text-shadow: 0 2px 10px rgba(0,0,0,0.5); margin-bottom: 6px;">${safeMovieTitle}</div>
              <div style="color:#cbd5e1; font-size:12px; font-weight:600; letter-spacing:0.5px; margin-bottom: 20px;">2D · ${safeAgeRating || '전체관람가'}</div>

              <div style="margin-bottom: 10px;">
                <span style="color:#f1f5f9; font-size:15px; font-weight:700; font-variant-numeric: tabular-nums;">${safeMovieDate}</span>
                <span style="color:#ef4444; font-size:13px; margin-left:6px;">↻</span>
              </div>
              ${venue ? `<div style="color:#94a3b8; font-size:13px; font-weight:600;">📍 ${safeVenue}</div>` : ''}

              <div style="margin: 18px 0; padding: 12px 14px; background-color: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;">
                <div style="color:#e2e8f0; font-size:13px; font-weight:600; margin-bottom: 6px;">${popcornText}</div>
                <div style="color:#94a3b8; font-size:12px; font-weight:600; font-variant-numeric: tabular-nums;">결제 금액 <span style="color:#e2e8f0; font-weight:700;">${priceText}</span></div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div style="display:flex; align-items:baseline; gap:8px;">
                  <span style="font-size: 44px; font-weight: 800; color: #ef4444; text-decoration: ${statusType === 'canceled' ? 'line-through' : 'none'}; line-height: 1; font-variant-numeric: tabular-nums;">${safeSeat}</span>
                  <span style="color:#94a3b8; font-size:13px; font-weight:600;">${safeName} 님</span>
                </div>
                <div style="padding: 7px 12px; background-color: rgba(0,0,0,0.5); backdrop-filter: blur(4px); border-radius: 8px; font-weight: 700; font-size: 12px; color: ${badgeColor}; border: 1px solid ${badgeColor};">
                  ${badgeText}
                </div>
              </div>
            </div>

            <div style="position:relative; height:16px; background: radial-gradient(circle at 8px 8px, #0b1120 8px, transparent 8.5px) 0 0 / 16px 16px repeat-x; background-color: rgba(8,10,18,0.97);"></div>
          </div>

          ${statusType === 'pending' ? `
            <p style="margin-top: 25px; color: #fbbf24; font-weight: bold; font-size: 14px;">⚠️ 30분 내로 아래 QR코드로 입금해주세요. (총액: ${formattedPrice}원)</p>
            <div style="margin-top: 15px; text-align: center;">
              <img src="${safeBaseUrl}/qr.jpeg" alt="송금 QR" width="150" height="150" style="border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);" />
            </div>
            <div style="margin: 15px auto 0 auto; max-width: 320px; background-color: #161b26; border: 1px solid #26303f; border-radius: 10px; padding: 12px 14px; text-align: left;">
              <div style="font-size: 10px; letter-spacing: 2px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">계좌번호</div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <span style="font-family: monospace; font-size: 13px; color: #f1f5f9; font-weight: bold;">7777028184681 카카오뱅크 신민규</span>
                <span style="flex-shrink: 0; font-size: 10px; color: #94a3b8; border: 1px solid #334155; padding: 4px 8px; border-radius: 6px; background-color: #0b1120;">길게 눌러 복사</span>
              </div>
            </div>
          ` : statusType === 'changed' ? `
            <p style="margin-top: 25px; color: #60a5fa; font-weight: bold; font-size: 14px;">🔄 좌석 변경이 완료되었습니다.</p>
          ` : statusType === 'canceled' ? `
            <p style="margin-top: 25px; color: #f87171; font-weight: bold; font-size: 14px;">❌ 예매가 취소되었습니다.</p>
          ` : `
            <p style="margin-top: 25px; color: #34d399; font-weight: bold; font-size: 14px;">✅ 예매가 확정되었습니다. 상영 당일 보여주세요!</p>
          `}

          ${statusType !== 'canceled' ? `
            <div style="margin-top: 30px; border-top: 1px dashed #26303f; padding-top: 18px; text-align: center;">
              <p style="font-size: 13px; color: #94a3b8; margin-bottom: 12px;">예매 내역 확인이나 변경은 아래에서 하실 수 있어요.</p>
              <a href="${safeBaseUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 700;">🎬 웹사이트에서 확인하기</a>
            </div>
          ` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    await sendMail({ to: email, subject, html: ticketHTML });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Mail Failed' }, { status: 500 });
  }
}