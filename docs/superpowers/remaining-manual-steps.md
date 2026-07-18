# 남은 수동 작업 체크리스트 (신민규 님 직접 수행)

코드/DB 스키마 마이그레이션 파일 작성까지는 다 끝났습니다. 아래는 Claude가 접근할 수 없는
Supabase 대시보드 / Google Cloud Console / Vercel 대시보드에서 직접 해야 할 작업입니다.
순서대로 진행하세요.

---

## 0. 먼저: Supabase 프로젝트가 살아있는지 확인

이전 세션에서 `.env.local`에 적힌 프로젝트 URL(`mfpeyfqjjznwfdfdsfo.supabase.co`)이
DNS 조회 자체가 안 되는 상태였습니다(NXDOMAIN). 아래 순서로 확인해주세요.

1. https://supabase.com/dashboard 접속해서 해당 프로젝트가 목록에 있는지 확인.
2. 프로젝트가 "Paused"(일시정지) 상태면 "Restore project" 버튼으로 복구.
3. 프로젝트를 열고 **Project Settings → API**에서 "Project URL"과 "anon public" 키를 확인해서
   `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
   `SUPABASE_SERVICE_ROLE_KEY`와 일치하는지 대조. 다르면 `.env.local`을 최신 값으로 갱신.
4. 프로젝트 자체가 삭제된 경우 새로 만들어야 하며, 그 경우 아래 SQL 마이그레이션과
   Google OAuth 설정을 새 프로젝트 기준으로 다시 진행해야 합니다.

---

## 1. DB 마이그레이션 SQL 실행

**파일 위치:** `supabase/migrations/0001_google_auth.sql` (이미 저장소에 있음)

### 실행 방법
1. Supabase 대시보드 → 해당 프로젝트 → 왼쪽 메뉴 **SQL Editor** → "New query".
2. `supabase/migrations/0001_google_auth.sql` 파일 내용 전체를 복사해서 붙여넣기.
3. **Run** 클릭.

```sql
-- supabase/migrations/0001_google_auth.sql

-- =========================================================
-- 1. reservations 하드 컷오버: 기존 데이터 전부 삭제 후 스키마 변경
-- =========================================================
truncate table public.reservations;

alter table public.reservations
  add column user_id uuid,
  add column email text;

alter table public.reservations drop column if exists password;

-- =========================================================
-- 2. 신규 테이블
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  student_id text,
  name text not null,
  role text not null check (role in ('student', 'staff')),
  created_at timestamptz not null default now()
);

do $$
begin
  create unique index profiles_student_id_idx on public.profiles(student_id) where student_id is not null;
exception when duplicate_table then null;
end $$;

alter table public.reservations
  add constraint reservations_user_id_fkey foreign key (user_id) references public.profiles(id);

alter table public.reservations
  alter column user_id set not null,
  alter column email set not null;

create table if not exists public.admins (
  email text primary key,
  added_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  student_id text primary key,
  added_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.kiosk_settings (
  id int primary key default 1,
  password text not null,
  updated_at timestamptz not null default now(),
  constraint kiosk_settings_singleton check (id = 1)
);

-- =========================================================
-- 3. 부트스트랩 시드 데이터
-- =========================================================
insert into public.admins (email, added_by)
values ('ts250024@ts.hs.kr', 'migration')
on conflict (email) do nothing;

insert into public.kiosk_settings (id, password)
values (1, '영화대교최고')
on conflict (id) do nothing;

-- =========================================================
-- 4. 구시대 비밀번호 관련 객체 삭제
-- =========================================================
drop table if exists public.student_auth;

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('verify_student_password', 'cancel_reservation_secure', 'confirm_group_reservation')
  loop
    execute format('drop function if exists %s', fn.sig);
  end loop;
end $$;

-- =========================================================
-- 5. RLS 재설계
-- =========================================================
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('reservations', 'blacklist')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table public.reservations enable row level security;
alter table public.blacklist enable row level security;
alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.club_members enable row level security;
alter table public.kiosk_settings enable row level security;
alter table public.activity_logs enable row level security;

do $$ begin
  create policy reservations_select_authenticated on public.reservations
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy reservations_insert_authenticated on public.reservations
    for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy blacklist_select_authenticated on public.blacklist
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy club_members_select_authenticated on public.club_members
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy profiles_select_own on public.profiles
    for select to authenticated using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy profiles_insert_own on public.profiles
    for insert to authenticated with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy profiles_update_own on public.profiles
    for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy activity_logs_insert_authenticated on public.activity_logs
    for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

-- movie_settings: 기존 anon 정책은 그대로 두고, 로그인 후에도 읽히도록 authenticated용 정책을 추가만 한다(안전망).
do $$ begin
  create policy movie_settings_select_authenticated on public.movie_settings
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
```

> ⚠️ 1번 블록(`truncate table public.reservations`)이 기존 예약 데이터를 전부 지웁니다.
> 지워지면 안 되는 예약이 남아있다면 먼저 백업(Table Editor에서 CSV export 등)하세요.

### 적용 확인
SQL Editor에서 새 쿼리로 아래를 실행해서 확인하세요.

```sql
-- reservations에 user_id(not null)/email(not null) 컬럼 생기고 password 컬럼 없어야 함
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'reservations'
order by column_name;

-- 부트스트랩 관리자 1행 있어야 함
select * from public.admins;

-- 키오스크 기본 비밀번호 1행 있어야 함
select * from public.kiosk_settings;
```

---

## 2. Google Cloud Console — OAuth 동의 화면

1. https://console.cloud.google.com 접속, 새 프로젝트 생성(또는 기존 프로젝트 선택).
2. 왼쪽 메뉴 "API 및 서비스" → "OAuth 동의 화면" 이동.
3. User Type: "내부"(학교 Workspace 조직 내부용) 선택 가능하면 선택, 안 되면 "외부" + 게시 상태 "프로덕션".
4. 앱 이름: "영화대교 예매 시스템", 사용자 지원 이메일: 본인 학교 이메일 입력.
5. 승인된 도메인에 `ts.hs.kr`과 실제 서비스 배포 도메인(예: `hwip.vercel.app`)을 추가.

## 3. Google Cloud Console — OAuth 클라이언트 ID 생성

1. "API 및 서비스" → "사용자 인증 정보" → "+ 사용자 인증 정보 만들기" → "OAuth 클라이언트 ID".
2. 애플리케이션 유형: "웹 애플리케이션".
3. "승인된 리디렉션 URI"에 Supabase 콜백 URL 추가:
   `https://<Supabase 프로젝트 ref>.supabase.co/auth/v1/callback`
   (프로젝트 ref는 대시보드 URL 또는 Project Settings → API에서 확인)
4. 생성 후 나오는 "클라이언트 ID"와 "클라이언트 보안 비밀번호(secret)"를 복사해둔다.

## 4. Supabase 대시보드 — Google Provider 활성화

1. https://supabase.com/dashboard → 해당 프로젝트 → Authentication → Providers.
2. "Google" 항목을 찾아 활성화(Enable).
3. 3단계에서 복사한 Client ID / Client Secret을 붙여넣고 저장.
4. Authentication → URL Configuration에서 "Site URL"과 "Redirect URLs"에 실제 서비스 도메인
   (예: `https://<서비스 도메인>/**`)이 등록되어 있는지 확인. 없으면 추가.

## 5. Vercel 환경변수 정리

1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables.
2. `ADMIN_PASSWORD` 항목 삭제(더 이상 코드에서 쓰지 않음).
3. `.env.local`과 Vercel 환경변수 둘 다에 `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`가 최신 값으로 맞는지 확인.
4. 저장 후 재배포(Redeploy).

## 6. 최종 확인 (전체 흐름 수동 테스트)

- [ ] 배포된 사이트 `/`에서 구글 로그인 버튼 클릭 → `@ts.hs.kr` 계정으로 로그인 성공.
- [ ] 개인 Gmail 계정으로 시도 시 "🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다"
      알림과 함께 자동 로그아웃되는지 확인.
- [ ] 최초 로그인한 `@ts.hs.kr` 계정의 `profiles` 테이블에 학번/이름이 정확히 파싱되어
      생성됐는지 Supabase Table Editor에서 확인(이름이 "2208신민규" 형식이 아니면
      `student_id`가 null, `role`이 `staff`로 들어감 — 이 경우 관리자 페이지의
      "사용자 프로필 수정" 패널에서 고치면 됨).
- [ ] 좌석 선택 → 예매 확정 → 학교 메일로 티켓 도착.
- [ ] 방금 예매 취소 → 비밀번호 없이 바로 취소됨, 취소 메일 도착.
- [ ] 단체예매: 계정 A로 리더 시작 → 멤버 검색(로그인 이력 없는 학번은 검색 안 됨 정상) →
      계정 B 선택 → 완료 → 계정 B 메일함에 초대 도착 → 확정.
- [ ] `/admin`에 `ts250024@ts.hs.kr`로 로그인 → 정상 로드, 관리자/동아리원 추가·삭제,
      키오스크 비밀번호 변경, 블랙리스트 추가, 프로필 수정 모두 동작.
- [ ] 관리자로 등록 안 된 다른 `@ts.hs.kr` 계정으로 `/admin` 접속 시 "🚫 권한 없음" 화면.
- [ ] `/print`에서 방금 바꾼 키오스크 비밀번호로 진입 → 학번+이름으로 발권 → 영수증 출력,
      `is_printed`가 true로 바뀌는지 관리자 대시보드에서 확인.
