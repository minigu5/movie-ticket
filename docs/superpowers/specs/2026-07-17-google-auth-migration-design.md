# Google 계정 통합 인증 전환 설계

날짜: 2026-07-17
작성자: 신민규 (요청) / Claude (설계)

## 1. 배경 및 목적

현재 인증 방식은 학번+이름을 `lib/constants.ts`의 `STUDENT_LIST`/`STAFF_LIST`(명렬표)와 대조하고, 4자리 숫자 비밀번호를 `student_auth` 테이블에 저장/검증(`verify_student_password` RPC)하는 구조다. 확인 메일이나 비밀번호 재설정 메일을 보내기 위해 `lib/emails.ts`의 `USER_EMAILS`(학번/이름 → `@ts.hs.kr` 이메일) 수동 매핑 테이블을 매년 새로 만들어야 한다. 이 매핑은 이메일 아이디(`ts26001` 등)가 학번과 아무 규칙 없이 연결되어 있어 매해 전수 재작성이 필요하고, 실수가 나기 쉽다.

학교는 전교생/교직원에게 `@ts.hs.kr` 구글 워크스페이스 계정을 지급하며, 학생 계정의 구글 프로필 이름은 `"2208신민규"` 또는 `"2208 신민규"` 형식(학번+이름)으로 설정되어 있다(학생 본인 또는 학교가 매년 갱신). 이 필드를 신뢰하면 이메일 매핑 테이블과 비밀번호 시스템을 통째로 없앨 수 있다.

**목표**: 예매/취소/단체예매/키오스크/관리자 사이트 전체 인증을 Supabase Auth + Google OAuth(`@ts.hs.kr` 도메인 제한)로 통합한다. 학번/이름은 구글 프로필 이름에서 파싱해 자동 확보하고, 명렬표·이메일 매핑·비밀번호 테이블을 제거한다.

**비목표**:
- 결제/팝콘 기능 부활 없음 (이미 제거된 상태 유지)
- 좌석 배치 알고리즘, VIP 좌석 판정 로직 자체는 변경 없음 (판정에 쓰는 데이터 소스만 배열 → DB 테이블로 교체)
- 기존 예약 데이터의 소급 마이그레이션 없음. `reservations` 테이블은 컷오버 시점에 전체 초기화한다(원래도 상영 회차마다 테이블을 초기화하던 운영 방식과 동일)

## 2. 인증 인프라

- Supabase Auth의 Google Provider 사용. 클라이언트에서 `supabase.auth.signInWithOAuth({ provider: 'google', options: { queryParams: { hd: 'ts.hs.kr' } } })` 호출.
- `hd` 파라미터는 구글 계정 선택 UI를 좁혀주는 힌트일 뿐 서버측 보안이 아니다. **실제 방어는 서버에서 로그인 세션의 이메일이 `@ts.hs.kr`로 끝나는지 검증**하는 것으로 한다. 도메인이 다르면 세션을 즉시 거부하고 로그아웃 처리.
- 최초 로그인 시 클라이언트가 `profiles` 테이블에 upsert 요청(1회성 프로비저닝). 이후 로그인은 기존 `profiles` 행을 그대로 사용.
- 학번/이름 파싱 규칙: 구글 프로필 `full_name`을 정규식 `^(\d{4})\s?(.+)$`로 시도.
  - 매치 성공 → `student_id = 그룹1`, `name = 그룹2`, `role = 'student'`
  - 매치 실패(학번 프리픽스 없음/형식 깨짐) → `student_id = null`, `name = 프로필 이름 전체`, `role = 'staff'` (기본값)
  - 파싱 오류나 실제 역할이 다른 경우, 관리자가 `/admin`에서 해당 사용자의 `student_id`/`name`/`role`을 직접 수정 가능
- API 라우트 인증: 클라이언트가 매 요청에 `Authorization: Bearer <access_token>` 헤더를 실어 보낸다. 서버는 `supabaseAdmin.auth.getUser(token)`으로 토큰을 검증하고, 필요시 `profiles`/`admins` 테이블을 조회해 권한을 판단한다. 기존 `adminPassword` 바디 파라미터 방식과 동일한 요청/검증 자리에서 토큰 검증으로 교체하며, 별도 middleware.ts나 세션 쿠키 체계는 도입하지 않는다.

## 3. 데이터 모델 변경

### 신규 테이블

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  student_id text,           -- 4자리, null이면 교직원
  name text not null,
  role text not null check (role in ('student', 'staff')),
  created_at timestamptz not null default now()
);

create table admins (
  email text primary key,
  added_by text,
  created_at timestamptz not null default now()
);

create table club_members (
  student_id text primary key,
  added_by text,
  created_at timestamptz not null default now()
);

-- 단일 행(id=1)만 사용하는 키오스크 잠금 비밀번호 저장소
create table kiosk_settings (
  id int primary key default 1,
  password text not null,
  updated_at timestamptz not null default now(),
  constraint kiosk_settings_singleton check (id = 1)
);
```

- `admins`, `club_members`, `kiosk_settings`는 관리자 페이지에서 CRUD/수정 가능한 관리 화면 추가 (기존 하드코딩 배열/문자열 대체).
- 부트스트랩 관리자 1행(`ts250024@ts.hs.kr`)은 SQL로 최초 1회 직접 insert. 이후 관리자 추가/삭제는 `/admin` UI에서 처리.
- `kiosk_settings`는 초기값으로 기존 하드코딩 비밀번호("영화대교최고")를 그대로 SQL로 1행 insert.

### 기존 테이블 변경

- `reservations`: 컷오버 시점에 테이블 전체를 `TRUNCATE`(모든 행 삭제)한 뒤 스키마를 변경한다.
  - `user_id uuid not null references profiles(id)` 컬럼 추가 (과거 데이터가 없으므로 처음부터 `NOT NULL`로 생성 가능)
  - `password` 컬럼 삭제 (`ALTER TABLE reservations DROP COLUMN password`)

### 제거 대상 (삭제 시점은 9절 하드 컷오버 이후)

- `lib/constants.ts`: `STUDENT_LIST`, `STAFF_LIST`, `CLUB_MEMBERS` 배열 전체 (구글 이름 파싱 + `profiles`/`club_members` 테이블로 대체)
- `lib/emails.ts` 파일 전체 (세션 이메일을 직접 사용)
- `student_auth` 테이블, `verify_student_password` RPC (Supabase 함수)
- `app/reset-password/page.tsx`, `app/api/auth/request-reset/route.ts` (비밀번호 개념 소멸)
- `ADMIN_PASSWORD` 환경변수 및 관련 코드

## 4. 예매 플로우 (`app/page.tsx`)

- 세션 없으면 "구글로 로그인" 버튼만 노출. 로그인 성공 시 `profiles` upsert(최초 1회) 후 좌석 선택 화면 진입.
- 기존 학번/이름/비밀번호 입력 폼(`formData` 관련 state 및 UI) 전부 제거. 예매에 필요한 `student_id`/`name`은 로그인된 `profiles` 값을 그대로 사용.
- VIP 좌석 판정: `CLUB_MEMBERS.includes(id)` 배열 조회 → `club_members` 테이블 조회로 교체.
- 좌석 클릭 시 즉시 예약 insert. `user_id`, `student_id`, `student_name`, `seat_number` 등 저장. 확인 메일은 세션의 `email`을 그대로 사용 (`USER_EMAILS` 조회 제거).
- 기존 예약이 있는 상태에서 다른 좌석 클릭 시 자동 이동(기존 취소 후 재예약) 로직은 `user_id` 기준으로 동일하게 유지.
- 블랙리스트 체크는 `student_id` 기준 그대로 유지(테이블/로직 변경 없음).

## 5. 취소/단체예매 플로우

- `/cancel`: 세션이 있으면 자동으로 `user_id` 기준 본인 예약을 조회해 보여준다. 학번/이름/비밀번호 재입력 폼은 삭제.
- `/group-confirm`: 그룹장은 세션으로 식별한다. 그룹원 추가 시 학번+이름만 입력받아 좌석을 확보하는 기존 흐름은 유지하되(그룹원은 본인이 직접 로그인하는 게 아니므로 비밀번호 필드는 원래도 없었음), 이름 대조용 명렬표 검증은 제거한다.

## 6. 키오스크 (`/print`, `app/api/kiosk`)

- 발권 화면 진입 잠금 비밀번호는 코드에 하드코딩("영화대교최고")된 현재 방식을 버리고 `kiosk_settings` 테이블에서 조회한다. `/admin`에서 관리자가 비밀번호를 변경하면 즉시 반영된다.
- `PRINT_TICKET` 액션: 기존 학생 비밀번호 검증(`verify_student_password` RPC 호출) 제거. 대신 학생이 학번+이름을 입력하면 `reservations`에서 일치하는 예약을 조회해 발권한다. 별도 구글 로그인은 키오스크에서 요구하지 않는다(현장 관리자 잠금으로 보호되는 공유 기기이므로).

## 7. 관리자 사이트 (`/admin`)

- 진입 시 구글 로그인을 요구한다. 로그인 후 세션 이메일이 `admins` 테이블에 없으면 "권한 없음" 화면을 보여주고 이후 API 호출을 막는다.
- `app/api/admin/action`을 비롯한 모든 관리자 API 라우트에서 `adminPassword` 바디 파라미터 검증을 제거하고, `Authorization: Bearer` 토큰 검증 + `admins` 테이블 조회로 교체한다.
- 관리 탭 추가: 관리자 목록(`admins`) CRUD, 동아리원(`club_members`) CRUD, 키오스크 잠금 비밀번호(`kiosk_settings`) 변경.
- 기존 기능(예매 내역, 강제 취소, 활동 로그, 블랙리스트, 영화 설정, 대량 메일 발송, 발권 초기화)은 그대로 유지하되 인증 계층만 교체.

## 8. 외부 사전 준비 (사용자가 직접 해야 하는 작업)

Claude가 접근할 수 없는 콘솔 작업이라 사용자가 직접 처리해야 한다. 구현 단계에서 순서대로 안내한다.

1. Google Cloud Console: OAuth 동의 화면 설정 + OAuth 2.0 클라이언트(Client ID/Secret) 생성, 승인된 리디렉션 URI에 Supabase 콜백 URL 등록.
2. Supabase 대시보드: Authentication > Providers > Google에 위 Client ID/Secret 입력 후 활성화.
3. DB 스키마 마이그레이션(2절 SQL) 적용: 사용자가 Supabase DB 연결 정보(connection string 또는 `project ref` + DB 비밀번호)를 제공하면 Claude가 `supabase` CLI로 직접 실행한다.

## 9. 마이그레이션 및 기존 데이터 처리

- 하드 컷오버: 전환 시점에 `reservations` 테이블을 `TRUNCATE`로 전부 비운다. 기존에도 상영 회차가 바뀔 때마다 테이블을 초기화하던 운영 방식이라, 과거 예약 이력을 보존할 필요가 없다는 전제다(이력 보존 기능은 이번 범위 밖, 추후 별도 작업).
- 동시에 `reservations.password` 컬럼을 `DROP COLUMN`으로 완전히 제거하고 `user_id` 컬럼을 `NOT NULL`로 추가한다.
- 컷오버 이후 예매/취소/단체예매/키오스크/관리자 페이지 전부 즉시 신규 인증 방식으로 전환한다(구버전과 병행 운영 없음).
- 전환 완료 후 확인되면 `student_auth` 테이블, `verify_student_password` RPC, `lib/emails.ts`, `STUDENT_LIST`/`STAFF_LIST`/`CLUB_MEMBERS` 배열, `reset-password` 페이지/API, `ADMIN_PASSWORD` 환경변수, 하드코딩된 키오스크 잠금 비밀번호 문자열을 삭제한다.

## 10. 리스크 / 열린 사항

- 구글 프로필 이름은 학생이 스스로 관리하므로, 오타나 형식 파괴(공백 위치, 학번 누락 등)로 파싱이 실패하거나 잘못된 학번으로 저장될 수 있다. 관리자 수동 수정 기능으로 완화하나, 완전한 자동 검증은 아니다.
- `hd` 쿼리 파라미터는 UI 힌트일 뿐이므로, 서버측 이메일 도메인 검증을 반드시 구현해야 한다(2절에 명시).
- Next.js 16.2.2는 저장소 내 커스텀 포크로, `AGENTS.md`에 따라 표준 Next.js와 API/컨벤션이 다를 수 있다. 구현 시작 전 `node_modules/next/dist/docs/`에서 인증/라우트 핸들러 관련 변경 사항을 확인해야 한다.
