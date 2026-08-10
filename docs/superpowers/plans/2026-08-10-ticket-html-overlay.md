# 티켓 카드 HTML 오버레이 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** satori 기반 이미지 합성(`renderTicketCardImage`)을 완전히 제거하고, 이메일 HTML이 배경 이미지(CID 첨부) 위에 텍스트를 직접 오버레이하는 방식(`<td background="cid:...">` + `background-image` CSS 이중 안전망)으로 티켓 카드를 만든다.

**Architecture:** `app/api/ticket/route.ts`가 포스터/배경템플릿 중 있는 것을 CID로 첨부하고, 판매번호/제목/날짜/좌석/가격/배지 텍스트를 그 이미지 위에 겹치는 테이블 기반 HTML을 생성한다. 배경 우선순위는 관리자 템플릿(984×1466, outer 확산 포함) > 원본 포스터(700×960 비율, 카드 프레임만) > 없음(단색) 순. `lib/renderTicketCard.tsx`(satori)는 삭제한다. `lib/ticketBackgroundCanvas.ts`는 SCALE=2를 적용해 관리자가 만드는 템플릿 해상도를 2배로 올린다(레이아웃 비율은 그대로).

**Tech Stack:** Next.js (Cloudflare Workers/OpenNext), nodemailer(CID 첨부), Canvas 2D API.

## Global Constraints

- 이메일 HTML에서 `flex`/`position:absolute`/다중 `background`(gradient+url 조합)는 Gmail이 신뢰성 있게 지원 안 함 — 좌우 정렬은 `<table role="presentation"><tr><td>...</td><td style="text-align:right">...</td></tr></table>`로, 오버레이는 `<td background="cid:...">` + 단일 `background-image` CSS만 사용한다(오늘 실측으로 이 조합은 확인됨).
- 이미지는 항상 CID 첨부로(외부 hotlink 금지) — `fetchSafeImage`로 미리 다운로드한 바이트를 첨부한다.
- 레이아웃 상수(`CARD_WIDTH=700, CARD_HEIGHT=960, SIDE_MARGIN=140, TOP_MARGIN=90, LOGO_BLOCK_HEIGHT=170, BOTTOM_MARGIN=90`)는 `lib/ticketBackgroundCanvas.ts`가 만드는 템플릿 이미지의 실제 레이아웃과 일치해야 한다 — 하나라도 어긋나면 텍스트가 카드 프레임 밖으로 나간다.
- 배포(`npm run deploy`) 직후 바로 curl로 검증하면 Cloudflare 엣지 전파 지연으로 구버전이 응답할 수 있다 — 배포 후 최소 15~20초 대기하고 검증할 것.
- 이 프로젝트엔 테스트 프레임워크가 없다 — 각 태스크는 `npx tsc --noEmit` + 로컬 nodemailer 스크립트로 실제 Gmail 발송 확인 + 프로덕션 `wrangler tail`로 검증한다.

---

### Task 1: 표시 크기 계산 확정

**Files:** 없음 (계산만, 다음 태스크에서 사용)

**Interfaces:** 없음

카드 표시 폭을 기존 폴백 카드와 동일한 `380px`로 통일한다. 스케일 비율 `SCALE = 380/700 = 0.542857...`을 모든 satori 레이아웃 값(픽셀 단위)에 곱해서 반올림한 값을 이후 태스크에서 그대로 상수로 쓴다.

- [ ] **Step 1: 계산 확인**

Run:
```bash
node -e '
const CARD_WIDTH=700, CARD_HEIGHT=960, SIDE_MARGIN=140, TOP_MARGIN=90, LOGO_BLOCK_HEIGHT=170, BOTTOM_MARGIN=90;
const OUTER_WIDTH = CARD_WIDTH + SIDE_MARGIN*2;
const OUTER_HEIGHT = TOP_MARGIN + LOGO_BLOCK_HEIGHT + CARD_HEIGHT + BOTTOM_MARGIN;
const DISPLAY_CARD_WIDTH = 380;
const SCALE = DISPLAY_CARD_WIDTH / CARD_WIDTH;
const r = (n) => Math.round(n * SCALE);
console.log({
  OUTER_WIDTH, OUTER_HEIGHT,
  DISPLAY_CARD_WIDTH,
  DISPLAY_CARD_HEIGHT: r(CARD_HEIGHT),
  DISPLAY_OUTER_WIDTH: r(OUTER_WIDTH),
  DISPLAY_OUTER_HEIGHT: r(OUTER_HEIGHT),
  DISPLAY_CARD_TOP: r(TOP_MARGIN + LOGO_BLOCK_HEIGHT),
  DISPLAY_CARD_LEFT: r(SIDE_MARGIN),
});
'
```

Expected:
```
{
  OUTER_WIDTH: 984,
  OUTER_HEIGHT: 1466,
  DISPLAY_CARD_WIDTH: 380,
  DISPLAY_CARD_HEIGHT: 521,
  DISPLAY_OUTER_WIDTH: 534,
  DISPLAY_OUTER_HEIGHT: 796,
  DISPLAY_CARD_TOP: 141,
  DISPLAY_CARD_LEFT: 76
}
```

이 값들(`380, 521, 534, 796, 141, 76`)을 Task 2에서 상수로 그대로 쓴다. 우측 여백은 `DISPLAY_OUTER_WIDTH - DISPLAY_CARD_LEFT - DISPLAY_CARD_WIDTH = 534 - 76 - 380 = 78`.

---

### Task 2: `app/api/ticket/route.ts` — satori 제거, HTML 오버레이로 전환

**Files:**
- Modify: `app/api/ticket/route.ts` (전체 재작성)

**Interfaces:**
- Consumes: `fetchSafeImage(src: string): Promise<SafeImageFetchResult>` (기존, `lib/safeImageFetch.ts`), `escapeHtml(value: unknown): string` (기존), `sendMail({ to, subject, html, attachments }): Promise<void>` (기존, `attachments`는 `{ filename: string; content: Buffer; cid: string; contentType: string }[]`)
- Produces: 없음 (엔드포인트) — `renderTicketCardImage`/`TicketCardProps`(`lib/renderTicketCard.tsx`)는 더 이상 import하지 않는다.

- [ ] **Step 1: 파일 전체 교체**

```typescript
import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/escapeHtml';
import { fetchSafeImage } from '@/lib/safeImageFetch';

// lib/ticketBackgroundCanvas.ts가 만드는 템플릿의 레이아웃과 반드시 일치해야 한다.
const CARD_WIDTH = 700;
const SIDE_MARGIN = 140;
const TOP_MARGIN = 90;
const LOGO_BLOCK_HEIGHT = 170;
const OUTER_WIDTH = 984;

const DISPLAY_CARD_WIDTH = 380;
const DISPLAY_CARD_HEIGHT = 521;
const DISPLAY_OUTER_WIDTH = 534;
const DISPLAY_OUTER_HEIGHT = 796;
const DISPLAY_CARD_TOP = 141;
const DISPLAY_CARD_LEFT = 76;
const DISPLAY_CARD_RIGHT_GAP = DISPLAY_OUTER_WIDTH - DISPLAY_CARD_LEFT - DISPLAY_CARD_WIDTH;

function buildCardContentHtml(params: {
  displayId: string;
  movieTitle: string;
  ageRating: string;
  movieDate: string;
  venue: string;
  popcornText: string;
  priceText: string;
  seat: string;
  name: string;
  statusType: string;
  badgeColor: string;
  badgeText: string;
}): string {
  const { displayId, movieTitle, ageRating, movieDate, venue, popcornText, priceText, seat, name, statusType, badgeColor, badgeText } = params;
  return `
    <span style="display:inline-block; background-color:rgba(0,0,0,0.45); padding:4px 10px; border-radius:7px; color:#e2e8f0; font-size:12px; font-weight:600; font-variant-numeric: tabular-nums;">판매번호 ${displayId}</span>
    <div style="color:#ffffff; font-size:25px; font-weight:800; line-height:1.25; text-shadow:0 2px 8px rgba(0,0,0,0.6); margin-top:119px; margin-bottom:7px;">${movieTitle}</div>
    <div style="color:#cbd5e1; font-size:13px; font-weight:600; text-shadow:0 2px 6px rgba(0,0,0,0.6); margin-bottom:20px;">2D · ${ageRating || '전체관람가'}</div>
    <div style="margin-bottom:17px;">
      <div style="color:#f1f5f9; font-size:16px; font-weight:700; text-shadow:0 2px 6px rgba(0,0,0,0.6); font-variant-numeric: tabular-nums;">${movieDate}</div>
      ${venue ? `<div style="color:#e2e8f0; font-size:14px; font-weight:600; text-shadow:0 2px 6px rgba(0,0,0,0.6); margin-top:4px;">${venue}</div>` : ''}
    </div>
    <div style="background-color:rgba(0,0,0,0.42); padding:13px 15px; border-radius:11px; margin-bottom:20px;">
      <div style="color:#e2e8f0; font-size:14px; font-weight:600;">${popcornText}</div>
      <div style="color:#94a3b8; font-size:13px; font-weight:700; margin-top:4px; font-variant-numeric: tabular-nums;">결제 금액 ${priceText}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:bottom;">
        <span style="font-size:48px; font-weight:800; color:#ef4444; text-decoration:${statusType === 'canceled' ? 'line-through' : 'none'}; line-height:1; font-variant-numeric: tabular-nums;">${seat}</span>
        <span style="color:#e2e8f0; font-size:14px; font-weight:600; text-shadow:0 2px 4px rgba(0,0,0,0.6); margin-left:9px;">${name} 님</span>
      </td>
      <td style="vertical-align:bottom; text-align:right; white-space:nowrap;">
        <span style="display:inline-block; padding:4px 10px; background-color:rgba(0,0,0,0.5); border-radius:7px; font-weight:700; font-size:12px; color:${badgeColor}; border:1px solid ${badgeColor};">${badgeText}</span>
      </td>
    </tr></table>
  `;
}

export async function POST(req: Request) {
  try {
    const { email, name, seat, movieTitle, movieDate, venue, ageRating, posterUrl, backgroundTemplateUrl, statusType, popcorn, ticketId, baseUrl, isRefundNeeded } = await req.json();

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

    const posterImage = posterUrl ? await fetchSafeImage(posterUrl) : null;
    const templateImage = backgroundTemplateUrl ? await fetchSafeImage(backgroundTemplateUrl) : null;

    const cardBackground = templateImage?.ok
      ? { body: templateImage.body, contentType: templateImage.contentType, outer: true as const }
      : posterImage?.ok
      ? { body: posterImage.body, contentType: posterImage.contentType, outer: false as const }
      : null;

    const safeBaseUrl = escapeHtml(baseUrl);
    const safeMovieTitle = escapeHtml(movieTitle);
    const safeMovieDate = escapeHtml(movieDate);
    const safeVenue = escapeHtml(venue);
    const safeAgeRating = escapeHtml(ageRating);
    const safeSeat = escapeHtml(seat);
    const safeName = escapeHtml(name);

    const cardContentHtml = buildCardContentHtml({
      displayId: escapeHtml(displayId),
      movieTitle: safeMovieTitle,
      ageRating: safeAgeRating,
      movieDate: safeMovieDate,
      venue: safeVenue,
      popcornText,
      priceText: escapeHtml(priceText),
      seat: safeSeat,
      name: safeName,
      statusType,
      badgeColor,
      badgeText: escapeHtml(badgeText),
    });

    const cardMarkup = !cardBackground
      ? `<table role="presentation" width="${DISPLAY_CARD_WIDTH}" cellpadding="0" cellspacing="0" style="width:${DISPLAY_CARD_WIDTH}px; max-width:100%;">
          <tr><td bgcolor="#161b26" style="background-color:#161b26; padding:24px 24px 27px 24px; border-radius:20px; text-align:left;">
            ${cardContentHtml}
          </td></tr>
        </table>`
      : cardBackground.outer
      ? `<table role="presentation" width="${DISPLAY_OUTER_WIDTH}" cellpadding="0" cellspacing="0" style="width:${DISPLAY_OUTER_WIDTH}px; max-width:100%;">
          <tr><td background="cid:cardBg" bgcolor="#0b1120" style="background-image:url(cid:cardBg); background-size:100% 100%; background-repeat:no-repeat; padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="height:${DISPLAY_CARD_TOP}px; line-height:${DISPLAY_CARD_TOP}px; font-size:1px;">&nbsp;</td></tr>
              <tr>
                <td style="padding-left:${DISPLAY_CARD_LEFT}px; padding-right:${DISPLAY_CARD_RIGHT_GAP}px;">
                  <div style="width:${DISPLAY_CARD_WIDTH}px; padding:24px 24px 27px 24px; box-sizing:border-box; text-align:left;">
                    ${cardContentHtml}
                  </div>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>`
      : `<table role="presentation" width="${DISPLAY_CARD_WIDTH}" cellpadding="0" cellspacing="0" style="width:${DISPLAY_CARD_WIDTH}px; max-width:100%;">
          <tr><td background="cid:cardBg" bgcolor="#161b26" style="background-image:url(cid:cardBg); background-size:100% 100%; background-repeat:no-repeat; padding:24px 24px 27px 24px; box-sizing:border-box; border-radius:20px; text-align:left;">
            ${cardContentHtml}
          </td></tr>
        </table>`;

    const templateUsed = Boolean(cardBackground?.outer);

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
          <div style="padding: 40px 12px; font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; text-align: center;">

          ${!templateUsed ? `
          <div style="margin-bottom: 26px;">
            <div style="font-family: 'Song Myung', serif; color: #f1f5f9; font-size: 28px; line-height: 1.15; letter-spacing: 0.1em; text-shadow: 0 0 18px rgba(255,255,255,0.25);">
              영화<br/>대교
            </div>
          </div>
          ` : ''}

          ${cardMarkup}

          ${statusType === 'pending' ? `
            <p style="margin-top: 25px; color: #fbbf24; font-weight: bold; font-size: 14px;">⚠️ 30분 내로 아래 QR코드로 입금해주세요. (총액: ${formattedPrice}원)</p>
            <div style="margin-top: 15px; text-align: center;">
              <img src="${safeBaseUrl}/qr.jpeg" alt="송금 QR" width="150" height="150" style="border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);" />
            </div>
            <div style="margin: 15px auto 0 auto; max-width: 320px; background-color: #161b26; border: 1px solid #26303f; border-radius: 10px; padding: 12px 14px; text-align: left;">
              <div style="font-size: 10px; letter-spacing: 2px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">계좌번호</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-family: monospace; font-size: 13px; color: #f1f5f9; font-weight: bold;">7777028184681 카카오뱅크 신민규</td>
                <td style="text-align:right; white-space:nowrap;"><span style="font-size: 10px; color: #94a3b8; border: 1px solid #334155; padding: 4px 8px; border-radius: 6px; background-color: #0b1120;">길게 눌러 복사</span></td>
              </tr></table>
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
      </body>
      </html>
    `;

    const attachments = cardBackground
      ? [{ filename: 'card-bg.png', content: Buffer.from(cardBackground.body), cid: 'cardBg', contentType: cardBackground.contentType }]
      : undefined;

    await sendMail({ to: email, subject, html: ticketHTML, attachments });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Mail Failed' }, { status: 500 });
  }
}
```

레이아웃 상수 중 `CARD_WIDTH`, `SIDE_MARGIN`, `TOP_MARGIN`, `LOGO_BLOCK_HEIGHT`, `OUTER_WIDTH`는 이 파일에서 실제로 계산에 쓰이지 않고 문서화 목적으로만 남겨뒀다 — `DISPLAY_*` 상수만 실제로 쓰인다. (다음 태스크에서 tsc가 미사용 변수를 문제 삼지 않는지 확인한다 — TypeScript는 기본적으로 미사용 최상위 `const`를 에러로 잡지 않는다.)

- [ ] **Step 2: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: `lib/renderTicketCard.tsx`를 아직 안 지웠으므로 그 파일 자체에는 에러가 없어야 하고(독립적으로 유효한 파일), `route.ts`도 이제 그 파일을 참조하지 않으므로 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add app/api/ticket/route.ts
git commit -m "$(cat <<'EOF'
feat(mail): satori 제거하고 HTML 오버레이 방식으로 티켓 카드 전환

CPU 예산 문제를 근본적으로 우회 — 배경 이미지를 CID 첨부하고
<td background=cid:...> + background-image 이중 안전망으로 텍스트를
직접 오버레이. 템플릿(outer) > 포스터(카드만) > 없음 순으로 폴백.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `lib/renderTicketCard.tsx` 삭제

**Files:**
- Delete: `lib/renderTicketCard.tsx`

**Interfaces:** 없음 (Task 2가 이미 이 파일을 참조하지 않으므로 삭제해도 다른 파일에 영향 없음)

- [ ] **Step 1: 다른 곳에서 참조 안 하는지 확인**

Run: `cd /Users/shinmingyu/Project/movie-ticket && grep -rn "renderTicketCard" app/ lib/ --include="*.ts" --include="*.tsx"`
Expected: 결과 없음 (Task 2에서 이미 `app/api/ticket/route.ts`의 import를 제거했으므로).

- [ ] **Step 2: 파일 삭제**

Run: `cd /Users/shinmingyu/Project/movie-ticket && rm lib/renderTicketCard.tsx`

- [ ] **Step 3: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add -A lib/renderTicketCard.tsx
git commit -m "$(cat <<'EOF'
refactor(mail): satori 카드 렌더러 삭제

HTML 오버레이 방식으로 전환하며 더 이상 쓰이지 않음.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `lib/ticketBackgroundCanvas.ts` — 해상도 2배로 (SCALE)

**Files:**
- Modify: `lib/ticketBackgroundCanvas.ts:174-190` (`renderTicketBackground` 함수 시작 부분)

**Interfaces:**
- Consumes: 없음 (내부 구현 변경만)
- Produces: `renderTicketBackground(posterUrl: string): Promise<Blob>` — 시그니처는 그대로, 반환하는 PNG의 실제 픽셀 크기만 `OUTER_WIDTH*2 × OUTER_HEIGHT*2`(1968×2932)로 커진다. `blobToDataUri`는 변경 없음.

- [ ] **Step 1: `SCALE` 상수 추가**

`const CARD_RADIUS = 28;` 바로 다음 줄에 추가:

```typescript
const SCALE = 2;
```

- [ ] **Step 2: canvas 크기와 컨텍스트 스케일 적용**

`export async function renderTicketBackground` 함수의 다음 부분을 찾는다:

```typescript
  const canvas = document.createElement('canvas');
  canvas.width = OUTER_WIDTH;
  canvas.height = OUTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context를 가져올 수 없습니다.');
```

다음으로 교체:

```typescript
  const canvas = document.createElement('canvas');
  canvas.width = OUTER_WIDTH * SCALE;
  canvas.height = OUTER_HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context를 가져올 수 없습니다.');
  ctx.scale(SCALE, SCALE);
```

이 아래 나머지 그리기 로직(`ctx.fillRect(0, 0, OUTER_WIDTH, OUTER_HEIGHT)` 등)은 전부 그대로 둔다 — `ctx.scale`이 이후 모든 그리기 좌표를 자동으로 2배 확대해서 실제 픽셀에 그린다.

- [ ] **Step 3: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add lib/ticketBackgroundCanvas.ts
git commit -m "$(cat <<'EOF'
feat(admin): 티켓 배경 템플릿 해상도 2배로 상향

canvas가 관리자 브라우저에서 돌아가 CPU 제한과 무관해졌으므로,
레이아웃 좌표는 그대로 두고 ctx.scale(2,2)로 실제 픽셀만 2배 확대.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 로컬 nodemailer 스크립트로 세 가지 배경 케이스 실제 발송 검증

**Files:** 없음 (일회성 검증 스크립트, 파일로 저장하지 않고 `node -e`로 실행)

**Interfaces:** 없음 (수동 검증)

Task 2에서 만든 `buildCardContentHtml`/`cardMarkup` 로직을 실제 route.ts 코드에서 그대로 복사해 로컬 nodemailer로 3케이스를 발송해본다 — 프로덕션 배포 없이 로컬에서 바로 육안 검증할 수 있다.

- [ ] **Step 1: 케이스 A — outer 템플릿 있음 (984×1466 placeholder)**

Run:
```bash
cd /Users/shinmingyu/Project/movie-ticket
curl -s -o /tmp/test-outer-bg.png "https://placehold.co/984x1466/1a1a2e/1a1a2e.png"
node -e '
const nodemailer = require("nodemailer");
require("dotenv").config({ path: ".env.local" });

const cardContentHtml = `
  <span style="display:inline-block; background-color:rgba(0,0,0,0.45); padding:4px 10px; border-radius:7px; color:#e2e8f0; font-size:12px; font-weight:600;">판매번호 A1B2C3</span>
  <div style="color:#ffffff; font-size:25px; font-weight:800; line-height:1.25; text-shadow:0 2px 8px rgba(0,0,0,0.6); margin-top:119px; margin-bottom:7px;">죽은 시인의 사회</div>
  <div style="color:#cbd5e1; font-size:13px; font-weight:600; text-shadow:0 2px 6px rgba(0,0,0,0.6); margin-bottom:20px;">2D · 12세이상관람가</div>
  <div style="margin-bottom:17px;">
    <div style="color:#f1f5f9; font-size:16px; font-weight:700; text-shadow:0 2px 6px rgba(0,0,0,0.6);">2026년 8월 22일 (토) 10:00 ~ 11:40</div>
    <div style="color:#e2e8f0; font-size:14px; font-weight:600; text-shadow:0 2px 6px rgba(0,0,0,0.6); margin-top:4px;">대구과학고등학교 중강당</div>
  </div>
  <div style="background-color:rgba(0,0,0,0.42); padding:13px 15px; border-radius:11px; margin-bottom:20px;">
    <div style="color:#e2e8f0; font-size:14px; font-weight:600;">음료/팝콘 없음</div>
    <div style="color:#94a3b8; font-size:13px; font-weight:700; margin-top:4px;">결제 금액 0 원 (무료)</div>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:bottom;">
      <span style="font-size:48px; font-weight:800; color:#ef4444; line-height:1;">A35</span>
      <span style="color:#e2e8f0; font-size:14px; font-weight:600; text-shadow:0 2px 4px rgba(0,0,0,0.6); margin-left:9px;">신민규 님</span>
    </td>
    <td style="vertical-align:bottom; text-align:right; white-space:nowrap;">
      <span style="display:inline-block; padding:4px 10px; background-color:rgba(0,0,0,0.5); border-radius:7px; font-weight:700; font-size:12px; color:#60a5fa; border:1px solid #60a5fa;">좌석 변경됨</span>
    </td>
  </tr></table>
`;

const cardMarkup = `<table role="presentation" width="534" cellpadding="0" cellspacing="0" style="width:534px; max-width:100%;">
  <tr><td background="cid:cardBg" bgcolor="#0b1120" style="background-image:url(cid:cardBg); background-size:100% 100%; background-repeat:no-repeat; padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="height:141px; line-height:141px; font-size:1px;">&nbsp;</td></tr>
      <tr>
        <td style="padding-left:76px; padding-right:78px;">
          <div style="width:380px; padding:24px 24px 27px 24px; box-sizing:border-box; text-align:left;">
            ${cardContentHtml}
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;

const html = `<!DOCTYPE html><html><body style="margin:0; padding:0; background-color:#0b1120;">
<div style="padding:30px; font-family:sans-serif; text-align:center;">
  <h3 style="color:#fff;">케이스 A: outer 템플릿 (984x1466)</h3>
  ${cardMarkup}
</div>
</body></html>`;

const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER_1, pass: process.env.GMAIL_APP_PASSWORD_1 } });
transporter.sendMail({
  from: `"케이스A테스트" <${process.env.GMAIL_USER_1}>`,
  to: "seong381400@gmail.com",
  subject: "[검증A] outer 템플릿 오버레이",
  html,
  attachments: [{ filename: "bg.png", path: "/tmp/test-outer-bg.png", cid: "cardBg" }],
}).then(info => console.log("SENT", info.messageId)).catch(err => console.error("ERR", err));
'
```

Expected: 발송 성공 로그. 실제 메일에서 텍스트가 배경(어두운 남색) 프레임 위 정확한 위치(카드 프레임처럼 보이는 안쪽 영역)에 겹쳐 보이는지, 좌우 여백이 대칭적인지 육안 확인.

- [ ] **Step 2: 케이스 B — 포스터만 있음**

Run:
```bash
cd /Users/shinmingyu/Project/movie-ticket
curl -sL -o /tmp/test-poster.jpg "https://img.movist.com/?img=/x00/00/01/08_p1.jpg"
node -e '
const nodemailer = require("nodemailer");
require("dotenv").config({ path: ".env.local" });

const cardContentHtml = `
  <span style="display:inline-block; background-color:rgba(0,0,0,0.45); padding:4px 10px; border-radius:7px; color:#e2e8f0; font-size:12px; font-weight:600;">판매번호 A1B2C3</span>
  <div style="color:#ffffff; font-size:25px; font-weight:800; line-height:1.25; text-shadow:0 2px 8px rgba(0,0,0,0.6); margin-top:119px; margin-bottom:7px;">죽은 시인의 사회</div>
  <div style="color:#cbd5e1; font-size:13px; font-weight:600; text-shadow:0 2px 6px rgba(0,0,0,0.6); margin-bottom:20px;">2D · 12세이상관람가</div>
  <div style="margin-bottom:17px;">
    <div style="color:#f1f5f9; font-size:16px; font-weight:700; text-shadow:0 2px 6px rgba(0,0,0,0.6);">2026년 8월 22일 (토) 10:00 ~ 11:40</div>
    <div style="color:#e2e8f0; font-size:14px; font-weight:600; text-shadow:0 2px 6px rgba(0,0,0,0.6); margin-top:4px;">대구과학고등학교 중강당</div>
  </div>
  <div style="background-color:rgba(0,0,0,0.42); padding:13px 15px; border-radius:11px; margin-bottom:20px;">
    <div style="color:#e2e8f0; font-size:14px; font-weight:600;">음료/팝콘 없음</div>
    <div style="color:#94a3b8; font-size:13px; font-weight:700; margin-top:4px;">결제 금액 0 원 (무료)</div>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:bottom;">
      <span style="font-size:48px; font-weight:800; color:#ef4444; line-height:1;">A35</span>
      <span style="color:#e2e8f0; font-size:14px; font-weight:600; text-shadow:0 2px 4px rgba(0,0,0,0.6); margin-left:9px;">신민규 님</span>
    </td>
    <td style="vertical-align:bottom; text-align:right; white-space:nowrap;">
      <span style="display:inline-block; padding:4px 10px; background-color:rgba(0,0,0,0.5); border-radius:7px; font-weight:700; font-size:12px; color:#60a5fa; border:1px solid #60a5fa;">좌석 변경됨</span>
    </td>
  </tr></table>
`;

const cardMarkup = `<table role="presentation" width="380" cellpadding="0" cellspacing="0" style="width:380px; max-width:100%;">
  <tr><td background="cid:cardBg" bgcolor="#161b26" style="background-image:url(cid:cardBg); background-size:100% 100%; background-repeat:no-repeat; padding:24px 24px 27px 24px; box-sizing:border-box; border-radius:20px; text-align:left;">
    ${cardContentHtml}
  </td></tr>
</table>`;

const html = `<!DOCTYPE html><html><body style="margin:0; padding:0; background-color:#0b1120;">
<div style="padding:30px; font-family:sans-serif; text-align:center;">
  <h3 style="color:#fff;">케이스 B: 포스터만 (카드 프레임)</h3>
  ${cardMarkup}
</div>
</body></html>`;

const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER_1, pass: process.env.GMAIL_APP_PASSWORD_1 } });
transporter.sendMail({
  from: `"케이스B테스트" <${process.env.GMAIL_USER_1}>`,
  to: "seong381400@gmail.com",
  subject: "[검증B] 포스터만 있는 카드 오버레이",
  html,
  attachments: [{ filename: "poster.jpg", path: "/tmp/test-poster.jpg", cid: "cardBg" }],
}).then(info => console.log("SENT", info.messageId)).catch(err => console.error("ERR", err));
'
```

Expected: 발송 성공. 포스터 전체가 카드 배경으로 깔리고 텍스트가 그 위에 잘 보이는지, 라운드코너가 적용되는지 확인.

- [ ] **Step 3: 케이스 C — 배경 없음**

Run:
```bash
cd /Users/shinmingyu/Project/movie-ticket
node -e '
const nodemailer = require("nodemailer");
require("dotenv").config({ path: ".env.local" });

const cardContentHtml = `
  <span style="display:inline-block; background-color:rgba(0,0,0,0.45); padding:4px 10px; border-radius:7px; color:#e2e8f0; font-size:12px; font-weight:600;">판매번호 A1B2C3</span>
  <div style="color:#ffffff; font-size:25px; font-weight:800; line-height:1.25; margin-top:119px; margin-bottom:7px;">죽은 시인의 사회</div>
  <div style="color:#cbd5e1; font-size:13px; font-weight:600; margin-bottom:20px;">2D · 12세이상관람가</div>
  <div style="margin-bottom:17px;">
    <div style="color:#f1f5f9; font-size:16px; font-weight:700;">2026년 8월 22일 (토) 10:00 ~ 11:40</div>
    <div style="color:#e2e8f0; font-size:14px; font-weight:600; margin-top:4px;">대구과학고등학교 중강당</div>
  </div>
  <div style="background-color:rgba(0,0,0,0.42); padding:13px 15px; border-radius:11px; margin-bottom:20px;">
    <div style="color:#e2e8f0; font-size:14px; font-weight:600;">음료/팝콘 없음</div>
    <div style="color:#94a3b8; font-size:13px; font-weight:700; margin-top:4px;">결제 금액 0 원 (무료)</div>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:bottom;">
      <span style="font-size:48px; font-weight:800; color:#ef4444; line-height:1;">A35</span>
      <span style="color:#e2e8f0; font-size:14px; font-weight:600; margin-left:9px;">신민규 님</span>
    </td>
    <td style="vertical-align:bottom; text-align:right; white-space:nowrap;">
      <span style="display:inline-block; padding:4px 10px; background-color:rgba(0,0,0,0.5); border-radius:7px; font-weight:700; font-size:12px; color:#60a5fa; border:1px solid #60a5fa;">좌석 변경됨</span>
    </td>
  </tr></table>
`;

const cardMarkup = `<table role="presentation" width="380" cellpadding="0" cellspacing="0" style="width:380px; max-width:100%;">
  <tr><td bgcolor="#161b26" style="background-color:#161b26; padding:24px 24px 27px 24px; border-radius:20px; text-align:left;">
    ${cardContentHtml}
  </td></tr>
</table>`;

const html = `<!DOCTYPE html><html><body style="margin:0; padding:0; background-color:#0b1120;">
<div style="padding:30px; font-family:sans-serif; text-align:center;">
  <h3 style="color:#fff;">케이스 C: 배경 없음</h3>
  ${cardMarkup}
</div>
</body></html>`;

const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER_1, pass: process.env.GMAIL_APP_PASSWORD_1 } });
transporter.sendMail({
  from: `"케이스C테스트" <${process.env.GMAIL_USER_1}>`,
  to: "seong381400@gmail.com",
  subject: "[검증C] 배경 없는 카드",
  html,
}).then(info => console.log("SENT", info.messageId)).catch(err => console.error("ERR", err));
'
```

Expected: 발송 성공. 단색 배경에 텍스트만 정상 배치되는지 확인.

- [ ] **Step 4: 세 메일 모두 실제 Gmail에서 육안 확인**

세 케이스 다 텍스트가 겹치지 않고, 잘리지 않고, 카드 프레임(또는 배경) 안에 자연스럽게 들어가 있는지 확인한다. 문제가 있으면(패딩/여백이 안 맞음 등) Task 2의 `DISPLAY_*` 상수나 `buildCardContentHtml`의 margin/padding 값을 조정하고 이 태스크를 다시 실행한다.

이 태스크는 코드 변경이 없으므로 커밋할 것이 없다 — 검증만 통과하면 다음 태스크로 진행한다.

---

### Task 6: 프로덕션 배포 + 최종 검증

**Files:** 없음 (배포 + 수동 검증만)

**Interfaces:** 없음 (통합 테스트)

- [ ] **Step 1: 전체 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 2: 프로덕션 배포**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npm run deploy 2>&1 | tail -15`
Expected: `Deployed movie-bridge triggers` 로그.

- [ ] **Step 3: 배포 전파 대기**

Run: `sleep 20`

- [ ] **Step 4: CPU 예산 확인 겸 실제 발송 반복 테스트 (포스터만 케이스, 5회)**

Run:
```bash
for i in 1 2 3 4 5; do
curl -s -o /dev/null -w "attempt$i: %{http_code}\n" -X POST "https://movie-bridge.seong381400.workers.dev/api/ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seong381400@gmail.com",
    "name": "HTML오버레이검증",
    "seat": "H'"$i"'",
    "movieTitle": "죽은 시인의 사회",
    "movieDate": "2026년 8월 22일 (토) 10:00 ~ 11:40",
    "venue": "대구과학고등학교 중강당",
    "ageRating": "12세이상관람가",
    "posterUrl": "https://img.movist.com/?img=/x00/00/01/08_p1.jpg",
    "statusType": "changed",
    "popcorn": "none",
    "ticketId": "html-overlay-verify-'"$i"'",
    "baseUrl": "https://movie-bridge.seong381400.workers.dev"
  }'
sleep 1
done
```

Expected: 5번 모두 `200`. satori를 완전히 제거했으므로 CPU 초과(503/1102)는 더 이상 발생하지 않아야 한다 — 이게 이 전환의 핵심 성공 기준이다.

- [ ] **Step 5: 관리자 페이지에서 실제 배경 템플릿 생성 (프로덕션)**

`https://movie-bridge.seong381400.workers.dev/admin`에 접속해 관리자 로그인 후, 포스터 주소가 `https://img.movist.com/?img=/x00/00/01/08_p1.jpg`인 상태에서 "티켓 배경 생성" 버튼을 클릭한다.

Expected: "생성 완료" 표시.

- [ ] **Step 6: outer 템플릿 케이스로 실제 발송 (프로덕션)**

Run:
```bash
cd /Users/shinmingyu/Project/movie-ticket
set -a && source .env.local && set +a
TEMPLATE_URL=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/movie_settings?select=background_template_url&is_active=eq.true" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].background_template_url))")
echo "TEMPLATE_URL=$TEMPLATE_URL"

curl -s -X POST "https://movie-bridge.seong381400.workers.dev/api/ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seong381400@gmail.com",
    "name": "outer템플릿최종검증",
    "seat": "F1",
    "movieTitle": "죽은 시인의 사회",
    "movieDate": "2026년 8월 22일 (토) 10:00 ~ 11:40",
    "venue": "대구과학고등학교 중강당",
    "ageRating": "12세이상관람가",
    "posterUrl": "https://img.movist.com/?img=/x00/00/01/08_p1.jpg",
    "backgroundTemplateUrl": "'"$TEMPLATE_URL"'",
    "statusType": "changed",
    "popcorn": "original,caramel",
    "ticketId": "outer-final-verify-1",
    "baseUrl": "https://movie-bridge.seong381400.workers.dev"
  }' -w "\nstatus:%{http_code}\n"
```

Expected: `status:200`.

- [ ] **Step 7: 실제 수신 이메일 육안 확인**

`seong381400@gmail.com` 받은편지함에서 방금 보낸 메일들을 열어, 블러 확산 배경(2배 해상도로 더 선명해졌는지) + 로고 + 카드 프레임 + 절취선 + 텍스트가 모두 정상적으로 겹쳐 보이는지, 텍스트가 카드 프레임 안쪽에 정확히 위치하는지 확인한다.

- [ ] **Step 8: 결과에 따른 후속 조치**

- CPU 초과가 완전히 사라졌고 레이아웃도 정상이면: 완료.
- 레이아웃이 미세하게 어긋나면(패딩/여백 조정): Task 2의 `DISPLAY_*` 상수나 `buildCardContentHtml`의 스타일 값을 조정하고 Task 6부터 재검증한다.
