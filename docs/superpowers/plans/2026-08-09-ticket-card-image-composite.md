# 티켓 카드 이미지 합성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `app/api/ticket/route.ts`가 보내는 티켓 이메일의 카드(포스터+그라디언트+판매번호/제목/날짜/좌석/가격/상태배지)를 서버에서 하나의 PNG로 합성해 CID 첨부로 보내고, 합성 실패 시 지금 배포된 안전한 HTML 카드로 자동 폴백한다.

**Architecture:** `satori`(JSX+CSS→SVG)로 카드를 그리고 `@resvg/resvg-wasm`(SVG→PNG)로 래스터화한다. 새 모듈 `lib/renderTicketCard.tsx`가 이 파이프라인을 캡슐화하고, `app/api/ticket/route.ts`가 이걸 호출해 성공하면 압축된 HTML(로고+이미지 한 장+QR/상태/CTA), 실패하면 지금 커밋된 원래 카드 HTML을 그대로 보낸다.

**Tech Stack:** Next.js 16.2.2 / Cloudflare Workers(OpenNext, workerd) / satori / @resvg/resvg-wasm / nodemailer(CID 첨부) / TypeScript

## Global Constraints

- Next.js 버전 임의로 올리지 말 것 (AGENTS.md, 16.2.2 고정 — fork 특성상 peer dep 갭 있음).
- Cloudflare Workers(workerd)에서 서버 전용 시크릿/클라이언트는 모듈 최상위에서 읽지 말고 함수 내부에서 지연 평가할 것.
- `runtime = 'edge'` 선언하지 말 것 (`@opennextjs/cloudflare` 미지원).
- 이번 스펙 범위는 `app/api/ticket/route.ts`만 — `app/api/group-invite/route.ts`는 건드리지 않는다.
- 이미지 합성 실패 시 반드시 기존 안전한 HTML 카드로 폴백 — 메일 발송 자체가 막히는 경로가 있으면 안 됨.
- 실제 검증은 PDF 인쇄본이 아니라 Gmail 앱/웹 화면 스크린샷으로 할 것 (인쇄는 배경 그래픽이 빠져서 판단 근거가 안 됨).

---

## File Structure

- `lib/renderTicketCard.tsx` (신규) — satori+resvg-wasm 렌더 파이프라인. `renderTicketCardImage()`(메인 함수), `ensureResvgWasmInit()`(WASM 1회 초기화, 환경별 호출자가 바이트를 넘겨줌).
- `app/api/ticket/route.ts` (수정) — `renderTicketCardImage()` 호출 + 성공/실패 분기.
- `package.json` (수정) — `satori`, `@resvg/resvg-wasm` 의존성 추가.
- `public/fonts/Pretendard-{Regular,Bold}.otf` (이미 커밋됨, a8112cf) — 렌더 시점에 fetch.
- 검증용 임시 스크립트(커밋 안 함, 스크래치패드에 작성) — Task 2에서 로컬로 PNG 출력 확인용.

---

## Task 1: 의존성 추가

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `satori` (default export, `(node, options) => Promise<string>`), `@resvg/resvg-wasm` (`Resvg` 클래스, `initWasm` 함수) — 이후 태스크가 씀.

- [ ] **Step 1: 패키지 설치**

```bash
npm install satori @resvg/resvg-wasm
```

- [ ] **Step 2: 설치 확인**

Run: `npm ls satori @resvg/resvg-wasm`
Expected: 둘 다 버전 표시되고 에러 없음 (satori ^0.29.x, @resvg/resvg-wasm ^2.6.x)

- [ ] **Step 3: 타입체크로 아무것도 안 깨졌는지 확인**

Run: `npx next build 2>&1 | tail -20`
Expected: `✓ Compiled successfully`, `Finished TypeScript` (기존과 동일하게 통과)

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: satori, @resvg/resvg-wasm 의존성 추가 (티켓 카드 이미지 합성용)"
```

---

## Task 2: `lib/renderTicketCard.tsx` 핵심 렌더 파이프라인

**Files:**
- Create: `lib/renderTicketCard.tsx`
- Test (로컬 수동 검증용, 커밋 안 함): `/private/tmp/claude-501/-Users-shinmingyu-Project-movie-ticket/*/scratchpad/verify-render.ts` (세션마다 경로 다름 — 실행 시 현재 스크래치패드 경로 사용)

**Interfaces:**
- Consumes: `fetchSafeImage(src: string)` from `lib/safeImageFetch.ts` (기존, `Promise<SafeImageFetchResult>`, `{ok:true, body:Uint8Array<ArrayBuffer>, contentType:string} | {ok:false,...}`)
- Produces:
  - `ensureResvgWasmInit(wasmBytes: ArrayBuffer | Uint8Array): Promise<void>` — 1회만 초기화, 재호출 시 no-op.
  - `renderTicketCardImage(props: TicketCardProps): Promise<Buffer | null>` — 실패 시 절대 throw 안 하고 `null` 반환.
  - `interface TicketCardProps { baseUrl: string; posterUrl: string | null; movieTitle: string; movieDate: string; venue: string; ageRating: string; seat: string; name: string; displayId: string; statusType: string; badgeColor: string; badgeText: string; priceText: string; popcornLines: string[]; }`

- [ ] **Step 1: `lib/renderTicketCard.tsx` 작성**

```tsx
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { fetchSafeImage } from '@/lib/safeImageFetch';

export interface TicketCardProps {
  baseUrl: string;
  posterUrl: string | null;
  movieTitle: string;
  movieDate: string;
  venue: string;
  ageRating: string;
  seat: string;
  name: string;
  displayId: string;
  statusType: string;
  badgeColor: string;
  badgeText: string;
  priceText: string;
  popcornLines: string[];
}

const CARD_WIDTH = 760;
const CARD_HEIGHT = 940;
const POSTER_HEIGHT = 520;
const RENDER_TIMEOUT_MS = 8_000;

let resvgWasmReady = false;

export async function ensureResvgWasmInit(wasmBytes: ArrayBuffer | Uint8Array): Promise<void> {
  if (resvgWasmReady) return;
  await initWasm(wasmBytes instanceof Uint8Array ? wasmBytes : new Uint8Array(wasmBytes));
  resvgWasmReady = true;
}

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/';

function twemojiCodepoints(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== 'fe0f')
    .join('-');
}

function collectEmoji(props: TicketCardProps): string[] {
  const found = new Set<string>();
  found.add('🎫');
  found.add('🎬');
  if (props.venue) found.add('📍');
  for (const line of props.popcornLines) {
    if (line.includes('🍿')) found.add('🍿');
  }
  return [...found];
}

async function buildGraphemeImages(emoji: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    emoji.map(async (e) => [e, `${TWEMOJI_BASE}${twemojiCodepoints(e)}.svg`] as const)
  );
  return Object.fromEntries(entries);
}

async function toDataUri(baseUrl: string, path: string): Promise<ArrayBuffer> {
  const res = await fetch(new URL(path, baseUrl).toString());
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.arrayBuffer();
}

function row(children: unknown, extra: Record<string, unknown> = {}) {
  return { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', ...extra }, children } };
}

function col(children: unknown, extra: Record<string, unknown> = {}) {
  return { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', ...extra }, children } };
}

function text(content: string, style: Record<string, unknown>) {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: content } };
}

function chip(content: string, style: Record<string, unknown>) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 18px',
        borderRadius: 12,
        ...style,
      },
      children: content,
    },
  };
}

function buildCardTree(props: TicketCardProps, posterDataUri: string | null) {
  const dateWithVenue = [
    text(props.movieDate, { color: '#f1f5f9', fontSize: 30, fontWeight: 700 }),
  ];
  if (props.venue) {
    dateWithVenue.push(text(`📍 ${props.venue}`, { color: '#94a3b8', fontSize: 26, fontWeight: 400, marginTop: 8 }));
  }

  const popcornChildren = props.popcornLines.map((line) =>
    text(line, { color: '#e2e8f0', fontSize: 26, fontWeight: 400, marginBottom: 4 })
  );

  return col(
    [
      // poster + gradient scrim
      {
        type: 'img',
        props: {
          src: posterDataUri ?? undefined,
          width: CARD_WIDTH,
          height: POSTER_HEIGHT,
          style: { position: 'absolute', top: 0, left: 0, objectFit: 'cover' },
        },
      },
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            width: CARD_WIDTH,
            height: POSTER_HEIGHT,
            background:
              'linear-gradient(180deg, rgba(22,27,38,0) 0%, rgba(22,27,38,0.15) 45%, rgba(22,27,38,0.85) 82%, #161b26 100%)',
          },
        },
      },
      // content
      col(
        [
          row(
            [
              chip(`🎫 판매번호 ${props.displayId}`, {
                backgroundColor: 'rgba(0,0,0,0.45)',
                color: '#e2e8f0',
                fontSize: 22,
                fontWeight: 400,
              }),
              chip('🎬', {
                width: 88,
                height: 88,
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                fontSize: 44,
              }),
            ],
            { justifyContent: 'space-between', alignItems: 'flex-start' }
          ),
          text(props.movieTitle, { color: '#ffffff', fontSize: 46, fontWeight: 700, marginTop: 32, marginBottom: 12 }),
          text(`2D · ${props.ageRating || '전체관람가'}`, { color: '#cbd5e1', fontSize: 24, fontWeight: 400, marginBottom: 36 }),
          col(dateWithVenue, { marginBottom: 32 }),
          col(
            [
              ...popcornChildren,
              text(`결제 금액 ${props.priceText}`, { color: '#94a3b8', fontSize: 24, fontWeight: 700, marginTop: 8 }),
            ],
            {
              backgroundColor: 'rgba(255,255,255,0.06)',
              padding: '24px 28px',
              borderRadius: 20,
              marginBottom: 36,
            }
          ),
          row(
            [
              row(
                [
                  text(props.seat, {
                    color: '#ef4444',
                    fontSize: 88,
                    fontWeight: 700,
                    textDecoration: props.statusType === 'canceled' ? 'line-through' : 'none',
                  }),
                  text(`${props.name} 님`, { color: '#94a3b8', fontSize: 26, fontWeight: 400, marginLeft: 16, alignSelf: 'flex-end', marginBottom: 12 }),
                ],
                { alignItems: 'flex-end' }
              ),
              chip(props.badgeText, {
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: props.badgeColor,
                border: `2px solid ${props.badgeColor}`,
                fontSize: 22,
                fontWeight: 700,
              }),
            ],
            { justifyContent: 'space-between', alignItems: 'flex-end' }
          ),
        ],
        { position: 'relative', padding: '36px 44px 52px 44px', flex: 1 }
      ),
    ],
    {
      position: 'relative',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: '#161b26',
      fontFamily: 'Pretendard',
    }
  );
}

export async function renderTicketCardImage(props: TicketCardProps): Promise<Buffer | null> {
  try {
    const result = await Promise.race([
      renderInternal(props),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), RENDER_TIMEOUT_MS)),
    ]);
    return result;
  } catch (err) {
    console.error('renderTicketCardImage failed:', err);
    return null;
  }
}

async function renderInternal(props: TicketCardProps): Promise<Buffer | null> {
  if (!resvgWasmReady) {
    console.error('renderTicketCardImage: resvg wasm not initialized');
    return null;
  }

  let posterDataUri: string | null = null;
  if (props.posterUrl) {
    const posterResult = await fetchSafeImage(props.posterUrl);
    if (posterResult.ok) {
      posterDataUri = `data:${posterResult.contentType};base64,${Buffer.from(posterResult.body).toString('base64')}`;
    }
  }

  const [regularFont, boldFont] = await Promise.all([
    toDataUri(props.baseUrl, '/fonts/Pretendard-Regular.otf'),
    toDataUri(props.baseUrl, '/fonts/Pretendard-Bold.otf'),
  ]);

  const emoji = collectEmoji(props);
  const graphemeImages = await buildGraphemeImages(emoji);

  const tree = buildCardTree(props, posterDataUri);

  const svg = await satori(tree as never, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: 'Pretendard', data: regularFont, weight: 400, style: 'normal' },
      { name: 'Pretendard', data: boldFont, weight: 700, style: 'normal' },
    ],
    graphemeImages,
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}
```

Note: 본문 위젯 스타일에는 `fontWeight`가 400/700 두 값만 쓰인다(원래 HTML 디자인은 600/800도 썼지만, 번들 폰트가 Regular/Bold 두 개뿐이라 satori에 등록 안 된 weight를 요청하면 에러가 날 수 있어 안전하게 두 값으로 매핑함). 스캘럽(절취선) 장식과 box-shadow, `↻` 기호는 이번 v1 합성 이미지에서 생략함(장식 디테일, 카드 핵심 정보와 무관 — HTML 폴백에는 그대로 남아있음).

- [ ] **Step 2: 로컬 검증 스크립트 작성 (커밋 안 함)**

현재 세션의 스크래치패드 경로에 `verify-render.ts` 작성 (예: `/private/tmp/claude-501/.../scratchpad/verify-render.ts` — 실제 실행 시 세션의 스크래치패드 경로 사용):

```ts
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { renderTicketCardImage, ensureResvgWasmInit } from '../../../../../../Users/shinmingyu/Project/movie-ticket/lib/renderTicketCard';

async function main() {
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
  await ensureResvgWasmInit(readFileSync(wasmPath));

  const png = await renderTicketCardImage({
    baseUrl: 'http://localhost:8787',
    posterUrl: 'https://picsum.photos/id/237/400/600',
    movieTitle: '검증용 영화 제목',
    movieDate: '2026년 8월 9일 (일) 00:00 ~ 00:00',
    venue: '테스트 상영관',
    ageRating: '전체관람가',
    seat: 'Z99',
    name: '검증테스트',
    displayId: 'ABCD1234',
    statusType: 'confirmed',
    badgeColor: '#34d399',
    badgeText: '예매 완료',
    priceText: '5,000 원 (결제완료)',
    popcornLines: ['🍿 오리지널 버터 팝콘 2개'],
  });

  if (!png) {
    console.error('FAIL: render returned null');
    process.exit(1);
  }
  writeFileSync('/tmp/verify-render-output.png', png);
  console.log('OK: wrote', png.length, 'bytes to /tmp/verify-render-output.png');
}

main();
```

주의: 이 스크립트는 `baseUrl: 'http://localhost:8787'`로 `/fonts/*.otf`를 fetch하므로, 실행 전에 `npm run preview`로 로컬 wrangler 서버가 떠 있어야 함(정적 에셋 서빙 확인용). import 상대경로는 실제 스크래치패드 절대경로에 맞게 조정.

- [ ] **Step 3: 로컬 wrangler preview 기동 (별도 백그라운드)**

Run: `npm run preview` (백그라운드), `Ready on http://localhost:8787` 로그 나올 때까지 대기.

- [ ] **Step 4: 검증 스크립트 실행**

Run: `npx tsx <스크래치패드 경로>/verify-render.ts`
Expected: `OK: wrote N bytes to /tmp/verify-render-output.png` (N은 수만~수십만 바이트 정도)

- [ ] **Step 5: 출력 PNG가 유효한 이미지인지 확인**

Run: `file /tmp/verify-render-output.png`
Expected: `PNG image data, 760 x 940` (또는 그 근처 치수) — 에러 없이 유효한 PNG로 인식되어야 함

이미지 자체를 Read 툴로 열어서 레이아웃이 대략 의도대로 나오는지(포스터+그라디언트+텍스트) 눈으로 확인.

- [ ] **Step 6: wrangler preview 종료**

Run: `pkill -f "opennextjs-cloudflare preview"; pkill -f "wrangler dev"`

- [ ] **Step 7: 커밋**

```bash
git add lib/renderTicketCard.tsx
git commit -m "feat(mail): satori+resvg-wasm로 티켓 카드 이미지 합성 파이프라인 추가"
```

(검증 스크립트는 스크래치패드에 있으므로 커밋 대상 아님)

---

## Task 3: `app/api/ticket/route.ts` 연동

**Files:**
- Modify: `app/api/ticket/route.ts`

**Interfaces:**
- Consumes: `renderTicketCardImage`, `ensureResvgWasmInit`, `TicketCardProps` from `lib/renderTicketCard.tsx` (Task 2에서 정의)
- Produces: (route 핸들러 — 외부 인터페이스 변경 없음, 요청/응답 스키마 동일)

- [ ] **Step 1: WASM 모듈 import 추가**

`app/api/ticket/route.ts` 상단에 추가:

```ts
import { renderTicketCardImage, ensureResvgWasmInit, type TicketCardProps } from '@/lib/renderTicketCard';
// @ts-expect-error - wasm 모듈은 wrangler/opennext 번들러가 처리함, 타입 선언 없음
import RESVG_WASM_MODULE from '@resvg/resvg-wasm/index_bg.wasm';
```

- [ ] **Step 2: `popcornLines` 배열 계산 추가 (기존 `popcornText` 옆에)**

기존 `popcornText`(문자열, `<br/>`로 join) 계산부 근처에 배열 버전 추가:

```ts
const popcornLines = popcornArray.length > 0
  ? Object.entries(
      popcornArray.reduce((acc: Record<string, number>, p: string) => {
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {})
    ).map(([key, count]) => `🍿 ${popcornNames[key]} ${count}개`)
  : ['음료/팝콘 없음'];
```

- [ ] **Step 3: 이미지 합성 시도 + 성공/실패 분기**

`posterAttachment` 계산 직후, `ticketHTML` 조립 이전에 추가:

```ts
await ensureResvgWasmInit(RESVG_WASM_MODULE as unknown as ArrayBuffer);
const composedCard = await renderTicketCardImage({
  baseUrl,
  posterUrl: posterUrl || null,
  movieTitle,
  movieDate,
  venue,
  ageRating,
  seat,
  name,
  displayId,
  statusType,
  badgeColor,
  badgeText,
  priceText,
  popcornLines,
} satisfies TicketCardProps);
```

- [ ] **Step 4: 이메일 HTML 분기 — 성공 시 카드 마크업을 이미지 한 장으로 교체**

기존 `ticketHTML` 템플릿에서 카드 부분(`<div style="margin: 0 auto; ... background-color:#161b26;"> ... </div>` 전체, 포스터 `<img>`부터 절취선 `<div>`까지)을 다음 조건부로 교체:

```ts
const cardMarkup = composedCard
  ? `<img src="cid:composedCard" alt="${safeMovieTitle}" width="380" style="display:block; width:100%; border-radius:20px; box-shadow: 0 20px 45px rgba(0,0,0,0.55);" />`
  : `<div style="margin: 0 auto; width: 100%; max-width: 380px; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 45px rgba(0,0,0,0.55); text-align: left; background-color:#161b26;">
      <img src="${posterSrc}" alt="${safeMovieTitle}" width="380" style="display:block; width:100%; height:210px; object-fit:cover; object-position:top; background-color:#0b1120;" />
      <div style="padding: 18px 22px 26px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top;">
            <span style="display:inline-block; background-color:rgba(255,255,255,0.08); padding:4px 9px; border-radius:6px; color:#e2e8f0; font-size:11px; font-weight:600; letter-spacing:0.5px; font-variant-numeric: tabular-nums;">🎫 판매번호 ${displayId}</span>
          </td>
          <td style="width:44px; vertical-align:top; text-align:right;">
            <span style="display:inline-block; width:44px; height:44px; background-color:#ffffff; border-radius:10px; text-align:center; line-height:44px; font-size:22px;">🎬</span>
          </td>
        </tr></table>
        <div style="color:#ffffff; font-size:23px; font-weight:800; line-height:1.3; margin-top: 16px; margin-bottom: 6px;">${safeMovieTitle}</div>
        <div style="color:#cbd5e1; font-size:12px; font-weight:600; letter-spacing:0.5px; margin-bottom: 20px;">2D · ${safeAgeRating || '전체관람가'}</div>
        <div style="margin-bottom: 10px;">
          <span style="color:#f1f5f9; font-size:15px; font-weight:700; font-variant-numeric: tabular-nums;">${safeMovieDate}</span>
          <span style="color:#ef4444; font-size:13px; margin-left:6px;">↻</span>
        </div>
        ${venue ? `<div style="color:#94a3b8; font-size:13px; font-weight:600;">📍 ${safeVenue}</div>` : ''}
        <div style="margin: 18px 0; padding: 12px 14px; background-color: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;">
          <div style="color:#e2e8f0; font-size:13px; font-weight:600; margin-bottom: 6px;">${popcornText}</div>
          <div style="color:#94a3b8; font-size:12px; font-weight:600; font-variant-numeric: tabular-nums;">결제 금액 <span style="color:#e2e8f0; font-weight:700;">${priceText}</span></div>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:bottom;">
            <span style="font-size: 44px; font-weight: 800; color: #ef4444; text-decoration: ${statusType === 'canceled' ? 'line-through' : 'none'}; line-height: 1; font-variant-numeric: tabular-nums;">${safeSeat}</span>
            <span style="color:#94a3b8; font-size:13px; font-weight:600; margin-left:8px;">${safeName} 님</span>
          </td>
          <td style="vertical-align:bottom; text-align:right; white-space:nowrap;">
            <span style="display:inline-block; padding: 7px 12px; background-color: rgba(255,255,255,0.06); border-radius: 8px; font-weight: 700; font-size: 12px; color: ${badgeColor}; border: 1px solid ${badgeColor};">
              ${badgeText}
            </span>
          </td>
        </tr></table>
      </div>
      <div style="height:16px; background: radial-gradient(circle at 8px 8px, #0b1120 8px, transparent 8.5px) 0 0 / 16px 16px repeat-x; background-color: #161b26;"></div>
    </div>`;
```

그리고 `ticketHTML` 템플릿 문자열 안에서 카드 부분을 `${cardMarkup}`로 교체.

- [ ] **Step 5: 첨부 목록 구성 — 합성 성공이면 카드 이미지, 실패면 기존 포스터 배너**

기존 `attachments: posterAttachment ? [posterAttachment] : undefined` 부분을:

```ts
const attachments = composedCard
  ? [{ filename: 'ticket.png', content: composedCard, cid: 'composedCard', contentType: 'image/png' }]
  : posterAttachment
  ? [posterAttachment]
  : undefined;

await sendMail({ to: email, subject, html: ticketHTML, attachments });
```

- [ ] **Step 6: 빌드로 타입체크**

Run: `npx next build 2>&1 | tail -30`
Expected: `✓ Compiled successfully`, `Finished TypeScript` — 에러 없음. (`.wasm` import에 대한 타입 에러가 나면 `cloudflare-env.d.ts` 또는 별도 `*.wasm` 모듈 선언 파일에 `declare module '*.wasm' { const value: ArrayBuffer; export default value; }` 추가하고 재시도)

- [ ] **Step 7: 커밋**

```bash
git add app/api/ticket/route.ts
git commit -m "feat(mail): 티켓 메일에 합성 카드 이미지 적용 (실패시 기존 HTML 카드로 폴백)"
```

---

## Task 4: 로컬 통합 검증 (실제 Gmail 발송)

**Files:** 없음 (검증만)

- [ ] **Step 1: 로컬 wrangler preview 기동**

Run: `npm run preview` (백그라운드), `Ready on http://localhost:8787` 대기.

- [ ] **Step 2: curl로 `/api/ticket` 호출 (본인 Gmail로 실제 발송)**

```bash
curl -s -X POST http://localhost:8787/api/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seong381400@gmail.com",
    "name": "합성카드테스트",
    "seat": "Z95",
    "movieTitle": "이미지 합성 카드 검증",
    "movieDate": "2026년 8월 9일 (일) 00:00 ~ 00:00",
    "venue": "테스트 상영관",
    "ageRating": "전체관람가",
    "posterUrl": "https://picsum.photos/id/237/400/600",
    "statusType": "confirmed",
    "popcorn": "original,original,caramel",
    "ticketId": "compose-test-0001",
    "baseUrl": "https://movie-bridge.seong381400.workers.dev"
  }' -w "\nHTTP %{http_code}\n"
```

Expected: `{"success":true}` / `HTTP 200`

- [ ] **Step 3: wrangler preview 종료**

Run: `pkill -f "opennextjs-cloudflare preview"; pkill -f "wrangler dev"`

- [ ] **Step 4: 실제 Gmail 화면에서 스크린샷으로 확인 (PDF 인쇄 금지)**

사용자에게 Gmail 앱/웹에서 해당 메일을 열어 스크린샷으로 확인 요청. 체크할 것:
- 포스터+그라디언트+텍스트가 하나의 선명한 이미지로 뜨는지
- 판매번호/영화아이콘/제목/날짜/장소/팝콘 내역/좌석/배지 전부 읽히는지 (emoji 포함)
- 카드 하단에 잘림/여백 이상 없는지 (있으면 Task 2의 `CARD_HEIGHT` 상수 조정 후 재검증)

- [ ] **Step 5: 문제 있으면 `lib/renderTicketCard.tsx` 수정 → Task 2 Step 3~5 재실행 → 이 태스크 재실행**

(별도 커밋 없음, 확정된 후 한 번에 커밋)

---

## Task 5: 프로덕션 배포 + 최종 확인

**Files:** 없음 (배포만)

- [ ] **Step 1: 배포**

Run: `npm run deploy`
Expected: `Deployed movie-bridge triggers` 로그, `Current Version ID` 출력

- [ ] **Step 2: 프로덕션에서 curl로 재검증**

Task 4 Step 2의 curl 명령에서 URL만 `https://movie-bridge.seong381400.workers.dev/api/ticket`로 바꿔 실행.
Expected: `{"success":true}` / `HTTP 200`

- [ ] **Step 3: 실제 Gmail 화면 스크린샷으로 최종 확인**

Task 4 Step 4와 동일 체크리스트.

- [ ] **Step 4: 남은 조정 있으면 반영 후 재배포, 없으면 완료**

---

## Self-Review Notes

- **Spec coverage:** 스펙의 아키텍처(satori+resvg-wasm, 실패시 폴백), 폰트 same-origin fetch, 8초 타임아웃, `app/api/ticket/route.ts` 한정 범위, Gmail 스크린샷 검증 방식 — 전부 Task 1~5에 반영됨.
- **알려진 단순화(placeholder 아님, 의도된 스코프 결정):** 합성 이미지 안에서 절취선(scallop) 장식, box-shadow, `↻` 기호는 생략(HTML 폴백에는 그대로 있음). font-weight는 400/700 두 값으로 통일(번들 폰트가 두 웨이트뿐이라).
- **리스크:** `.wasm` import가 OpenNext/Next.js API route 번들링 경로에서 그대로 통과할지는 Task 3 Step 6(빌드)과 Task 4(실제 배포)에서 처음 실증됨 — 안 되면 Task 3에서 `cloudflare-env.d.ts`에 모듈 선언 추가하는 대안을 이미 적어둠. CARD_HEIGHT 940은 첫 추정치이며 Task 4 스크린샷으로 보정.
