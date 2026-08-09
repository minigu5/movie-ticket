# 티켓 카드 이미지 합성 (Gmail position/negative-margin 제약 우회)

## 배경

티켓 예매 확인 이메일의 카드에 "포스터가 텍스트 배경에 살짝 비치는" 그라디언트 오버레이
효과를 넣으려 했으나, 실제 Gmail(웹/앱)로 반복 검증한 결과 다음 두 가지가 모두 확인됨:

1. `position:absolute` 기반 레이어링 → Gmail이 `position` 속성을 스트리핑해서 이미지들이
   순서대로 쭉 쌓여버림 (실메일 스크린샷으로 확인).
2. `margin-top: -Npx` 음수 마진으로 겹치기 → 이것도 무시됨, 이미지와 텍스트 패널이 여전히
   순서대로 붙어서 나옴 (실메일 스크린샷으로 확인).

CSS만으로 "이미지 위에 텍스트가 겹쳐 비치는" 효과를 Gmail에서 만들 방법이 없다고 결론.
남은 방법은 서버에서 포스터+그라디언트+텍스트를 하나의 래스터 이미지로 미리 합성해서
보내는 것. (관련: `project_email_html_css_limits`, `project_poster_image_cid_attachment` 메모리)

## 목표

`app/api/ticket/route.ts`(티켓 예매/변경/취소 안내 메일)에서, 티켓 카드 전체(판매번호/영화
아이콘/제목/등급/날짜/장소/팝콘·가격/좌석번호/상태배지)를 포스터 위에 그라디언트로 합성한
PNG 한 장으로 만들어 CID 첨부로 보낸다. 로고 헤더("영화대교")와 QR/상태 안내문/CTA 버튼은
지금처럼 일반 HTML로 그 위·아래에 남는다.

범위: 이번 작업은 `app/api/ticket/route.ts`만 다룬다. `app/api/group-invite/route.ts`는
카드 구조가 달라 이번 스펙 밖(추후 필요시 별도 스펙).

## 아키텍처

```
app/api/ticket/route.ts
  ├─ (기존) statusType별 badgeColor/badgeText/priceText/popcornText/displayId 계산
  ├─ renderTicketCardImage(...)  ──▶  lib/renderTicketCard.tsx (신규)
  │                                     ├─ fetchSafeImage(posterUrl)  (기존 lib/safeImageFetch.ts 재사용)
  │                                     ├─ fetch(`${baseUrl}/fonts/Pretendard-{Regular,Bold}.otf`)
  │                                     ├─ satori(node, { width, height, fonts }) → SVG 문자열
  │                                     └─ @resvg/resvg-wasm Resvg(svg).render().asPng() → PNG Buffer
  ├─ 성공 → attachments=[{ cid:'ticketCard', content: png, contentType:'image/png' }],
  │          이메일 HTML은 로고 + <img cid:ticketCard> + QR/상태/CTA만 (카드 내부 마크업 제거)
  └─ 실패(any error) → 지금 커밋된 기존 카드 HTML 그대로 발송 (posterAttachment CID 배너 방식,
       변경 없음). 메일이 아예 안 나가는 경로는 없음.
```

`lib/renderTicketCard.tsx`는 순수 함수형 모듈. 인자로 카드에 필요한 모든 값(이미 route.ts가
계산해둔 것들 + posterUrl + baseUrl)을 받고, `Buffer | null`을 반환한다. 내부 실패는 전부
잡아서 `null`을 던지지 않고 반환한다 (route.ts가 분기만 하면 되도록).

## 컴포넌트

### `public/fonts/Pretendard-{Regular,Bold}.otf` (신규 정적 에셋)
로컬에 이미 있는 정품 Pretendard(otf, 각 ~1.5MB)를 커밋. Worker JS 번들에 인라인하지 않고
정적 에셋으로 서빙 → 렌더 시점에 `fetch(`${baseUrl}/fonts/...`)`로 같은 도메인에서 가져옴
(Worker 스크립트 사이즈/CPU 제한과 무관). 로고 폰트(Song Myung)는 이미지 밖(HTML)에만 쓰이므로
불필요.

### `lib/renderTicketCard.tsx` (신규)
- satori용 JSX 트리로 카드 레이아웃 작성 (지금 HTML 카드의 시각 디자인을 그대로 재현:
  포스터 전체 배경 + `linear-gradient` 스크림 + 판매번호 칩/영화 아이콘/제목/등급/날짜/
  장소/팝콘·가격 패널/좌석번호/상태배지). 서버 렌더링이라 Gmail의 position/gradient 제약과
  무관 — 원래 의도한 디자인 그대로 구현 가능.
- `satori(node, { width: 760, height: ~880, fonts: [...] })` (2x 스케일로 렌더 후 이메일에서
  `width:100%`로 축소 표시 — 레티나 대비 선명도용).
- 결과 SVG를 `@resvg/resvg-wasm`으로 PNG 래스터화. WASM 모듈은 모듈 스코프에서 1회만
  `initWasm()` (Worker 인스턴스 내 재사용, 요청마다 재초기화 안 함).
- 텍스트는 이제 satori가 픽셀로 그리는 것이라 HTML 인젝션 위험이 없음 — 이 함수 내부에서는
  `escapeHtml()` 불필요 (route.ts가 이메일 HTML 나머지 부분에 쓰는 값들은 계속 escape).
- 전체를 8초 타임아웃(`Promise.race` + `AbortController`)으로 감싸서 무한 대기 방지.

### `app/api/ticket/route.ts` (수정)
- `renderTicketCardImage()` 호출 지점 추가, 성공/실패로 분기.
- 성공 시 이메일 HTML의 카드 마크업(포스터 `<img>` + info 패널 전체)을 단일
  `<img src="cid:ticketCard" width="380" style="display:block; width:100%; border-radius:20px; box-shadow:...">`
  로 교체. QR코드/계좌번호/상태 문구/CTA 블록은 기존 그대로 유지.
- 실패 시 현재 커밋된 카드 마크업(포스터 CID 배너 + 테이블 기반 텍스트 패널) 그대로 사용 —
  기존 코드 삭제하지 않고 fallback 분기로 유지.

## 에러 처리

`renderTicketCardImage` 내부의 다음 실패는 전부 catch해서 `null` 반환, route.ts는 그걸 보고
폴백만 함(별도 에러 로그는 `console.error`로 남김):
- 포스터 fetch 실패 (`fetchSafeImage`가 `{ok:false}` 반환)
- 폰트 fetch 실패
- satori 렌더 실패
- resvg-wasm 초기화/래스터화 실패
- 8초 타임아웃

## 테스트

- `npm run preview`(wrangler 로컬 workerd) 기동 후 `curl -X POST .../api/ticket`로 실제
  posterUrl 넣어 호출, 본인 Gmail로 실제 발송 → **Gmail 앱/웹 화면 스크린샷**으로 확인
  (PDF 인쇄본은 배경 그래픽이 빠져서 판단 근거로 쓰지 않음 — `project_poster_image_cid_attachment`
  메모리 참고).
- `npx next build`로 타입체크 통과 확인.
- 실제 `npm run deploy`까지 마친 뒤 프로덕션 워커에서도 한 번 더 curl 테스트 발송.
- 폰트/WASM 번들 후 실제 배포가 되는지(사이즈 제한 안 걸리는지), 렌더 소요 시간이
  체감상 과도하게 느리지 않은지(수 초 이내) 확인 — 문제 있으면 폴백이 항상 잡아주므로
  최악의 경우에도 메일 발송 자체는 안전.

## 리스크 / 미확정 사항

- Cloudflare Workers CPU 시간 제한 안에서 satori+resvg 렌더가 안정적으로 끝나는지는
  실측 필요 (사전에 정확한 제한값을 안다고 가정하지 않음 — 배포 후 직접 확인).
- OTF 폰트가 satori/resvg 파이프라인에서 예상대로 렌더되는지 확인 필요 (문제 있으면 TTF
  변환 검토).
