# 티켓 카드 HTML 오버레이 방식 전환

> 이 스펙은 [`2026-08-10-ticket-background-template-design.md`](./2026-08-10-ticket-background-template-design.md)를 대체한다. 그 스펙의 관리자 배경 템플릿 생성 파이프라인(canvas 렌더링, admin 버튼, Cloudinary 업로드, DB 컬럼)은 그대로 유지되고, 이 스펙은 "발송 시점에 satori로 텍스트를 이미지에 합성한다"는 부분만 "이메일 HTML에서 텍스트를 이미지 위에 직접 오버레이한다"로 교체한다.

## 배경

[`2026-08-10-ticket-background-template-design.md`](./2026-08-10-ticket-background-template-design.md)에서 관리자 브라우저 canvas로 배경을 미리 구워서 satori가 텍스트만 얹게 하는 방식을 구현했지만, 실측 결과 **satori/resvg의 최종 출력 캔버스 해상도(984×1466) 자체가 Cloudflare Workers CPU 예산을 넘는다**는 게 확인됐다(이미지 내용을 1×1 픽셀로 줄여도 CPU 초과가 재현됨 — 이미지 디코딩 비용이 아니라 출력 해상도 자체가 원인).

한편 별도로, "이미지 위에 텍스트를 겹쳐 보이게" 하는 효과가 Gmail에서 `position:absolute`/다중 `background`로는 안 된다고 결론 났던 이전 조사([`project_email_html_css_limits.md`](../../../../.claude/projects/-Users-shinmingyu-Project-movie-ticket/memory/project_email_html_css_limits.md) 참고 — 이 경로는 이 저장소 밖의 메모리 파일)와 달리, **HTML의 legacy `background` attribute(`<td background="...">`) + 단순 `background-image` CSS 조합은 실제 Gmail 발송 테스트에서 완벽하게 동작함**을 오늘 재확인했다(텍스트 2줄짜리 단순 케이스, 그리고 배지+제목+날짜+좌석+가격+상태배지가 다 있는 실제 카드 복잡도 케이스 둘 다 스크린샷으로 검증 완료).

이 발견으로, 애초에 satori로 이미지 합성을 하게 된 이유(이메일에서 이미지 위에 텍스트를 못 얹는다는 제약) 자체가 틀렸다는 게 드러났다. 따라서 satori 렌더링을 완전히 걷어내고, 이메일 HTML이 직접 이미지 위에 텍스트를 얹게 한다. Cloudflare Workers는 이미지를 CID로 첨부하기 위해 다운로드만 하면 되고, 무거운 합성 연산 자체가 사라지므로 CPU 문제가 원천적으로 없어진다.

## 목표

- `app/api/ticket/route.ts`에서 satori 기반 카드 합성(`renderTicketCardImage`)을 제거하고, 순수 HTML(`<td background="cid:...">` + `background-image` CSS 이중 안전망) 오버레이로 대체한다.
- 관리자가 만든 배경 템플릿이 있으면 그걸 쓰고, 없으면 원본 포스터를, 그것도 없으면 텍스트만 있는 카드로 — 3단계 우선순위로 조용히 폴백한다(이메일 발송 자체가 막히는 일은 없어야 한다).
- `lib/renderTicketCard.tsx`는 더 이상 쓰이지 않으므로 삭제한다.

## 아키텍처 / 데이터 흐름

```
[app/api/ticket/route.ts]
  1. posterUrl 있으면 fetchSafeImage로 다운로드 → posterImage
  2. backgroundTemplateUrl 있으면 fetchSafeImage로 다운로드 → templateImage
  3. cardBackground 결정:
       templateImage?.ok  → { cid: 'cardBg', body: templateImage.body, contentType, outer: true }
       posterImage?.ok    → { cid: 'cardBg', body: posterImage.body, contentType, outer: false }
       둘 다 없음          → null (배경 없이 텍스트만)
  4. cardBackground가 있으면 attachments에 { filename, content, cid: 'cardBg', contentType } 추가
  5. 카드 마크업 생성(테이블 기반):
       outer=true  → 984×1466 비율 컨테이너, 배경 이미지가 이미 로고/카드프레임/절취선을
                      다 포함하고 있으므로 텍스트 레이어는 그 안쪽 카드 프레임 좌표
                      (좌우 여백 비율로 근사, 이메일은 고정폭이라 padding-top 등으로 근사 배치)
                      에 오버레이
       outer=false → 700×960 비율 컨테이너(라운드코너+그림자는 CSS로), 포스터 원본이
                      배경, 텍스트는 카드 패딩 안쪽에 오버레이
       cardBackground 없음 → 배경 없는 solid 색상 패널에 텍스트만(현재 폴백 카드와 동일)
  6. sendMail(ticketHTML, attachments)
```

satori 관련 코드(`renderTicketCardImage`, `TicketCardProps`)는 전부 제거된다. `lib/cloudinary.ts`, `lib/ticketBackgroundCanvas.ts`, `app/admin/page.tsx`의 배경 생성 버튼, DB의 `background_template_url` 컬럼은 그대로 유지된다 — 이번 변경은 "그 템플릿을 어떻게 소비하는가"만 바꾼다.

**해상도**: canvas 렌더링은 이제 관리자 브라우저에서 돌아가므로 Workers CPU 제한과 무관하다. `lib/ticketBackgroundCanvas.ts`에 `SCALE = 2` 배율을 도입해 실제 캔버스 픽셀 크기(`OUTER_WIDTH*SCALE`×`OUTER_HEIGHT*SCALE`)를 2배로 키우고, `ctx.scale(SCALE, SCALE)`로 기존 레이아웃 좌표 로직은 그대로 재사용한다. 이메일에는 지금과 같은 표시 크기(`width` 속성)로 넣으므로 레이아웃/비율은 안 바뀌고 고밀도 디스플레이에서 더 선명하게만 보인다.

## 카드 마크업 상세

기존 satori 버전의 텍스트 레이아웃(패딩 `44px 44px 50px 44px`, 판매번호 배지, 제목 `margin-top: 220px`, 날짜/장소, 팝콘 박스, 좌석+이름 / 상태배지 좌우 정렬)을 그대로 HTML/CSS로 이식한다. 좌우 정렬은 `<table role="presentation"><tr><td>...</td><td style="text-align:right">...</td></tr></table>`로 한다(`flex`는 이메일에서 신뢰할 수 없다고 이미 확정됨).

배경 이미지는 항상 다음 이중 안전망으로 건다(둘 중 하나만 Gmail에 씹혀도 나머지가 백업):

```html
<td background="cid:cardBg" bgcolor="#161b26"
    style="background-image:url(cid:cardBg); background-size:cover; background-position:center; ...">
```

## 에러 처리

- `posterUrl`/`backgroundTemplateUrl` 다운로드 실패(`fetchSafeImage`가 `ok:false`) → 그 배경은 조용히 건너뛰고 다음 우선순위로 폴백. 이메일 발송 자체는 항상 성공해야 한다(카드 배경이 없어도 텍스트만으로 발송).
- 첨부 실패나 다른 예외는 기존처럼 최상위 `try/catch`가 잡아 500을 반환한다(변경 없음).

## 테스트

- 실제 프로덕션 배포 후 반복 발송 테스트(5회 이상) — CPU 초과(1102/503)가 사라졌는지가 핵심 성공 기준.
- 세 가지 배경 케이스(템플릿 있음 / 포스터만 있음 / 둘 다 없음) 각각 실제 Gmail 수신 화면에서 육안 확인.
