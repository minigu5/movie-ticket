# 관리자 페이지 레이아웃 + 이메일 기반 명단 관리 + 관리자 버튼 노출 조건

날짜: 2026-07-18

## 배경

관리자 페이지(`app/admin/page.tsx`) 4개 박스(관리자 목록/동아리원 목록/키오스크 비밀번호/사용자 프로필 수정)가 하나의 grid 컨테이너 안 셀로만 구성돼 있어 프로필 수정 패널이 늘어나면 다른 박스와 레이아웃이 안 맞음. 동아리원(VIP)/블랙리스트는 학번 4자리로 추가하는데, 이메일 기반으로 바꾸고 여러 명을 텍스트 붙여넣기로 한 번에 추가하고 싶음. 메인 페이지는 로그인만 하면 관리자 권한 없어도 "관리자"/"발권기" 버튼이 보임.

## 범위

1. `app/admin/page.tsx` 4열 그리드 카드화 + 높이 안정화
2. `club_members`, `blacklist` 테이블 PK를 `student_id` → `email`로 전환하는 마이그레이션
3. 이메일 일괄 추출 유틸 + 동아리원/블랙리스트 추가 UI를 textarea 기반 일괄 입력으로 교체
4. `app/api/admin/action/route.ts`의 관련 액션(club_members/blacklist add/remove/fetch) email 기준으로 변경, bulk insert 지원
5. `app/page.tsx` 예매 흐름(VIP 체크, 블랙리스트 체크, 그룹 멤버 검색)의 매칭 키를 `student_id` → `email`로 전환
6. `app/api/profiles/search/route.ts` 응답에 `email` 포함
7. `app/api/admin/check/route.ts` 신설(가벼운 관리자 여부 확인), `app/page.tsx`에서 로그인 후 호출해 관리자일 때만 "관리자"/"발권기" 버튼 렌더링

## 아키텍처 / 데이터 흐름

### 1. 레이아웃
`grid grid-cols-1 md:grid-cols-4 gap-6` 컨테이너는 유지. 4개 자식 div 각각에 `bg-gray-900/60 rounded-lg border border-{accent}-800/50 p-4 flex flex-col` 부여(accent는 기존 강조색: 노랑/보라/파랑/분홍 계열과 맞춤). 관리자 목록/VIP 목록 리스트: `max-h-40 overflow-y-auto` 유지. 사용자 프로필 수정 패널(`editingProfile` 표시부): `max-h-64 overflow-y-auto` 추가. 이렇게 하면 각 열이 시각적으로 독립된 박스로 보이고, 내용 늘어나는 열은 자체 스크롤로 흡수됨.

### 2. DB 마이그레이션 (`supabase/migrations/0002_email_membership.sql`)
- `club_members`: `truncate` → PK 제약 drop → `student_id` 컬럼 drop → `email` 컬럼 add → PK를 `email`로 재생성 → 10명 시드 insert (제공된 이메일 목록)
- `blacklist`: `truncate` → PK/유니크 제약 drop(있다면) → `student_id`, `student_name` 컬럼 drop → `email` 컬럼 add, PK로 지정 → 시드 없음(빈 테이블로 시작)
- 기존 0001 파일과 동일하게 재실행 가능(idempotent)하도록 `if exists`/`if not exists` 가드 사용

### 3. 이메일 추출 유틸
`lib/parseEmails.ts`:
```ts
export function extractSchoolEmails(text: string): string[] {
  const matches = text.match(/[\w.+-]+@[\w.-]+\.[\w.-]+/g) ?? [];
  const unique = Array.from(new Set(matches.map(e => e.toLowerCase())));
  return unique.filter(e => e.endsWith('@ts.hs.kr'));
}
```
동아리원/블랙리스트 추가 UI는 각각 textarea + "일괄 추가" 버튼. 입력값 변경 시 실시간으로 추출된 이메일 개수를 미리보기로 표시("3개 이메일 인식됨"). 제출 시 추출된 배열을 서버로 전송.

### 4. API 변경 (`app/api/admin/action/route.ts`)
- `ADD_CLUB_MEMBER` → `ADD_CLUB_MEMBERS`: payload `{ emails: string[] }`, 각 이메일 도메인 검증 후 `upsert` (`on conflict (email) do nothing`), `{ added, skipped }` 카운트 반환
- `REMOVE_CLUB_MEMBER`: `studentId` → `email` 파라미터
- `ADD_BLACKLIST` → `ADD_BLACKLIST_BULK`: payload `{ emails: string[] }`, 각 이메일에 대해 `reservations`에서 `email` 일치하는 진행중 예약 조회 → 자동 취소(기존 취소 로직 재사용, activity_log에는 취소된 예약의 `student_id`/`student_name` 사용) → `blacklist`에 email upsert
- `REMOVE_BLACKLIST`: `studentId` → `email` 파라미터
- `FETCH_INITIAL_DATA`의 `club_members`/`blacklist` select를 `email` 기준 컬럼으로 변경

### 5. 예매 흐름 (`app/page.tsx`)
- `blacklistedUsers`/`clubMemberIds` state: `string[]` (이메일 배열)로 유지, fetch시 select 컬럼만 `email`로 변경
- `profile.student_id` 기준 비교 → `profile.email` 기준으로 변경 (VIP 좌석 체크, 블랙리스트 체크 총 4곳: line ~275, ~278, ~370, ~371)
- `selectedMember`/`memberSearchResults` 타입에 `email: string` 추가, 그룹원 검색 결과 블랙리스트/VIP 체크(line ~402, ~411)도 `email` 기준
- `newMembers` 배열 구성 시 `studentId` 필드는 티켓 표시용으로 그대로 유지(이건 블랙리스트/VIP 매칭과 무관한 별개 용도)

### 6. `app/api/profiles/search/route.ts`
select에 `email` 추가. 검색 조건(`name`/`student_id` ilike)은 기존 유지 — 이메일로 직접 검색하는 기능은 이번 스코프 아님(그룹원 찾기는 이름/학번으로 하는 게 자연스러움).

### 7. 관리자 버튼 노출
`app/api/admin/check/route.ts`: `requireAdmin(req)` 호출해서 `{ isAdmin: boolean }` 반환(401/403도 `{isAdmin:false}`로 흡수, 500만 별도 에러).
`app/page.tsx`: `profile` 로드된 후 이 API 1회 호출, `isAdmin` state에 저장. "관리자"/"발권기" 버튼은 `isAdmin === true`일 때만 렌더링. `isAdmin` 로딩 중엔 버튼 숨김(깜빡임 방지, 로그인 화면 통과 후에도 잠깐 안 보였다가 나타나는 정도는 허용).

## 에러 처리
- 이메일 도메인 불일치: 서버에서 필터링해서 무시하고 나머지만 처리(클라이언트에서도 미리 걸러지므로 중복 방어)
- 빈 텍스트/이메일 0개 추출: "추가할 이메일이 없습니다" alert, 서버 호출 안 함
- 마이그레이션 재실행: 기존 파일처럼 전부 idempotent, 재실행해도 안전

## 테스트/검증
- `npm run build` 통과 확인
- 로컬에서 관리자 페이지 레이아웃 육안 확인(가능하면)
- 마이그레이션 SQL은 수동 실행 대상(이 프로젝트 관례) — 실행은 사용자 몫, 코드만 준비

## 스코프 제외
- `student_id` 컬럼 자체는 `profiles`/`reservations`/`activity_logs`에서 그대로 유지(티켓 표시/학생 식별 용도, 이번 변경과 무관)
- 그룹원 검색을 이메일로 직접 하는 기능은 추가하지 않음(기존 이름/학번 검색 유지)
