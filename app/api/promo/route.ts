import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/escapeHtml';
import { fetchSafeImage } from '@/lib/safeImageFetch';

type Recipient = { email: string; name?: string | null };

type MovieInfo = {
  title?: string;
  venue?: string;
  date_string?: string;
  age_rating?: string;
  poster_url?: string;
  deadline_date?: string | null;
};

// 발신 주체 정보 (정보통신망법 광고성 정보 표시 의무).
const SENDER_ORG = '대구과학고등학교 자율동아리 영화대교';

function formatDeadlineKst(deadline: string): string | null {
  const utc = new Date(deadline);
  if (Number.isNaN(utc.getTime())) return null;
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hour = kst.getUTCHours();
  const minute = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${month}월 ${day}일 ${hour}시 ${minute}분`;
}

// 예매 완료(app/api/ticket) 메일과 동일한 디자인 언어:
//   body #0b1120 / 카드 #161b26 / 강조 #ef4444 / 흐린 텍스트 #94a3b8 / 경계 #26303f
function buildHtml(params: {
  name?: string | null;
  movieInfo: MovieInfo;
  baseUrl: string;
  hasPoster: boolean;
}): string {
  const { name, movieInfo, baseUrl, hasPoster } = params;
  const safeName = name ? escapeHtml(name) : null;
  const safeTitle = escapeHtml(movieInfo.title ?? '');
  const safeVenue = escapeHtml(movieInfo.venue ?? '');
  const safeDate = escapeHtml(movieInfo.date_string ?? '');
  const safeAgeRating = escapeHtml(movieInfo.age_rating ?? '전체관람가');
  const safeBaseUrl = escapeHtml(baseUrl || '');
  const deadlineText = movieInfo.deadline_date ? formatDeadlineKst(movieInfo.deadline_date) : null;

  const heading = safeName
    ? `${safeName}님, 이번 달 상영작에<br/>초대합니다`
    : `이번 달 상영작에<br/>초대합니다`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark">
      <style>
        :root { color-scheme: dark; supported-color-schemes: dark; }
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
      </style>
    </head>
    <body style="margin:0; padding:0; -webkit-font-smoothing: antialiased; background-color:#0b1120;">
      <div style="padding: 40px 12px; font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; text-align: center;">

        <div style="margin-bottom: 22px;">
          <div style="color:#64748b; font-size:12px; font-weight:600; letter-spacing:0.32em;">영화대교</div>
        </div>

        <div style="margin: 0 auto; width: 100%; max-width: 380px; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 45px rgba(0,0,0,0.55); text-align: left; background-color:#161b26;">

          <div style="padding: 24px 22px 24px 22px;">
            ${hasPoster ? `<div style="text-align:center; margin-bottom:20px;"><img src="cid:posterImage" alt="${safeTitle}" width="150" height="210" style="width:150px; height:210px; object-fit:cover; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 8px 24px rgba(0,0,0,0.5); background-color:#0b1120;" /></div>` : ''}

            <span style="display:inline-block; background-color:rgba(255,255,255,0.08); padding:4px 9px; border-radius:6px; color:#e2e8f0; font-size:11px; font-weight:600; letter-spacing:0.4px;">(광고) 상영작 안내</span>

            <div style="color:#ffffff; font-size:20px; font-weight:800; line-height:1.4; margin-top:16px; margin-bottom:14px;">${heading}</div>

            <p style="color:#94a3b8; font-size:14px; line-height:1.7; margin:0 0 18px 0; word-break:keep-all;">
              이번 달에도 좋은 영화 한 편을 준비했습니다. 좌석은 선착순이니 아래 버튼에서 미리 예매해 주세요.
            </p>

            <div style="background-color:rgba(0,0,0,0.42); padding:13px 15px; border-radius:11px; margin-bottom:16px;">
              <div style="color:#f1f5f9; font-size:15px; font-weight:700; margin-bottom:6px;">${safeTitle || '상영작 미정'}</div>
              <div style="color:#94a3b8; font-size:13px; font-weight:600;">2D · ${safeAgeRating}</div>
              ${safeDate ? `<div style="color:#94a3b8; font-size:13px; font-weight:600; margin-top:4px; font-variant-numeric: tabular-nums;">${safeDate}</div>` : ''}
              ${safeVenue ? `<div style="color:#94a3b8; font-size:13px; font-weight:600; margin-top:4px;">📍 ${safeVenue}</div>` : ''}
              ${deadlineText ? `<div style="color:#fbbf24; font-size:13px; font-weight:700; margin-top:8px;">⏰ 예매 기한 ${escapeHtml(deadlineText)}</div>` : ''}
            </div>

            <div style="background-color:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); padding:12px 14px; border-radius:10px;">
              <div style="color:#fcd34d; font-size:13px; font-weight:700; margin-bottom:4px;">🍿 팝콘 예약도 함께 받아요</div>
              <div style="color:#e5c07b; font-size:12px; font-weight:600; line-height:1.6;">오리지널 버터 · 콘소메 · 카라멜. 예매할 때 같이 골라 주세요.</div>
            </div>
          </div>

          <div style="height:16px; background: radial-gradient(circle at 8px 8px, #0b1120 8px, transparent 8.5px) 0 0 / 16px 16px repeat-x; background-color: #161b26;"></div>
        </div>

        <div style="margin-top: 26px;">
          <a href="${safeBaseUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 13px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 700;">🎫 좌석 예매하러 가기</a>
        </div>

        <div style="max-width: 380px; margin: 26px auto 0 auto; border-top: 1px dashed #26303f; padding-top: 16px;">
          <p style="color:#64748b; font-size:11px; line-height:1.6; margin:0;">
            본 메일은 영화대교 상영작 안내를 위한 <strong>광고성 정보</strong>입니다.<br/>
            발신: ${escapeHtml(SENDER_ORG)}<br/>
            수신을 원치 않으시면 관리자에게 알려주시면 발송 대상에서 제외해 드립니다.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(req: Request) {
  try {
    const { chunk, movieInfo, baseUrl } = (await req.json()) as {
      chunk: Recipient[];
      movieInfo: MovieInfo;
      baseUrl: string;
    };

    if (!Array.isArray(chunk) || chunk.length === 0) {
      return NextResponse.json({ success: false, error: '수신자가 없습니다.' }, { status: 400 });
    }

    // 포스터는 요청당 1회만 가져와 CID 첨부로 공유한다 (hotlink 반복 실패 방지).
    const posterImage = movieInfo?.poster_url ? await fetchSafeImage(movieInfo.poster_url) : null;
    const posterAttachment = posterImage?.ok
      ? {
          filename: 'poster.jpg',
          content: Buffer.from(posterImage.body),
          cid: 'posterImage',
          contentType: posterImage.contentType,
        }
      : null;

    const html = (name?: string | null) =>
      buildHtml({ name, movieInfo, baseUrl, hasPoster: !!posterAttachment });

    const results = await Promise.allSettled(
      chunk.map((r) =>
        sendMail({
          to: r.email,
          subject: `(광고) [영화대교] 이번 달 상영작에 초대합니다`,
          html: html(r.name),
          attachments: posterAttachment ? [posterAttachment] : undefined,
        }),
      ),
    );

    const failedEmails = results
      .map((res, i) => (res.status === 'rejected' ? chunk[i].email : null))
      .filter((e): e is string => e !== null);

    return NextResponse.json({
      success: true,
      sent: chunk.length - failedEmails.length,
      failed: failedEmails.length,
      failedEmails,
    });
  } catch (error) {
    console.error('Promo mail error:', error);
    return NextResponse.json({ success: false, error: 'Mail Failed' }, { status: 500 });
  }
}
