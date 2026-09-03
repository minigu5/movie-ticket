# 관리자 페이지 레이아웃 재설계

**날짜:** 2026-09-04
**상태:** 승인됨 (사용자 구두 승인, 구현 진행)
**대상 파일:** `app/admin/page.tsx` (946줄 단일 파일)

## 배경 및 문제

관리자 대시보드(`/admin`)가 946줄 단일 클라이언트 컴포넌트에 모든 기능이
세로로 나열돼 있다. 토글 버튼(설정 열기/닫기, 이력 열기/닫기 등)으로 큰
패널이 펼쳐지며, 스크롤이 길고 정보 위계가 없다.

특히 **동아리 전용(VIP) 좌석 지정**이 열악하다. 현재는 중강당·대강당 각각
`시작 행 / 끝 행 / 시작 열 / 끝 열` 텍스트·숫자 입력 4칸(총 8칸)으로,
관리자가 좌석 배치를 머릿속으로 그려야 한다.

## 목표

- 기능·API 엔드포인트·데이터 흐름 **완전 보존**. 순수 UI/구조 개편.
- 토글 나열 → **탭 4개**로 정보 그룹화.
- VIP 좌석 지정을 **시각적 좌석 그리드 + 두 모서리 클릭**으로 교체.
- 946줄 단일 파일 → 탭별 컴포넌트 분리.
- 다크 테마 유지하되 색·간격·위계 정돈.

## 비목표 (이번 범위 밖)

- 예매 내역 검색·필터, 모바일 카드뷰 (사용자가 선택 안 함)
- 라이트 테마 전환
- API route(`app/api/admin/action/route.ts`) 변경
- 인증·권한 로직 변경

## 아키텍처

### 탭 구조

헤더(제목 · `profile.email` · 로그아웃 · 메인 홈 링크 · 현장 발권기 링크 ·
🔄 새로고침) 아래 탭 바. 탭 상태는 `page.tsx`의 `useState<TabKey>`,
기본값 `reservations`. URL 동기화는 하지 않는다(YAGNI).

| 탭 키 | 라벨 | 포함 기능 (기존 섹션) |
|---|---|---|
| `reservations` | 🎟️ 예매 관리 | 상단 요약 카운터, 팝콘/매출 요약 카드, 예매 내역 테이블(정렬) |
| `settings` | ⚙️ 상영 설정 | 현재 영화 설정 편집 폼, VipZonePicker, 🎬 새 회차 시작 폼 |
| `members` | 👥 회원·권한 | 관리자 목록, 동아리원(VIP) 목록, 블랙리스트, 사용자 프로필 수정, 키오스크 비밀번호 |
| `history` | 🗂️ 이력·로그 | 회차 이력(예매내역+평점/후기), 시스템 활동 로그 |

기존 토글 버튼(`showLogs`, `isEditingSettings`, `isStartingNewMovie`,
`showMovieHistory`)은 제거하지 않고 탭 내부 상태로 존속시킨다. 단
"설정 변경"/"새 회차 시작"은 `settings` 탭에서 항상 노출(토글 불필요),
"회차 이력"은 `history` 탭 진입 시 `LIST_MOVIE_HISTORY`를 최초 1회 fetch.

인증 게이트 화면(`authLoading` / `!profile` / `checkingAdmin` / `!isAdmin`)은
그대로 유지.

### 파일 구조

```
app/admin/
  page.tsx                    컨테이너. 모든 useState + 핸들러 + fetchAdminData
                              + 탭 전환. 게이트 렌더. 약 400줄.
  _components/
    AdminTabs.tsx             탭 바 (props: active, onChange, counts?)
    ReservationsTab.tsx       요약 카운터 밴드 + 팝콘/매출 카드 + 정렬 테이블
    SettingsTab.tsx           영화 설정 폼 + 새 회차 폼. VipZonePicker 2회 사용.
    MembersTab.tsx            관리자/동아리원/블랙리스트/프로필/키오스크 4~5 카드
    HistoryTab.tsx            회차 이력 목록 + 상세(예매/후기) + 활동 로그
    VipZonePicker.tsx         시각적 좌석 영역 선택기 (신규)
lib/
  seatGrid.ts                 getGridRows / getGridCols / computeSeatId /
                              computeVipSeats — app/page.tsx에서 추출한 순수 함수
```

`page.tsx`는 이미 `"use client"`. Next 16의 client 경계 규칙상 그 하위
import는 자동으로 클라이언트 번들에 포함되므로 자식 컴포넌트에 지시어는
필수가 아니나, 훅을 쓰는 컴포넌트에는 관례상 `"use client"`를 붙인다.

### 상태 관리

모든 `useState`, 모든 핸들러(`handleApprove`, `handleSaveSettingsClick`,
`handleAddClubMembers` 등 25종), `fetchAdminData`는 **`page.tsx`에 그대로
유지**. 탭 컴포넌트는 필요한 데이터와 콜백을 props로 받는다(1단계 prop
drilling, React Context 미사용).

예: `<ReservationsTab reservations={reservations} popcornStats={popcornStats}
movieInfo={movieInfo} onApprove={handleApprove} onCancel={handleCancel}
onResetPrint={handleResetPrint} />`

### lib/seatGrid.ts 추출

`app/page.tsx` 31~97줄의 모듈 스코프 함수 4개를 그대로 `lib/seatGrid.ts`로
옮기고 `export`. `app/page.tsx`는 상단에서 import하도록 수정(동작 불변,
순수 함수 이동). 타입 `VipConfig`도 함께 export.

```ts
export function getGridRows(isGrandHall: boolean): string[]
export function getGridCols(isGrandHall: boolean): number[]
export function computeSeatId(isGrandHall: boolean, rowIndex: number, colIndex: number): string | null
export type VipConfig = { mid_vip_start_row?: string; ... grand_vip_end_col?: number }
export function computeVipSeats(isGrandHall: boolean, rows: string[], cols: number[], vipConfig: VipConfig): Set<string>
```

## VipZonePicker 상세

### 인터페이스

```ts
type Zone = { startRow: string; endRow: string; startCol: number; endCol: number };

interface VipZonePickerProps {
  hall: 'mid' | 'grand';          // 중강당 / 대강당
  onHallChange: (h: 'mid' | 'grand') => void;
  zone: Zone;                     // 현재 값
  onZoneChange: (z: Zone) => void;
}
```

부모(SettingsTab)는 `editForm`/`newMovieForm`의 8개 필드를 이 컴포넌트의
`zone`으로 매핑해 주고, `onZoneChange`에서 다시 8개 필드로 되돌려 쓴다.
`hall` 토글은 표시용일 뿐 — **두 강당 설정 모두 항상 저장된다**(현재와 동일).
즉 SettingsTab이 `mid`/`grand` 두 zone 상태를 각각 들고, 토글로 어느 쪽을
편집·미리보기할지 고른다.

### 렌더링

- 선택된 `hall`에 따라 격자 크기 결정:
  - `mid`(중강당): 행 A~I(9), 열 1~14
  - `grand`(대강당): 행 A~R(18), 열 1~27
- **섹션 분할 없는 단순 행렬**로 렌더(예매 페이지의 A/B/C 구역 분할 불필요 —
  저장값이 행 문자·열 숫자 사각형이므로). 좌측에 행 문자, 상단에 열 숫자.
- 각 셀 상태:
  - 일반: 어두운 회색
  - 선택 사각형 내부: 강조색(indigo) 채움
  - 첫 모서리만 찍힌 상태: 해당 셀 링 표시
- 클릭 동작: 첫 클릭 = 모서리 A 저장, 두 번째 클릭 = 모서리 B →
  `startRow=min, endRow=max` (charCode 비교), `startCol=min, endCol=max` →
  `onZoneChange`. 세 번째 클릭은 새 첫 모서리로 리셋.
- 대강당은 27열이라 가로 스크롤 컨테이너(`overflow-x-auto`) 안에 둔다.
  셀은 작게(약 20~24px). 모바일에서도 스크롤로 접근 가능.
- 하단 요약: `A3 ~ C10 · 18석`. 좌석 수는 `computeSeatId`로 사각형 내
  non-null 좌석을 카운트(정확한 수).
- "직접 입력" 접기 패널(details)로 기존 4입력 필드도 보존 —
  극단적으로 정밀 조정이 필요하거나 그리드가 안 뜰 때의 안전장치.

### 저장 경로 (불변)

`handleSaveSettingsClick` / `handleSubmitNewMovie`의 payload는 그대로
`mid_vip_start_row` 등 8필드. VipZonePicker는 그 8필드를 만들어낼 뿐이므로
`UPDATE_SETTINGS` / `START_NEW_MOVIE` 액션은 변경 없음.

## 예매 내역 테이블 개선

### 상단 요약 카운터 밴드

`ReservationsTab` 최상단에 작은 카드 행. `reservations`에서 파생:

- 승인 대기: `payment_status === 'pending'` 개수
- 확정: `payment_status === 'confirmed'` 개수
- 단체 대기: `payment_status === 'group_pending'` 개수
- 미발권(확정 중): `confirmed && !is_printed` 개수

기존 "예매 및 팝콘 현황 요약" 카드(오리지널/콘소메/카라멜/현금매출)는
이 밴드 아래에 유지. 둘을 시각적으로 한 묶음으로.

### 정렬

테이블 헤더(좌석 / 학번·이름 / 상태 / 발권) 클릭 시 정렬. 로컬 상태
`sortKey`, `sortDir`. `useMemo`로 정렬된 배열 산출, 서버 요청 없음.

- 좌석: 자연 정렬. `seat_number` 문자열을 `(구역문자, 숫자)` 튜플로 파싱해
  비교 (`A03` < `A10` < `B01`).
- 학번·이름: `student_id` 문자열 비교, 동률 시 `student_name`.
- 상태: `pending` → `group_pending` → `confirmed` 순서 가중치.
- 발권: `is_printed` boolean.
- 기본 정렬: 좌석 asc. 헤더에 ▲▼ 표시.

행 내용, 액션 버튼(✅ 승인 / 🔄 발권 초기화 / ❌ 강제 취소)의 표시 조건과
동작은 완전 불변.

## 스타일 정돈 (다크 유지)

- 존별 카드 테두리를 1색으로 통일(현재 노랑·주황·호박·분홍·에메랄드·인디고
  난립 → 탭별 대표색 1개 + 중립 회색 카드).
- 간격 토큰 통일: 카드 `p-4`, 그리드 `gap-4`, 반경 `rounded-xl`.
- 전체 컨테이너 `max-w-6xl mx-auto`로 폭 제한(현재 full-width 테이블만 넓음).
- 전체화면 로딩 스피너(`isLoadingUI`)는 그대로.
- 색상 팔레트 클래스는 Tailwind v4 기본, 신규 색 도입 없음.

## 에러 처리

기존 방식 유지 — 각 핸들러의 `alert()` / `confirm()` 패턴, 실패 시 조기
반환. 변경 없음.

## 테스트 / 검증

프로젝트에 자동 테스트 스위트 없음(확인함). 수동 검증:

1. `npm run build` — 타입체크·린트 통과
2. `npm run dev` 실행 후:
   - 탭 4개 전환, 각 탭 기존 기능 노출 확인
   - VipZonePicker: 중강당/대강당 토글, 두 모서리 클릭 → 하단 요약이
     기존 4입력과 동일한 행/열 산출. "직접 입력" 패널 값과 일치.
   - 설정 저장 → `movie_settings` 반영 확인(재조회 후 값 유지)
   - 새 회차 시작 폼도 동일 확인
   - 예매 테이블 정렬 4종 동작, 요약 카운터 숫자 정확성
   - 승인/강제취소/발권초기화/블랙리스트 일괄추가/동아리원 추가/프로필 수정/
     키오스크 비번 변경 — 스모크 테스트 1건씩
   - 회차 이력 선택 → 예매내역·후기 표시, 후기 삭제
   - 활동 로그 표시
3. `app/page.tsx`(예매 페이지) 좌석맵 정상 렌더 — seatGrid 추출 회귀 확인

## 구현 순서

1. `lib/seatGrid.ts` 추출 + `app/page.tsx` import 전환 → build 통과 확인
2. `VipZonePicker.tsx` 단독 구현
3. `AdminTabs.tsx` + `page.tsx` 탭 셸 골격 (기존 JSX를 탭별로 이동만)
4. `ReservationsTab.tsx` — 카운터 밴드 + 정렬 추가
5. `SettingsTab.tsx` — VipZonePicker 결선
6. `MembersTab.tsx`, `HistoryTab.tsx` — JSX 이동
7. 스타일 정돈 패스
8. build + dev 수동 검증
