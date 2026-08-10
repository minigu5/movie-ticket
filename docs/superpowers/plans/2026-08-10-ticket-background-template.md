# 티켓 카드 배경 템플릿 사전 렌더링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이메일 티켓 카드의 "outer 블러 배경" 효과를 Cloudflare Workers CPU 예산 안에서 안정적으로 동작하게 만든다 — 무거운 이미지 합성(블러 배경+로고+카드프레임+절취선)을 관리자 브라우저에서 미리 PNG로 구워두고, 발송 시점엔 satori가 텍스트만 그 위에 얹는다.

**Architecture:** 관리자 페이지에 "배경 생성" 버튼을 추가한다. 클릭하면 브라우저 Canvas API로 포스터를 블러 처리한 배경 + 로고 + 카드 프레임(라운드코너/그림자/원본 포스터) + 절취선을 984×1466 PNG 하나로 합성하고, Cloudinary에 업로드해서 URL을 `movie_settings.background_template_url`에 저장한다. 이메일 발송 시(`app/api/ticket/route.ts`)는 이 URL을 클라이언트가 함께 넘겨주면 다운로드해서 `renderTicketCardImage`에 넘기고, satori는 그 PNG를 배경으로 깐 채 텍스트(판매번호/제목/날짜/좌석/가격/배지)만 절대좌표로 오버레이한다. 템플릿이 없거나 다운로드 실패 시 지금의 안정 버전(outer 없는 카드, HTML의 로고/라운드코너/절취선)으로 조용히 폴백한다.

**Tech Stack:** Next.js (Cloudflare Workers/OpenNext), `next/og`(satori/resvg-wasm), Canvas 2D API, Supabase, Cloudinary.

## Global Constraints

- 이 프로젝트엔 테스트 프레임워크가 없다(TDD 불가) — 각 태스크는 `npx tsc --noEmit` 타입체크 + 실제 동작 확인(admin 페이지 수동 조작, `wrangler tail` + curl)으로 검증한다.
- 로컬 `wrangler preview`는 Cloudflare Workers CPU 시간 제한을 강제하지 않는다 — 이미지 합성이 관련된 변경은 반드시 실제 프로덕션 배포 후 `wrangler tail`로 검증한다.
- 카드 프레임 좌표 상수(`CARD_WIDTH=700`, `CARD_HEIGHT=960`, `SIDE_MARGIN=140`, `TOP_MARGIN=90`, `LOGO_BLOCK_HEIGHT=170`, `OUTER_WIDTH=984`, `OUTER_HEIGHT=1466`, `SCALLOP_COUNT=13`)은 canvas 쪽과 satori 쪽에서 정확히 일치해야 한다 — 하나라도 어긋나면 텍스트가 카드 프레임 밖으로 삐져나온다.
- Cloudinary 자격증명은 이미 `wrangler secret`(프로덕션)과 `.env.local`(로컬)에 등록되어 있다: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- 배포(`npm run deploy`) 직후 바로 curl로 검증하면 Cloudflare 엣지 전파 지연으로 구버전이 응답할 수 있다 — 배포 후 최소 15~20초 대기하고 검증할 것.

---

### Task 1: DB 마이그레이션 — `background_template_url` 컬럼 추가

**Files:**
- Create: `supabase/migrations/0008_ticket_background_template.sql`

**Interfaces:**
- Produces: `movie_settings.background_template_url` (text, nullable) — Task 3(action route)과 Task 7(발송 route)이 이 컬럼을 읽고 쓴다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- supabase/migrations/0008_ticket_background_template.sql
-- 관리자가 브라우저에서 미리 합성한 티켓 카드 배경(블러+로고+카드프레임+절취선,
-- 텍스트 없음) PNG의 Cloudinary URL을 저장한다. 이메일 발송 시 이 URL이 있으면
-- satori가 여기 텍스트만 오버레이하고, 없으면 outer 없는 기존 카드로 폴백한다.
alter table public.movie_settings
  add column if not exists background_template_url text;
```

- [ ] **Step 2: 원격 DB에 적용**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx supabase db push`

Expected: `0008_ticket_background_template` 마이그레이션이 적용됐다는 출력. 실패하면 (풀러 인증 타임아웃 등) 몇 초 후 재시도.

- [ ] **Step 3: 컬럼이 실제로 생겼는지 확인**

Run:
```bash
cd /Users/shinmingyu/Project/movie-ticket
set -a && source .env.local && set +a
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/movie_settings?select=id,background_template_url&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

Expected: `[{"id":6,"background_template_url":null}]` 형태 (에러 없이 컬럼이 조회됨).

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0008_ticket_background_template.sql
git commit -m "$(cat <<'EOF'
feat(db): movie_settings에 background_template_url 컬럼 추가

관리자가 미리 합성한 티켓 카드 배경 PNG URL을 저장하기 위한 컬럼.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `lib/cloudinary.ts` — 단순 업로드 함수로 교체

**Files:**
- Modify: `lib/cloudinary.ts` (전체 교체 — 기존 `getBlurredPosterUrl`은 더 이상 안 씀. blur는 이제 브라우저에서 처리하므로 Cloudinary는 그냥 완성된 PNG를 저장만 한다)

**Interfaces:**
- Produces: `uploadTicketBackground(dataUri: string): Promise<string | null>` — Task 3(action route)이 이 함수를 호출한다. `dataUri`는 `data:image/png;base64,...` 형식.

- [ ] **Step 1: 파일 전체 교체**

```typescript
// lib/cloudinary.ts
const UPLOAD_TIMEOUT_MS = 8_000;

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Uploads an already-fully-composed PNG (data URI) to Cloudinary and returns
 * its public URL. No transformation is requested — the image (blur, logo,
 * card frame, perforation) is already baked in by the admin's browser via
 * lib/ticketBackgroundCanvas.ts, so this is just storage.
 */
export async function uploadTicketBackground(dataUri: string): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `timestamp=${timestamp}`;
    const signature = await sha1Hex(paramsToSign + apiSecret);

    const body = new URLSearchParams({
      file: dataUri,
      api_key: apiKey,
      timestamp: String(timestamp),
      signature,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;

    const json = (await res.json()) as { secure_url?: string };
    return json.secure_url ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음 (이 시점엔 `app/api/admin/action/route.ts`가 아직 옛 `getBlurredPosterUrl`을 안 쓰고 있으므로 통과해야 함 — 만약 다른 파일이 옛 함수를 참조 중이면 여기서 에러가 뜨니 확인).

- [ ] **Step 3: 커밋**

```bash
git add lib/cloudinary.ts
git commit -m "$(cat <<'EOF'
refactor(cloudinary): blur-transform 업로드를 단순 업로드로 교체

이제 blur는 관리자 브라우저 canvas에서 미리 처리되므로 Cloudinary는
완성된 PNG를 그냥 저장만 하면 됨.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `app/api/admin/action/route.ts` — `UPLOAD_TICKET_BACKGROUND` 액션 추가

**Files:**
- Modify: `app/api/admin/action/route.ts:1-6` (import 추가), 그리고 `switch (action) {` 블록 안에 새 `case` 추가

**Interfaces:**
- Consumes: `uploadTicketBackground(dataUri: string): Promise<string | null>` (Task 2)
- Produces: POST `/api/admin/action` with `{ action: 'UPLOAD_TICKET_BACKGROUND', payload: { movieId: number, imageBase64: string } }` → `{ success: true, url: string }` 또는 `{ success: false, error: string }`. Task 5(admin UI)가 이 액션을 호출한다.

- [ ] **Step 1: import 추가**

`app/api/admin/action/route.ts` 최상단 import 블록을 다음으로 교체:

```typescript
// app/api/admin/action/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api-auth';
import { uploadTicketBackground } from '@/lib/cloudinary';
```

- [ ] **Step 2: 새 case 추가**

`case 'UPDATE_SETTINGS':` 블록 바로 다음에 새 case를 삽입한다 (기존 `UPDATE_SETTINGS` 블록은 그대로 두고, 그 뒤에 붙인다):

```typescript
      case 'UPLOAD_TICKET_BACKGROUND': {
        const { movieId, imageBase64 } = payload;
        if (!movieId || typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
          return NextResponse.json({ success: false, error: 'movieId와 이미지 데이터가 필요합니다.' }, { status: 400 });
        }

        const url = await uploadTicketBackground(imageBase64);
        if (!url) {
          return NextResponse.json({ success: false, error: 'Cloudinary 업로드에 실패했습니다.' }, { status: 502 });
        }

        const { error } = await supabaseAdmin
          .from('movie_settings')
          .update({ background_template_url: url })
          .eq('id', movieId);
        if (error) throw error;

        return NextResponse.json({ success: true, url });
      }
```

- [ ] **Step 3: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 로컬에서 직접 호출 테스트 (dev 서버)**

Run:
```bash
cd /Users/shinmingyu/Project/movie-ticket
npm run dev &
sleep 3
```

관리자 로그인 세션이 없으면 401이 나는 게 정상이다 — 여기서는 "핸들러가 존재하고 400/401을 정상적으로 반환하는지"만 확인한다:

```bash
curl -s -X POST http://localhost:3000/api/admin/action \
  -H "Content-Type: application/json" \
  -d '{"action":"UPLOAD_TICKET_BACKGROUND","payload":{}}'
```

Expected: `{"success":false,"error":"로그인이 필요합니다."}` (401) — `requireAdmin`이 먼저 걸림. "Unknown action" 에러가 아니라는 것만 확인하면 이 스텝은 통과.

Run: `pkill -f "next dev"` 로 dev 서버 종료.

- [ ] **Step 5: 커밋**

```bash
git add app/api/admin/action/route.ts
git commit -m "$(cat <<'EOF'
feat(admin): 티켓 배경 템플릿 업로드 액션 추가

관리자 브라우저에서 만든 배경 PNG를 받아 Cloudinary에 저장하고
movie_settings.background_template_url을 갱신.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `lib/ticketBackgroundCanvas.ts` — Canvas 렌더링 로직 (신규)

**Files:**
- Create: `lib/ticketBackgroundCanvas.ts`

**Interfaces:**
- Consumes: 없음 (순수 브라우저 API만 사용)
- Produces:
  - `renderTicketBackground(posterUrl: string): Promise<Blob>` — Task 5(admin UI)가 호출
  - `blobToDataUri(blob: Blob): Promise<string>` — Task 5가 호출

이 파일의 레이아웃 상수는 `lib/renderTicketCard.tsx`(Task 6)와 반드시 일치해야 한다: `CARD_WIDTH=700, CARD_HEIGHT=960, SIDE_MARGIN=140, TOP_MARGIN=90, LOGO_BLOCK_HEIGHT=170, BOTTOM_MARGIN=90, OUTER_WIDTH=984, OUTER_HEIGHT=1466, SCALLOP_COUNT=13`.

- [ ] **Step 1: 파일 작성**

```typescript
// lib/ticketBackgroundCanvas.ts
// 관리자 브라우저에서 티켓 카드의 "outer 배경"(블러 확산 배경 + 로고 + 카드
// 프레임 + 절취선, 텍스트는 없음)을 미리 PNG로 합성한다. 이 무거운 합성을
// 이메일 발송 시점(Cloudflare Workers, CPU 예산 있음)이 아니라 관리자가 포스터를
// 등록할 때 브라우저(CPU 무제한)에서 한 번만 처리해서, 발송 시엔 이 PNG 위에
// satori가 텍스트만 얹으면 되게 한다. 레이아웃 상수는 lib/renderTicketCard.tsx의
// 텍스트 오버레이 좌표와 반드시 일치해야 한다.

const CARD_WIDTH = 700;
const CARD_HEIGHT = 960;
const SIDE_MARGIN = 140;
const TOP_MARGIN = 90;
const LOGO_BLOCK_HEIGHT = 170;
const BOTTOM_MARGIN = 90;
const OUTER_WIDTH = CARD_WIDTH + SIDE_MARGIN * 2;
const OUTER_HEIGHT = TOP_MARGIN + LOGO_BLOCK_HEIGHT + CARD_HEIGHT + BOTTOM_MARGIN;
const SCALLOP_COUNT = 13;
const CARD_RADIUS = 28;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
    img.src = src;
  });
}

async function ensureSongMyungFont(): Promise<void> {
  if (!document.getElementById('song-myung-font-link')) {
    const link = document.createElement('link');
    link.id = 'song-myung-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Song+Myung&display=swap';
    document.head.appendChild(link);
  }
  await document.fonts.load('700 34px "Song Myung"');
  await document.fonts.ready;
}

function drawRoundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** object-fit: cover를 흉내 낸다 — 이미지 종횡비를 유지한 채 대상 영역을 꽉 채운다. */
function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (imgRatio > targetRatio) {
    sw = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawEdgeGradients(ctx: CanvasRenderingContext2D): void {
  const topH = TOP_MARGIN + LOGO_BLOCK_HEIGHT * 0.6;
  const top = ctx.createLinearGradient(0, 0, 0, topH);
  top.addColorStop(0, '#0b1120');
  top.addColorStop(1, 'rgba(11,17,32,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, OUTER_WIDTH, topH);

  const bottomH = BOTTOM_MARGIN + 60;
  const bottom = ctx.createLinearGradient(0, OUTER_HEIGHT - bottomH, 0, OUTER_HEIGHT);
  bottom.addColorStop(0, 'rgba(11,17,32,0)');
  bottom.addColorStop(1, '#0b1120');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, OUTER_HEIGHT - bottomH, OUTER_WIDTH, bottomH);

  const sideW = SIDE_MARGIN + 60;
  const left = ctx.createLinearGradient(0, 0, sideW, 0);
  left.addColorStop(0, '#0b1120');
  left.addColorStop(1, 'rgba(11,17,32,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, sideW, OUTER_HEIGHT);

  const right = ctx.createLinearGradient(OUTER_WIDTH - sideW, 0, OUTER_WIDTH, 0);
  right.addColorStop(0, 'rgba(11,17,32,0)');
  right.addColorStop(1, '#0b1120');
  ctx.fillStyle = right;
  ctx.fillRect(OUTER_WIDTH - sideW, 0, sideW, OUTER_HEIGHT);
}

function drawLogo(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.font = '700 34px "Song Myung"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f1f5f9';
  ctx.shadowColor = 'rgba(255,255,255,0.25)';
  ctx.shadowBlur = 18;
  const cx = OUTER_WIDTH / 2;
  const cy = TOP_MARGIN + LOGO_BLOCK_HEIGHT / 2;
  ctx.fillText('영화', cx, cy - 24);
  ctx.fillText('대교', cx, cy + 24);
  ctx.restore();
}

function drawCardFrame(ctx: CanvasRenderingContext2D, poster: HTMLImageElement, cardLeft: number, cardTop: number): void {
  // 그림자는 클리핑 전에 별도로 그린다 (클립 안에서는 shadow가 카드 내부에 안 보임).
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#161b26';
  drawRoundedRectPath(ctx, cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRectPath(ctx, cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.clip();

  ctx.fillStyle = '#161b26';
  ctx.fillRect(cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT);
  drawImageCover(ctx, poster, cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT);

  const grad = ctx.createLinearGradient(0, cardTop, 0, cardTop + CARD_HEIGHT);
  grad.addColorStop(0, 'rgba(22,27,38,0)');
  grad.addColorStop(0.3, 'rgba(22,27,38,0.05)');
  grad.addColorStop(0.5, 'rgba(22,27,38,0.35)');
  grad.addColorStop(0.68, 'rgba(22,27,38,0.72)');
  grad.addColorStop(0.85, 'rgba(22,27,38,0.9)');
  grad.addColorStop(1, 'rgba(22,27,38,0.97)');
  ctx.fillStyle = grad;
  ctx.fillRect(cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT);

  ctx.restore();
}

function drawScallops(ctx: CanvasRenderingContext2D, cardLeft: number, cardTop: number): void {
  const radius = 14;
  const padding = 16;
  const areaWidth = CARD_WIDTH - padding * 2;
  const gap = SCALLOP_COUNT > 1 ? areaWidth / (SCALLOP_COUNT - 1) : 0;
  const cy = cardTop + CARD_HEIGHT;

  for (let i = 0; i < SCALLOP_COUNT; i++) {
    const cx = cardLeft + padding + gap * i;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#161b26';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * posterUrl(원본 포스터 주소)로부터 텍스트 없는 티켓 카드 배경 PNG(984×1466)를
 * 만들어 Blob으로 반환한다. same-origin 프록시(/api/poster-image)를 거치므로
 * CORS로 canvas가 오염되지 않는다.
 */
export async function renderTicketBackground(posterUrl: string): Promise<Blob> {
  await ensureSongMyungFont();
  const poster = await loadImage(`/api/poster-image?src=${encodeURIComponent(posterUrl)}`);

  const canvas = document.createElement('canvas');
  canvas.width = OUTER_WIDTH;
  canvas.height = OUTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context를 가져올 수 없습니다.');

  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, OUTER_WIDTH, OUTER_HEIGHT);

  ctx.save();
  ctx.filter = 'blur(70px) brightness(0.7) saturate(1.6)';
  drawImageCover(ctx, poster, -80, -80, OUTER_WIDTH + 160, OUTER_HEIGHT + 160);
  ctx.restore();

  ctx.fillStyle = 'rgba(11,17,32,0.15)';
  ctx.fillRect(0, 0, OUTER_WIDTH, OUTER_HEIGHT);

  drawEdgeGradients(ctx);
  drawLogo(ctx);

  const cardLeft = SIDE_MARGIN;
  const cardTop = TOP_MARGIN + LOGO_BLOCK_HEIGHT;
  drawCardFrame(ctx, poster, cardLeft, cardTop);
  drawScallops(ctx, cardLeft, cardTop);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('PNG 생성에 실패했습니다.'));
      else resolve(blob);
    }, 'image/png');
  });
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지 인코딩에 실패했습니다.'));
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 2: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add lib/ticketBackgroundCanvas.ts
git commit -m "$(cat <<'EOF'
feat(admin): 티켓 배경 canvas 렌더링 유틸 추가

블러 배경+로고+카드프레임+절취선을 브라우저 canvas로 합성. CPU 제한
있는 Workers 대신 관리자 브라우저에서 처리해서 CPU 예산 문제 우회.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `app/admin/page.tsx` — "배경 생성" 버튼 + 핸들러

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `renderTicketBackground(posterUrl: string): Promise<Blob>`, `blobToDataUri(blob: Blob): Promise<string>` (Task 4); action `UPLOAD_TICKET_BACKGROUND` (Task 3)

- [ ] **Step 1: import 추가**

`app/admin/page.tsx` 상단 import 블록(5번째 줄 근처)에 추가:

```typescript
import { renderTicketBackground, blobToDataUri } from '../../lib/ticketBackgroundCanvas';
```

- [ ] **Step 2: 상태 추가**

`const [editForm, setEditForm] = useState<any>({});` 바로 다음 줄에 추가:

```typescript
  const [bgGenerating, setBgGenerating] = useState(false);
  const [bgStatus, setBgStatus] = useState<string | null>(null);
```

- [ ] **Step 3: 핸들러 함수 추가**

`handleSaveSettingsClick` 함수 바로 위에 추가:

```typescript
  const handleGenerateTicketBackground = async () => {
    if (!editForm.poster_url) { alert('포스터 주소를 먼저 입력하세요.'); return; }
    if (!editForm.id) { alert('영화 정보를 먼저 불러와야 합니다.'); return; }

    setBgGenerating(true);
    setBgStatus(null);
    try {
      const blob = await renderTicketBackground(editForm.poster_url);
      const dataUri = await blobToDataUri(blob);
      const res = await authFetch('/api/admin/action', {
        action: 'UPLOAD_TICKET_BACKGROUND',
        payload: { movieId: editForm.id, imageBase64: dataUri },
      });
      const data = await res.json();
      if (!data.success) {
        setBgStatus(`실패: ${data.error}`);
      } else {
        setEditForm((prev: any) => ({ ...prev, background_template_url: data.url }));
        setMovieInfo((prev: any) => ({ ...prev, background_template_url: data.url }));
        setBgStatus('생성 완료');
      }
    } catch (err: any) {
      setBgStatus(`실패: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setBgGenerating(false);
    }
  };
```

- [ ] **Step 4: UI 추가**

"포스터 주소" input 블록을 찾는다 (`<div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">포스터 주소</label>...`, 편집 폼 쪽 — 617번째 줄 근처, `editForm.poster_url`을 쓰는 쪽). 그 `</div>` 바로 뒤에 추가:

```jsx
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerateTicketBackground}
              disabled={bgGenerating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-bold"
            >
              {bgGenerating ? '배경 생성 중...' : '티켓 배경 생성'}
            </button>
            {bgStatus && <span className="text-sm text-gray-400">{bgStatus}</span>}
            {editForm.background_template_url && (
              <span className="text-xs text-green-400">배경 템플릿 있음 — 포스터를 바꿨으면 다시 생성하세요.</span>
            )}
          </div>
```

- [ ] **Step 5: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 실제 동작 확인 (로컬 dev 서버)**

Run:
```bash
cd /Users/shinmingyu/Project/movie-ticket
npm run dev &
sleep 3
```

브라우저로 `http://localhost:3000/admin` 접속해서 관리자 로그인 후:
1. "설정 수정" 모드 진입, 포스터 주소가 `https://img.movist.com/?img=/x00/00/01/08_p1.jpg`인지 확인.
2. "티켓 배경 생성" 버튼 클릭.
3. 몇 초 후 "생성 완료" 텍스트와 "배경 템플릿 있음" 안내가 뜨는지 확인.
4. Supabase에서 `background_template_url`이 실제로 채워졌는지 확인:

```bash
cd /Users/shinmingyu/Project/movie-ticket
set -a && source .env.local && set +a
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/movie_settings?select=id,background_template_url&id=eq.6" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

Expected: `background_template_url`이 `https://res.cloudinary.com/...` 형태로 채워짐. 그 URL을 브라우저에서 직접 열어서 블러 배경+로고+카드프레임+절취선이 있고 텍스트가 없는 984×1466 이미지인지 육안 확인.

Run: `pkill -f "next dev"` 로 dev 서버 종료.

- [ ] **Step 7: 커밋**

```bash
git add app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): 티켓 배경 생성 버튼 추가

포스터 주소 입력란 옆에 버튼 추가 — 클릭하면 canvas로 배경 합성 후
Cloudinary 업로드하고 movie_settings에 URL 저장.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `lib/renderTicketCard.tsx` — `templateImage` 지원 (텍스트만 오버레이)

**Files:**
- Modify: `lib/renderTicketCard.tsx` (전체 재작성)

**Interfaces:**
- Consumes: 없음 (satori/`next/og`만 사용)
- Produces: `TicketCardProps`에 `templateImage: { body: Uint8Array; contentType: string } | null` 필드 추가. `renderTicketCardImage(props: TicketCardProps): Promise<Buffer | null>`는 그대로. Task 7(발송 route)이 이 prop을 채워서 호출한다.

레이아웃 상수는 Task 4의 `lib/ticketBackgroundCanvas.ts`와 정확히 일치해야 한다.

- [ ] **Step 1: 파일 전체 교체**

```tsx
import { ImageResponse } from 'next/og';

export interface TicketCardProps {
  baseUrl: string;
  posterImage: { body: Uint8Array; contentType: string } | null;
  /** 관리자가 미리 합성해둔 배경(블러+로고+카드프레임+절취선, 텍스트 없음, 984x1466). 있으면 이 위에 텍스트만 얹는다. */
  templateImage: { body: Uint8Array; contentType: string } | null;
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

const CARD_WIDTH = 700;
const CARD_HEIGHT = 960;
const POSTER_HEIGHT = CARD_HEIGHT;
const SIDE_MARGIN = 140;
const TOP_MARGIN = 90;
const LOGO_BLOCK_HEIGHT = 170;
const BOTTOM_MARGIN = 90;
const OUTER_WIDTH = CARD_WIDTH + SIDE_MARGIN * 2;
const OUTER_HEIGHT = TOP_MARGIN + LOGO_BLOCK_HEIGHT + CARD_HEIGHT + BOTTOM_MARGIN;
const CARD_TOP = TOP_MARGIN + LOGO_BLOCK_HEIGHT;
const RENDER_TIMEOUT_MS = 8_000;

function dataUri(image: { body: Uint8Array; contentType: string } | null): string | null {
  return image ? `data:${image.contentType};base64,${Buffer.from(image.body).toString('base64')}` : null;
}

async function toArrayBuffer(baseUrl: string, path: string): Promise<ArrayBuffer> {
  const res = await fetch(new URL(path, baseUrl).toString());
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.arrayBuffer();
}

export async function renderTicketCardImage(props: TicketCardProps): Promise<Buffer | null> {
  try {
    return await Promise.race([
      renderInternal(props),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), RENDER_TIMEOUT_MS)),
    ]);
  } catch (err) {
    console.error('renderTicketCardImage failed:', err);
    return null;
  }
}

async function renderInternal(props: TicketCardProps): Promise<Buffer | null> {
  const posterDataUri = dataUri(props.posterImage);
  const templateDataUri = dataUri(props.templateImage);

  const [regularFont, boldFont] = await Promise.all([
    toArrayBuffer(props.baseUrl, '/fonts/Pretendard-Regular.otf'),
    toArrayBuffer(props.baseUrl, '/fonts/Pretendard-Bold.otf'),
  ]);

  const cardContent = (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', padding: '44px 44px 50px 44px', flex: 1, width: CARD_WIDTH, height: CARD_HEIGHT }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          alignSelf: 'flex-start',
          padding: '8px 18px',
          borderRadius: 12,
          backgroundColor: 'rgba(0,0,0,0.45)',
          color: '#e2e8f0',
          fontSize: 22,
        }}
      >
        {`판매번호 ${props.displayId}`}
      </div>

      <div style={{ display: 'flex', color: '#ffffff', fontSize: 46, fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.6)', marginTop: 220, marginBottom: 12 }}>
        {props.movieTitle}
      </div>
      <div style={{ display: 'flex', color: '#cbd5e1', fontSize: 24, textShadow: '0 2px 8px rgba(0,0,0,0.6)', marginBottom: 36 }}>
        {`2D · ${props.ageRating || '전체관람가'}`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 32 }}>
        <div style={{ display: 'flex', color: '#f1f5f9', fontSize: 30, fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>{props.movieDate}</div>
        {props.venue && (
          <div style={{ display: 'flex', color: '#e2e8f0', fontSize: 26, textShadow: '0 2px 8px rgba(0,0,0,0.6)', marginTop: 8 }}>{`${props.venue}`}</div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(0,0,0,0.42)',
          padding: '24px 28px',
          borderRadius: 20,
          marginBottom: 36,
        }}
      >
        {props.popcornLines.map((line, i) => (
          <div key={i} style={{ display: 'flex', color: '#e2e8f0', fontSize: 26, marginBottom: 4 }}>
            {line}
          </div>
        ))}
        <div style={{ display: 'flex', color: '#94a3b8', fontSize: 24, fontWeight: 700, marginTop: 8 }}>
          {`결제 금액 ${props.priceText}`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end' }}>
          <div
            style={{
              display: 'flex',
              color: '#ef4444',
              fontSize: 88,
              fontWeight: 700,
              textDecoration: props.statusType === 'canceled' ? 'line-through' : 'none',
            }}
          >
            {props.seat}
          </div>
          <div style={{ display: 'flex', color: '#e2e8f0', fontSize: 26, textShadow: '0 2px 6px rgba(0,0,0,0.6)', marginLeft: 16, marginBottom: 12 }}>
            {`${props.name} 님`}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            padding: '8px 18px',
            borderRadius: 12,
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: props.badgeColor,
            border: `2px solid ${props.badgeColor}`,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {props.badgeText}
        </div>
      </div>
    </div>
  );

  const fonts = [
    { name: 'Pretendard', data: regularFont, weight: 400 as const, style: 'normal' as const },
    { name: 'Pretendard', data: boldFont, weight: 700 as const, style: 'normal' as const },
  ];

  if (templateDataUri) {
    const response = new ImageResponse(
      (
        <div style={{ display: 'flex', position: 'relative', width: OUTER_WIDTH, height: OUTER_HEIGHT, fontFamily: 'Pretendard' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={templateDataUri} width={OUTER_WIDTH} height={OUTER_HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }} />
          <div style={{ display: 'flex', position: 'absolute', top: CARD_TOP, left: SIDE_MARGIN, width: CARD_WIDTH, height: CARD_HEIGHT }}>
            {cardContent}
          </div>
        </div>
      ),
      { width: OUTER_WIDTH, height: OUTER_HEIGHT, fonts }
    );
    const buf = await response.arrayBuffer();
    return Buffer.from(buf);
  }

  const response = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          backgroundColor: '#161b26',
          fontFamily: 'Pretendard',
        }}
      >
        {posterDataUri && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterDataUri}
            width={CARD_WIDTH}
            height={POSTER_HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
          />
        )}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            width: CARD_WIDTH,
            height: POSTER_HEIGHT,
            background:
              'linear-gradient(180deg, rgba(22,27,38,0) 0%, rgba(22,27,38,0.05) 30%, rgba(22,27,38,0.35) 50%, rgba(22,27,38,0.72) 68%, rgba(22,27,38,0.9) 85%, rgba(22,27,38,0.97) 100%)',
          }}
        />
        {cardContent}
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
  );

  const buf = await response.arrayBuffer();
  return Buffer.from(buf);
}
```

- [ ] **Step 2: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 여기서는 `app/api/ticket/route.ts`가 아직 `templateImage` 없이 `renderTicketCardImage`를 호출하고 있어서 `satisfies TicketCardProps` 부분에 타입 에러가 날 것 — 이건 정상. Task 7에서 고친다. (이 스텝은 `renderTicketCard.tsx` 자체 문법 에러만 없으면 통과로 간주.)

- [ ] **Step 3: 커밋**

```bash
git add lib/renderTicketCard.tsx
git commit -m "$(cat <<'EOF'
feat(mail): 티켓 카드에 사전 렌더링된 배경 템플릿 오버레이 지원 추가

templateImage가 있으면 satori는 텍스트만 얹는다(이미지 디코딩 1장).
없으면 기존 안정 버전(outer 없는 카드) 그대로 폴백.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `app/api/ticket/route.ts` — `backgroundTemplateUrl` 파라미터 처리

**Files:**
- Modify: `app/api/ticket/route.ts`

**Interfaces:**
- Consumes: `TicketCardProps.templateImage` (Task 6)
- Produces: POST `/api/ticket` body에 선택적 `backgroundTemplateUrl?: string` 필드 추가. Task 8(`app/page.tsx`)이 이 필드를 채워 보낸다.

- [ ] **Step 1: 요청 파싱에 `backgroundTemplateUrl` 추가**

```typescript
    const { email, name, seat, movieTitle, movieDate, venue, ageRating, posterUrl, backgroundTemplateUrl, statusType, popcorn, ticketId, baseUrl, isRefundNeeded } = await req.json();
```

- [ ] **Step 2: 템플릿 이미지 다운로드 로직 추가**

`const posterImage = posterUrl ? await fetchSafeImage(posterUrl) : null;` 바로 다음 줄에 추가:

```typescript
    const templateImage = backgroundTemplateUrl ? await fetchSafeImage(backgroundTemplateUrl) : null;
```

- [ ] **Step 3: `renderTicketCardImage` 호출에 `templateImage` 전달**

`renderTicketCardImage({ baseUrl, posterImage: ..., movieTitle, ...` 호출부에서 `posterImage:` 라인 바로 다음 줄에 추가:

```typescript
      templateImage: templateImage?.ok ? { body: templateImage.body, contentType: templateImage.contentType } : null,
```

- [ ] **Step 4: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음 (Task 6에서 남았던 `TicketCardProps` 불일치가 여기서 해소됨).

- [ ] **Step 5: 커밋**

```bash
git add app/api/ticket/route.ts
git commit -m "$(cat <<'EOF'
feat(mail): 발송 시 배경 템플릿 URL 받아서 카드 합성에 전달

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `app/page.tsx` — 발송 호출 5곳에 `backgroundTemplateUrl` 추가

**Files:**
- Modify: `app/page.tsx:432, 490, 516, 554, 670` (다섯 곳의 `/api/ticket` fetch 호출)

**Interfaces:**
- Consumes: `movie_settings.background_template_url` (via `movieInfo` state, `select('*')`로 이미 포함됨)

- [ ] **Step 1: 각 호출부에 필드 추가**

`app/page.tsx`에서 `posterUrl: movieInfo.poster_url` 문자열이 나오는 5곳 전부(429번째 줄 근처, 490번째 줄, 516번째 줄, 554번째 줄 근처, 670번째 줄 근처)를 찾아서, 그 바로 뒤에 `backgroundTemplateUrl: (movieInfo as any).background_template_url,`를 추가한다. 예를 들어 490번째 줄은:

변경 전:
```typescript
              fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: profile.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, venue: movieInfo.venue, ageRating: movieInfo.age_rating, posterUrl: movieInfo.poster_url, statusType: 'changed', popcorn: finalPopcornString, ticketId: updatedTicket.id, baseUrl }) });
```

변경 후:
```typescript
              fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: profile.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, venue: movieInfo.venue, ageRating: movieInfo.age_rating, posterUrl: movieInfo.poster_url, backgroundTemplateUrl: (movieInfo as any).background_template_url, statusType: 'changed', popcorn: finalPopcornString, ticketId: updatedTicket.id, baseUrl }) });
```

나머지 4곳(432, 516, 554, 670번째 줄 근처)도 동일하게 `posterUrl: movieInfo.poster_url,` 바로 뒤에 `backgroundTemplateUrl: (movieInfo as any).background_template_url,`를 삽입한다. `(movieInfo as any)` 캐스팅은 이 파일에서 `movieInfo.id`에 이미 쓰이고 있는 기존 패턴을 따른 것 — `useState`의 초기값 객체 타입에 `background_template_url` 필드가 없기 때문.

- [ ] **Step 2: 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 5곳 모두 반영됐는지 확인**

Run: `grep -n "backgroundTemplateUrl" app/page.tsx`
Expected: 5줄이 출력됨 (432, 490, 516, 554, 670번째 줄 근처 각각 하나씩).

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(mail): 발송 요청에 배경 템플릿 URL 포함

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 최종 검증 — 프로덕션 배포 + CPU 예산 재실측

**Files:** 없음 (배포 + 수동 검증만)

**Interfaces:** 없음 (통합 테스트)

- [ ] **Step 1: 전체 타입체크**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 2: 프로덕션 배포**

Run: `cd /Users/shinmingyu/Project/movie-ticket && npm run deploy 2>&1 | tail -15`
Expected: `Deployed movie-bridge triggers` 로그와 배포 URL 출력.

- [ ] **Step 3: 배포 전파 대기**

Run: `sleep 20`

- [ ] **Step 4: 관리자 페이지에서 실제로 배경 생성 (프로덕션)**

`https://movie-bridge.seong381400.workers.dev/admin`에 접속해서 관리자 로그인 후, 포스터 주소가 `https://img.movist.com/?img=/x00/00/01/08_p1.jpg`인 상태에서 "티켓 배경 생성" 버튼을 클릭한다.

Expected: "생성 완료" 표시. Supabase에서 확인:

```bash
cd /Users/shinmingyu/Project/movie-ticket
set -a && source .env.local && set +a
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/movie_settings?select=id,background_template_url&is_active=eq.true" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

Expected: `background_template_url`이 Cloudinary URL로 채워짐.

- [ ] **Step 5: `wrangler tail` 연결**

Run (백그라운드):
```bash
cd /Users/shinmingyu/Project/movie-ticket
nohup npx wrangler tail movie-bridge --format pretty > /tmp/ticket-bg-tail.log 2>&1 &
disown
sleep 6
```

- [ ] **Step 6: 실제 발송 반복 테스트 (최소 5회)**

Run:
```bash
for i in 1 2 3 4 5; do
curl -s -o /dev/null -w "attempt$i: %{http_code}\n" -X POST "https://movie-bridge.seong381400.workers.dev/api/ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seong381400@gmail.com",
    "name": "배경템플릿검증",
    "seat": "A5'"$i"'",
    "movieTitle": "죽은 시인의 사회",
    "movieDate": "2026년 8월 22일 (토) 10:00 ~ 11:40",
    "venue": "대구과학고등학교 중강당",
    "ageRating": "12세이상관람가",
    "posterUrl": "https://img.movist.com/?img=/x00/00/01/08_p1.jpg",
    "backgroundTemplateUrl": "'"$(curl -s "https://mfpeyfqjjzjnwfgfdsfo.supabase.co/rest/v1/movie_settings?select=background_template_url&is_active=eq.true" -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2-)" | grep -o "\"background_template_url\":\"[^\"]*\"" | cut -d'"'"'"'"'"' -f4)"'"",
    "statusType": "changed",
    "popcorn": "none",
    "ticketId": "bg-template-verify-'"$i"'",
    "baseUrl": "https://movie-bridge.seong381400.workers.dev"
  }'
sleep 2
done
```

Expected: 5번 모두 `200` (예전 outer 없는 버전보다도 안정적이어야 한다 — 이미지 디코딩이 1장뿐이므로). 만약 여전히 간헐적 503이 있다면, 최소한 예전 "outer 있는 버전"(거의 매번 503)보다는 확연히 나아야 한다.

- [ ] **Step 7: tail 로그 확인**

Run: `cat /tmp/ticket-bg-tail.log`
Expected: `Exceeded CPU Limit` 에러가 없거나, 있어도 5번 중 1번 이하 수준(기존 outer 없는 안정 버전과 비슷하거나 더 나은 수준).

- [ ] **Step 8: 실제 수신 이메일 육안 확인**

`seong381400@gmail.com` 받은편지함에서 "배경템플릿검증" 메일을 열어, 블러 확산 배경 + 로고 + 라운드코너 카드 + 절취선 + 텍스트(좌석/제목/날짜 등)가 모두 정상적으로 겹쳐 보이는지 확인한다. 특히 텍스트가 카드 프레임 안쪽에 정확히 위치하는지(밖으로 삐져나오지 않는지) 확인.

- [ ] **Step 9: tail 프로세스 종료**

Run: `pkill -f "wrangler tail"`

- [ ] **Step 10: 결과에 따라 후속 조치**

- CPU 예산 안에서 안정적으로 동작하면: 그대로 유지, 완료.
- 여전히 자주 실패하면: 이 태스크의 목표(간헐적 503을 낮추는 것)는 달성 못 한 것 — 사용자에게 결과를 보고하고 롤백 여부를 논의한다(코드는 그대로 두되 관리자가 배경 생성을 안 하면 자동으로 안전한 폴백 경로를 타므로, 최소한 회귀는 없다).
