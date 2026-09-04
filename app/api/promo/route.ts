import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/escapeHtml';
import { fetchSafeImage } from '@/lib/safeImageFetch';

type Recipient = { email: string; name?: string | null };

type MovieInfo = {
  title?: string;
  venue?: string;
  date_string?: string;
  poster_url?: string;
  deadline_date?: string | null;
};

// 발신 주체 정보 (정보통신망법 광고성 정보 표시 의무).
const SENDER_ORG = '영화대교 (동아리)';

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
  const inviteHome = escapeHtml(baseUrl || '');
  const deadlineText = movieInfo.deadline_date ? formatDeadlineKst(movieInfo.deadline_date) : null;

  const heading = safeName
    ? `${safeName}님을 이달의 명작 상영회에 초대합니다.`
    : `이달의 명작 상영회에 초대합니다.`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark">
      <meta name="supported-color-schemes" content="dark">
      <style>
        :root { color-scheme: dark; supported-color-schemes: dark; }
        @import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #020617; -webkit-font-smoothing: antialiased;">
      <div style="background-color: #020617; padding: 40px 15px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center;">

        <div style="margin-bottom: 30px; text-align: center;">
          <div style="font-family: 'Song Myung', serif; color: #f8fafc; font-size: 42px; line-height: 1.2; letter-spacing: 5px; text-shadow: 0 0 20px rgba(245,158,11,0.5); font-weight: normal;">
            영화대교
          </div>
          <p style="color: #d97706; font-size: 12px; font-weight: bold; letter-spacing: 4px; margin: 10px 0 0 0; text-transform: uppercase;">
            Special Invitation
          </p>
        </div>

        <div style="width: 100%; max-width: 420px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); text-align: left; border: 1px solid #1e293b;">
          <div style="padding: 30px 25px;">
            <p style="color: #f59e0b; font-size: 14px; font-weight: bold; margin: 0 0 15px 0;">(광고) 특별 초청장</p>
            <h1 style="color: #f8fafc; font-size: 26px; margin: 0 0 20px 0; line-height: 1.4; word-break: keep-all;">${heading}</h1>

            <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 30px 0; word-break: keep-all;">
              최고의 좌석과 감동적인 영화가 준비되어 있으니 함께하셔서 특별한 추억을 만들어보시길 바랍니다.<br/>
              <br/>
              <span style="color: #fcd34d; font-weight: bold;">🍿 팝콘 예약 개시!</span><br/>
              오리지널 버터, 콘소메, 카라멜 등 다양한 팝콘 옵션이 이번 달에도 찾아왔습니다. 예매 시 잊지 말고 미리 선택해 주세요!
            </p>

            ${hasPoster ? `
            <div style="text-align: center; margin-bottom: 25px;">
              <img src="cid:posterImage" alt="${safeTitle} 포스터" style="max-width: 100%; width: 280px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border: 1px solid #1e293b;" />
            </div>
            ` : ''}

            <div style="background-color: #020617; border-left: 3px solid #d97706; padding: 15px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
              <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 8px 0;"><strong>🎬 영화:</strong> ${safeTitle}</p>
              <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 8px 0;"><strong>📍 장소:</strong> ${safeVenue}</p>
              <p style="color: #cbd5e1; font-size: 14px; margin: 0;"><strong>⏰ 일시:</strong> ${safeDate}</p>
            </div>

            <a href="${inviteHome}" style="display: block; background-color: #d97706; color: #020617; text-align: center; text-decoration: none; padding: 18px; border-radius: 12px; font-weight: 900; font-size: 16px; box-shadow: 0 0 20px rgba(217,119,6,0.4); letter-spacing: 1px;">🎫 좌석 예매하러 가기</a>

            ${deadlineText ? `<p style="color: #ef4444; font-size: 12px; text-align: center; margin-top: 15px;">※ 예매 기한: ${escapeHtml(deadlineText)}까지</p>` : ''}
          </div>
        </div>

        <div style="max-width: 420px; margin: 30px auto 0 auto; color: #475569; font-size: 11px; line-height: 1.6; text-align: center;">
          <p style="margin: 0;">본 메일은 영화대교 상영작 안내를 위한 <strong>광고성 정보</strong>입니다.</p>
          <p style="margin: 4px 0 0 0;">발신: ${escapeHtml(SENDER_ORG)} · 수신을 원치 않으시면 관리자에게 알려주시면 발송 대상에서 제외해 드립니다.</p>
          <p style="margin: 12px 0 0 0; color: #334155; letter-spacing: 2px;">Powered by 영화대교</p>
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
          subject: `(광고) [영화대교] 💌 이달의 상영작에 초대합니다`,
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
