# 티켓 카드 배경 템플릿 사전 렌더링

## 배경

이메일 발송 시 satori(`next/og`)로 티켓 카드를 PNG로 합성한다. 카드 밖으로 포스터를
블러 확산시키는 "outer 배경" 효과를 넣으면(984×1466 캔버스, 포스터 이미지 2장을
동시에 디코딩 — 카드 안쪽 원본 + 바깥쪽 블러본) Cloudflare Workers의 CPU 타임
예산을 거의 항상 초과해서 503(`Worker exceeded CPU time limit`)이 난다. 로컬
`wrangler preview`는 이 CPU 제한을 강제하지 않아서 문제를 못 잡는다.

실측으로 확인한 것: 카드 단독(포스터 1장, 700×960)은 대체로 성공한다(콜드스타트
때 간헐적으로만 실패). 실패하는 조합은 항상 "큰 이미지 2장을 동시에 디코딩 +
확장된 캔버스"였다. Cloudinary로 blur 연산 자체를 미리 처리해서 얹기만 해도
여전히 실패했다 — 즉 blur 필터 연산이 아니라 **이미지 2장을 디코딩하는 부담
자체**가 원인이다.

## 목표

무거운 이미지 합성(블러 배경 + 로고 + 카드 프레임 + 절취선)을 이메일 발송 시점이
아니라, 관리자가 포스터를 등록/수정하는 시점에 **관리자 브라우저**에서 미리
끝내둔다. 발송 시점에는 그 결과물(텍스트 없는 완성된 배경 PNG, 984×1466) 위에
텍스트(판매번호/제목/날짜/좌석/가격/배지)만 satori로 얹는다. 이미지 디코딩이
1장으로 줄어들어 CPU 예산 안에 들어올 것으로 기대한다(카드 단독 케이스와 비슷한
무게).

브라우저에서 렌더링하면 Cloudflare Workers CPU 제한을 아예 우회한다 — 실패해도
관리자 쪽 UX 문제일 뿐, 발송 경로에는 영향이 없다.

## 아키텍처 / 데이터 흐름

```
[관리자 페이지] 포스터 URL 입력 → "배경 생성" 버튼 클릭
    → 브라우저: /api/poster-image?src=... 로 포스터 로드 (admin 페이지와 same-origin,
      CORS 문제 없음 — 프록시가 fetchSafeImage로 이미 SSRF 방지도 하고 있음)
    → <canvas 984×1466>에 그리기:
        - 확대한 포스터에 `ctx.filter = 'blur(70px) brightness(0.7) saturate(1.6)'`로
          블러 배경
        - 4방향 edge-aligned gradient (상/하/좌/우 vignette)
        - "영화 / 대교" 로고 텍스트 (Song Myung 웹폰트)
        - 카드 프레임: 700×960 rounded-rect 마스킹, 그림자, 원본 포스터(cover),
          카드 내부 하단 그라디언트
        - 하단 절취선(반원 13개)
      텍스트 콘텐츠(판매번호/제목/날짜/좌석/가격/배지)는 전부 비워둠 — 발송 시
      satori가 그 자리에 얹는다.
    → canvas.toBlob('image/png')
    → `/api/admin/ticket-background`로 PNG 업로드
        → 서버가 Cloudinary에 단순 업로드(변환 없음 — 이미 완성된 이미지)
        → 반환된 URL을 movie_settings.background_template_url에 저장
    → 성공/실패 상태를 관리자 UI에 표시

[이메일 발송 시] app/api/ticket/route.ts
    → movie_settings에서 background_template_url 조회
    → 있으면 fetchSafeImage(재시도 포함)로 다운로드 → renderTicketCardImage에
      templateImage로 전달
    → renderTicketCard.tsx: 템플릿 PNG를 배경으로 깔고, 그 위에 텍스트 레이어만
      절대좌표(카드 프레임 offset: top=260, left=140, 700×960 안쪽)로 오버레이
    → 템플릿이 없거나(아직 생성 안 함) fetch 실패하면 지금의 안정 버전(outer 없는
      카드 이미지 + 이메일 HTML의 로고/라운드코너/절취선)으로 조용히 폴백
```

## 컴포넌트

- **`lib/ticketBackgroundCanvas.ts`** (신규, 클라이언트 전용): canvas 렌더링 순수
  함수. 입력: 포스터 이미지 엘리먼트/URL. 출력: `Promise<Blob>` (PNG). 기존
  `renderTicketCard.tsx`의 outer 버전 레이아웃 상수(SIDE_MARGIN=140,
  TOP_MARGIN=90, LOGO_BLOCK_HEIGHT=170, CARD_WIDTH=700, CARD_HEIGHT=960,
  BOTTOM_MARGIN=90 → OUTER_WIDTH=984, OUTER_HEIGHT=1466)를 그대로 재사용해서
  satori 쪽 텍스트 오버레이 좌표와 어긋나지 않게 한다.
- **`app/api/admin/ticket-background/route.ts`** (신규): PNG 업로드 받아 Cloudinary
  업로드 + `movie_settings.background_template_url` 갱신. 기존 관리자 API처럼
  `ADMIN_PASSWORD` 체크.
- **`app/admin/page.tsx`** 수정: 포스터 URL 입력 필드 옆 "배경 생성" 버튼 +
  상태(생성중/완료/실패) 표시. "포스터를 바꿨으면 배경도 다시 생성하세요" 안내
  문구.
- **`lib/renderTicketCard.tsx`** 수정: `TicketCardProps`에 `templateImage`
  (선택) 추가. 있으면 배경+텍스트 오버레이 경로, 없으면 지금 안정 버전(outer
  없는 카드) 그대로 — 두 경로 다 유지.
- **`app/api/ticket/route.ts`** 수정: `movie_settings`에서
  `background_template_url` 조회 로직 추가, 있으면 fetch해서 넘겨줌.
- **`lib/cloudinary.ts`**: 기존 blur-transform용 `getBlurredPosterUrl`은 이제
  안 쓴다(관리자가 브라우저에서 이미 블러 처리하므로) — 단순 업로드 함수로
  교체.
- **DB**: `movie_settings`에 `background_template_url text null` 컬럼 추가.

## 에러 처리

- Canvas 렌더 실패(이미지 로드 실패, 구형 브라우저의 `filter` 미지원): 관리자에게
  에러 표시, 재시도 가능. 발송 로직엔 영향 없음.
- Cloudinary 업로드 실패: 에러 표시, DB 갱신 안 함(기존 템플릿 URL 유지).
- 포스터 URL 변경 후 배경 미재생성: 자동 무효화 안 함(범위 밖) — 안내 문구만.
- 발송 시 템플릿 fetch 실패: 조용히 폴백, 이메일 발송 자체는 막지 않음.

## 테스트

- admin 페이지에서 실제로 버튼 눌러 canvas 결과물 시각 확인.
- 프로덕션 배포 후 `wrangler tail`로 실제 발송 반복 테스트 — CPU 초과(1102) 없이
  도는지가 이 기능의 성공 기준.
