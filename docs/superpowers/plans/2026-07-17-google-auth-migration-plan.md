# Google 계정 통합 인증 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학번+이름 명렬표 대조 + 4자리 비밀번호(student_auth) + 수동 이메일 매핑(lib/emails.ts)으로 되어 있는 인증을, Supabase Auth + Google OAuth(`@ts.hs.kr` 도메인 제한)로 전면 교체한다. 예매/취소/단체예매/키오스크/관리자 사이트 전체가 대상.

**Architecture:** 클라이언트는 Supabase Auth(`@supabase/supabase-js`, 이미 설치돼 있음)로 구글 로그인하고, 최초 로그인 시 구글 프로필 이름(`"2208신민규"` 형식)을 파싱해 `profiles` 테이블에 학번/이름/역할을 자동 저장한다. 서버 API 라우트는 `Authorization: Bearer <access_token>` 헤더를 받아 `supabaseAdmin.auth.getUser(token)`으로 검증하는 방식으로 통일한다(기존 `adminPassword` 바디 파라미터 자리를 그대로 대체). 새 미들웨어나 `@supabase/ssr`은 도입하지 않는다 — 기존 코드가 전부 `"use client"` + `fetch`로 API를 호출하는 단순 구조이기 때문.

**Tech Stack:** Next.js 16.2.2 (App Router, Route Handlers), `@supabase/supabase-js` 2.101.1 (이미 설치됨, 추가 패키지 설치 없음), Supabase Postgres + Auth(Google Provider).

**참조 문서:** `docs/superpowers/specs/2026-07-17-google-auth-migration-design.md` (승인된 설계). 이 계획은 그 설계를 그대로 구현한다.

## Global Constraints

- 이 저장소에는 테스트 프레임워크가 전혀 없다(`package.json`에 jest/vitest/playwright 등 없음). 이 계획을 위해 새 테스트 러너를 들이는 것은 범위를 벗어난 인프라 추가라서 하지 않는다(Simplicity/YAGNI). 각 태스크의 "검증" 단계는 `curl` 명령 또는 브라우저 수동 조작으로 대체한다.
- 기존 코드 스타일을 따른다: 함수형 컴포넌트, `"use client"` 최상단, Tailwind 유틸리티 클래스 인라인, 에러 처리는 `try/catch` + `alert`/`showAlert`.
- Next.js는 이 저장소에 커스텀 포크가 설치되어 있을 수 있다는 경고가 `AGENTS.md`에 있다. Route Handler API는 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` 확인 결과 표준 App Router와 동일함을 이미 확인했다(POST/GET 시그니처, `NextResponse` 사용법 등 변경 없음).
- 모든 신규/수정 코드는 한국어 사용자 메시지(alert 텍스트 등) 스타일을 기존 코드와 동일하게 유지한다(이모지 포함, 존댓말).
- DB 마이그레이션은 Claude가 직접 `psql`로 실행한다 — 사용자가 Supabase DB 연결 문자열을 제공하면 실행. Google OAuth Provider 활성화는 사용자가 콘솔에서 직접 해야 한다(Task 15).

---

## Part A: 데이터베이스

### Task 1: DB 마이그레이션 SQL 작성 및 적용

**Files:**
- Create: `supabase/migrations/0001_google_auth.sql`

**Interfaces:**
- Produces: `profiles(id, email, student_id, name, role, created_at)`, `admins(email, added_by, created_at)`, `club_members(student_id, added_by, created_at)`, `kiosk_settings(id, password, updated_at)` 테이블. `reservations`에 `user_id uuid not null`, `email text not null` 컬럼 추가, `password` 컬럼 삭제. 이후 모든 태스크가 이 스키마를 전제로 코드를 작성한다.

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

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

- [ ] **Step 2: 사용자에게 Supabase DB 연결 문자열 요청**

사용자에게 Supabase 대시보드 → Project Settings → Database → Connection string(URI, `postgres://postgres:[PASSWORD]@...`)을 요청한다. 비밀번호가 포함된 민감정보이므로 받는 즉시 이 세션에서만 사용하고 파일로 저장하지 않는다.

- [ ] **Step 3: 마이그레이션 적용**

Run: `psql "<연결문자열>" -f supabase/migrations/0001_google_auth.sql`
Expected: 에러 없이 `ALTER TABLE`, `CREATE TABLE`, `INSERT 0 1`(또는 `ON CONFLICT`로 스킵) 등이 순서대로 출력됨.

- [ ] **Step 4: 적용 확인**

Run:
```bash
psql "<연결문자열>" -c "\d public.reservations" -c "select * from public.admins;" -c "select * from public.kiosk_settings;"
```
Expected: `reservations`에 `user_id`(not null), `email`(not null) 컬럼이 보이고 `password` 컬럼은 없음. `admins`에 `ts250024@ts.hs.kr` 1행, `kiosk_settings`에 `영화대교최고` 1행이 있음.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0001_google_auth.sql
git commit -m "$(cat <<'EOF'
feat: 구글 인증 전환용 DB 스키마 마이그레이션 추가

profiles/admins/club_members/kiosk_settings 테이블 신설, reservations에
user_id/email 컬럼 추가 및 password 컬럼 제거, 구 비밀번호 시스템
(student_auth 테이블 + RPC 3종) 삭제, RLS 정책 재설계.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part B: 공용 인증 헬퍼

### Task 2: 클라이언트 인증 헬퍼 `lib/supabase-auth.ts`

**Files:**
- Create: `lib/supabase-auth.ts`

**Interfaces:**
- Consumes: `lib/supabase.ts`의 `supabase`(기존 anon 클라이언트, 변경 없음)
- Produces: `AppProfile` 타입, `parseGoogleIdentity(fullName: string)`, `signInWithGoogle()`, `signOutAndClear()`, `ensureProfile(): Promise<AppProfile | null>`, `authFetch(url: string, body: any): Promise<Response>`(POST), `authFetchGet(url: string): Promise<Response>`(GET). 이후 모든 페이지 컴포넌트가 이 함수들을 그대로 가져다 쓴다.

- [ ] **Step 1: 파일 작성**

```ts
// lib/supabase-auth.ts
import { supabase } from './supabase';

export type AppProfile = {
  id: string;
  email: string;
  student_id: string | null;
  name: string;
  role: 'student' | 'staff';
};

export function parseGoogleIdentity(fullName: string): { student_id: string | null; name: string; role: 'student' | 'staff' } {
  const cleaned = fullName.trim();
  const match = cleaned.match(/^(\d{4})\s?(.+)$/);
  if (match && match[2].trim().length > 0) {
    return { student_id: match[1], name: match[2].trim(), role: 'student' };
  }
  return { student_id: null, name: cleaned, role: 'staff' };
}

export async function signInWithGoogle(redirectPath?: string) {
  const redirectTo = `${window.location.origin}${redirectPath ?? window.location.pathname + window.location.search}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { queryParams: { hd: 'ts.hs.kr' }, redirectTo }
  });
  if (error) throw error;
}

export async function signOutAndClear() {
  await supabase.auth.signOut();
}

export class DomainNotAllowedError extends Error {
  constructor() { super('DOMAIN_NOT_ALLOWED'); this.name = 'DomainNotAllowedError'; }
}

// 세션이 있으면 profiles 행을 반환한다. 최초 로그인이면 구글 이름을 파싱해 생성한다.
// @ts.hs.kr 도메인이 아니면 즉시 로그아웃시키고 DomainNotAllowedError를 던진다.
export async function ensureProfile(): Promise<AppProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const email = session.user.email ?? '';
  if (!email.toLowerCase().endsWith('@ts.hs.kr')) {
    await supabase.auth.signOut();
    throw new DomainNotAllowedError();
  }

  const { data: existing } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (existing) return existing as AppProfile;

  const fullName = (session.user.user_metadata?.full_name || session.user.user_metadata?.name || email) as string;
  const identity = parseGoogleIdentity(fullName);

  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ id: session.user.id, email, ...identity })
    .select('*')
    .single();

  if (error) throw error;
  return created as AppProfile;
}

// 관리자/키오스크 API 등 인증이 필요한 POST 요청에 access token을 실어 보낸다.
export async function authFetch(url: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`
    },
    body: JSON.stringify(body)
  });
}

// 인증이 필요한 GET 요청용 (예: 사용자 검색).
export async function authFetchGet(url: string) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }
  });
}
```

- [ ] **Step 2: 타입 체크로 문법 확인**

Run: `npx tsc --noEmit lib/supabase-auth.ts 2>&1 | head -30`
Expected: `lib/supabase.ts`를 못 찾는다는 모듈 관련 에러 외에 `supabase-auth.ts` 자체의 문법/타입 에러가 없어야 함(프로젝트 전체 `tsc`는 Task 14까지 끝난 뒤 Task 16에서 한 번에 돌린다).

- [ ] **Step 3: 커밋**

```bash
git add lib/supabase-auth.ts
git commit -m "$(cat <<'EOF'
feat: 구글 로그인/프로필 프로비저닝 클라이언트 헬퍼 추가

signInWithGoogle, ensureProfile(최초 로그인 시 구글 이름에서 학번/이름
파싱해 profiles 자동 생성), authFetch(Bearer 토큰 첨부) 등 이후
모든 페이지가 공통으로 쓸 인증 유틸리티.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 3: 서버 인증 헬퍼 `lib/api-auth.ts`

**Files:**
- Create: `lib/api-auth.ts`

**Interfaces:**
- Consumes: `lib/supabase-admin.ts`의 `supabaseAdmin`
- Produces: `getUserFromRequest(req: Request): Promise<User | null>`, `requireAdmin(req: Request): Promise<{ok: true, user: User} | {ok: false, status: number, error: string}>`.이후 모든 API 라우트(Task 4~7, 12)가 이 함수들을 가져다 쓴다.

- [ ] **Step 1: 파일 작성**

```ts
// lib/api-auth.ts
import { supabaseAdmin } from './supabase-admin';
import type { User } from '@supabase/supabase-js';

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  if (!data.user.email?.toLowerCase().endsWith('@ts.hs.kr')) return null;

  return data.user;
}

type AdminCheckResult =
  | { ok: true; user: User }
  | { ok: false; status: number; error: string };

export async function requireAdmin(req: Request): Promise<AdminCheckResult> {
  const user = await getUserFromRequest(req);
  if (!user) return { ok: false, status: 401, error: '로그인이 필요합니다.' };

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('email')
    .eq('email', user.email as string)
    .maybeSingle();

  if (!admin) return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
  return { ok: true, user };
}
```

- [ ] **Step 2: 커밋**

```bash
git add lib/api-auth.ts
git commit -m "$(cat <<'EOF'
feat: API 라우트용 Bearer 토큰 검증 서버 헬퍼 추가

getUserFromRequest로 세션 검증(+@ts.hs.kr 도메인 재확인),
requireAdmin으로 admins 테이블 조회까지 포함한 관리자 권한 체크.
기존 adminPassword 바디 파라미터 검증 자리를 대체한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part C: API 라우트

### Task 4: 사용자 검색 API `app/api/profiles/search/route.ts` (단체예매 초대용)

**Files:**
- Create: `app/api/profiles/search/route.ts`

**Interfaces:**
- Consumes: `getUserFromRequest`(Task 3)
- Produces: `GET /api/profiles/search?q=검색어` → `{ success: true, results: { id: string, student_id: string|null, name: string }[] }`. `email` 필드는 절대 포함하지 않는다. Task 14(`app/page.tsx`의 단체 멤버 검색 UI)가 이 응답 형태를 그대로 사용한다.

- [ ] **Step 1: 파일 작성**

```ts
// app/api/profiles/search/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserFromRequest } from '@/lib/api-auth';

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });

  const url = new URL(req.url);
  const rawQ = url.searchParams.get('q') || '';
  // PostgREST .or() 필터 문자열에 그대로 들어가므로 위험 문자를 제거한다.
  const q = rawQ.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim().slice(0, 20);
  if (q.length < 1) return NextResponse.json({ success: true, results: [] });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, student_id, name')
    .neq('id', user.id)
    .or(`name.ilike.%${q}%,student_id.eq.${q}`)
    .limit(10);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, results: data });
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/profiles/search/route.ts
git commit -m "$(cat <<'EOF'
feat: 로그인한 사용자 검색 API 추가 (단체예매 초대용)

이름/학번으로 profiles를 검색해 id/student_id/name만 반환한다.
email은 절대 클라이언트에 노출하지 않는다(익명 스크레이핑 방지).
아직 한 번도 로그인한 적 없는 사람은 검색 결과에 뜨지 않는다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 5: 관리자 API `app/api/admin/action/route.ts` 재작성

**Files:**
- Modify: `app/api/admin/action/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `requireAdmin`(Task 3)
- Produces: 기존 액션(`FETCH_INITIAL_DATA`, `UPDATE_SETTINGS`, `CLEAR_RESERVATIONS`, `APPROVE_RESERVATION`, `CANCEL_RESERVATION`, `RESET_PRINT`, `ADD_BLACKLIST`, `REMOVE_BLACKLIST`)는 페이로드 그대로 유지. `LOGIN`, `LOG_ACTION`(promo 전용이라 죽은 코드가 됨) 액션은 삭제. 신규 액션: `LIST_ADMINS`, `ADD_ADMIN`, `REMOVE_ADMIN`, `LIST_CLUB_MEMBERS`, `ADD_CLUB_MEMBER`, `REMOVE_CLUB_MEMBER`, `SEARCH_PROFILE`, `UPDATE_PROFILE`(구글 이름 파싱이 잘못된 사용자의 학번/이름/역할을 관리자가 수정 — spec 2절/10절), `UPDATE_KIOSK_PASSWORD` 추가. `FETCH_INITIAL_DATA` 응답에 `adminData`, `clubData`, `kioskPassword` 필드 추가. Task 20~23(`app/admin/page.tsx`)이 이 액션들을 그대로 호출한다.

- [ ] **Step 1: 파일 전체 교체**

```ts
// app/api/admin/action/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api-auth';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const adminEmail = auth.user.email as string;

    const { action, payload } = await req.json();

    switch (action) {
      case 'FETCH_INITIAL_DATA': {
        const { data: movieData, error: e1 } = await supabaseAdmin.from('movie_settings').select('*').eq('id', 1).single();
        if (e1) throw e1;

        const [resQ, blQ, logQ, adminQ, clubQ, kioskQ] = await Promise.all([
          supabaseAdmin.from('reservations')
            .select('id, seat_number, payment_status, student_name, student_id, email, popcorn_order, is_printed, is_group_leader')
            .eq('movie_date', movieData?.db_date)
            .order('created_at', { ascending: false }),
          supabaseAdmin.from('blacklist').select('student_id, student_name').order('created_at', { ascending: false }),
          supabaseAdmin.from('activity_logs').select('id, created_at, student_id, student_name, description').order('created_at', { ascending: false }).limit(100),
          supabaseAdmin.from('admins').select('email, added_by, created_at').order('created_at', { ascending: false }),
          supabaseAdmin.from('club_members').select('student_id, added_by, created_at').order('created_at', { ascending: false }),
          supabaseAdmin.from('kiosk_settings').select('password').eq('id', 1).single()
        ]);

        if (resQ.error) throw resQ.error;
        if (blQ.error) throw blQ.error;
        if (logQ.error) throw logQ.error;
        if (adminQ.error) throw adminQ.error;
        if (clubQ.error) throw clubQ.error;
        if (kioskQ.error) throw kioskQ.error;

        return NextResponse.json({
          success: true,
          data: {
            movieData, resData: resQ.data, blData: blQ.data, logData: logQ.data,
            adminData: adminQ.data, clubData: clubQ.data, kioskPassword: kioskQ.data?.password ?? ''
          }
        });
      }

      case 'UPDATE_SETTINGS': {
        const { error } = await supabaseAdmin.from('movie_settings').update(payload).eq('id', 1);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'CLEAR_RESERVATIONS': {
        const { movieDate } = payload;
        const { error } = await supabaseAdmin.from('reservations').delete().eq('movie_date', movieDate);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'APPROVE_RESERVATION': {
        const { id, studentId, studentName, seatNumber } = payload;
        const { error: updateError } = await supabaseAdmin.from('reservations').update({ payment_status: 'confirmed' }).eq('id', id);
        if (updateError) throw updateError;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: studentId, student_name: studentName,
          description: `관리자 승인 (${seatNumber})`
        }]);

        return NextResponse.json({ success: true });
      }

      case 'CANCEL_RESERVATION': {
        const { id, studentId, studentName, seatNumber, description } = payload;
        const { error: deleteError } = await supabaseAdmin.from('reservations').delete().eq('id', id);
        if (deleteError) throw deleteError;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: studentId, student_name: studentName,
          description: description || `관리자 강제 취소 (${seatNumber})`
        }]);

        return NextResponse.json({ success: true });
      }

      case 'RESET_PRINT': {
        const { id, studentId, studentName, seatNumber } = payload;
        const { error } = await supabaseAdmin.from('reservations').update({ is_printed: false }).eq('id', id);
        if (error) throw error;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: studentId, student_name: studentName,
          description: `관리자 티켓 발권 상태 초기화 (${seatNumber})`
        }]);

        return NextResponse.json({ success: true });
      }

      case 'ADD_BLACKLIST': {
        const { studentId, studentName, movieDate } = payload;

        const { error: blError } = await supabaseAdmin.from('blacklist').insert([{ student_id: studentId, student_name: studentName }]);
        if (blError) throw blError;

        const { data: existingTickets } = await supabaseAdmin.from('reservations')
          .select('*')
          .eq('student_id', studentId)
          .eq('movie_date', movieDate);

        let canceledTicket = null;
        if (existingTickets && existingTickets.length > 0) {
          canceledTicket = existingTickets[0];
          await supabaseAdmin.from('reservations').delete().eq('id', canceledTicket.id);
          await supabaseAdmin.from('activity_logs').insert([{
            student_id: studentId, student_name: studentName,
            description: `블랙리스트 등록 및 예매 자동 취소 (${canceledTicket.seat_number})`
          }]);
        }

        // 취소된 예약이 없으면(아직 로그인/예매한 적 없는 학생 선제 등록), profiles에서 이메일을 찾아본다.
        // 둘 다 없으면 안내 메일 발송은 그냥 건너뛴다(email: null).
        let email: string | null = canceledTicket?.email ?? null;
        if (!email) {
          const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('student_id', studentId).maybeSingle();
          email = prof?.email ?? null;
        }

        return NextResponse.json({ success: true, canceledTicket, email });
      }

      case 'REMOVE_BLACKLIST': {
        const { studentId } = payload;
        const { error } = await supabaseAdmin.from('blacklist').delete().eq('student_id', studentId);
        if (error) throw error;

        const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('student_id', studentId).maybeSingle();
        return NextResponse.json({ success: true, email: prof?.email ?? null });
      }

      case 'LIST_ADMINS': {
        const { data, error } = await supabaseAdmin.from('admins').select('email, added_by, created_at').order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'ADD_ADMIN': {
        const { email } = payload;
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail.endsWith('@ts.hs.kr')) {
          return NextResponse.json({ success: false, error: '@ts.hs.kr 이메일만 등록할 수 있습니다.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('admins').insert([{ email: cleanEmail, added_by: adminEmail }]);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'REMOVE_ADMIN': {
        const { email } = payload;
        if (email === adminEmail) {
          return NextResponse.json({ success: false, error: '본인 계정은 스스로 제거할 수 없습니다.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('admins').delete().eq('email', email);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'LIST_CLUB_MEMBERS': {
        const { data, error } = await supabaseAdmin.from('club_members').select('student_id, added_by, created_at').order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'ADD_CLUB_MEMBER': {
        const { studentId } = payload;
        const cleanId = String(studentId || '').trim();
        if (!/^\d{4}$/.test(cleanId)) {
          return NextResponse.json({ success: false, error: '학번은 4자리 숫자여야 합니다.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('club_members').insert([{ student_id: cleanId, added_by: adminEmail }]);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'REMOVE_CLUB_MEMBER': {
        const { studentId } = payload;
        const { error } = await supabaseAdmin.from('club_members').delete().eq('student_id', studentId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'SEARCH_PROFILE': {
        const { query } = payload;
        const q = String(query || '').replace(/[^a-zA-Z0-9가-힣.@_\-\s]/g, '').trim().slice(0, 40);
        if (!q) return NextResponse.json({ success: true, data: [] });
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('id, email, student_id, name, role')
          .or(`email.ilike.%${q}%,name.ilike.%${q}%,student_id.eq.${q}`)
          .limit(10);
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'UPDATE_PROFILE': {
        const { id, studentId, name, role } = payload;
        if (!['student', 'staff'].includes(role)) {
          return NextResponse.json({ success: false, error: 'role은 student 또는 staff여야 합니다.' }, { status: 400 });
        }
        const cleanStudentId = role === 'staff' ? null : String(studentId || '').trim();
        if (role === 'student' && !/^\d{4}$/.test(cleanStudentId || '')) {
          return NextResponse.json({ success: false, error: '학생은 학번 4자리가 필요합니다.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('profiles')
          .update({ student_id: cleanStudentId, name: String(name || '').trim(), role })
          .eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'UPDATE_KIOSK_PASSWORD': {
        const { password } = payload;
        const cleanPassword = String(password || '').trim();
        if (!cleanPassword) {
          return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('kiosk_settings').update({ password: cleanPassword, updated_at: new Date().toISOString() }).eq('id', 1);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Admin API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/admin/action/route.ts
git commit -m "$(cat <<'EOF'
feat: 관리자 API 인증을 adminPassword에서 Bearer 토큰으로 전환

requireAdmin으로 모든 액션 진입점을 통일. LOGIN/LOG_ACTION(promo
전용) 액션 제거. 관리자/동아리원/키오스크 비밀번호를 DB로 관리하는
신규 액션(LIST/ADD/REMOVE_ADMIN, LIST/ADD/REMOVE_CLUB_MEMBER,
UPDATE_KIOSK_PASSWORD) 추가.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 6: 키오스크 API `app/api/kiosk/route.ts` 재작성

**Files:**
- Modify: `app/api/kiosk/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `supabaseAdmin`(기존)
- Produces: 신규 액션 `KIOSK_LOGIN` (`payload: { password }` → `kiosk_settings.password`와 비교). `PRINT_TICKET`은 `password` 필드를 페이로드에서 받지 않고 `studentId`+`studentName`으로만 예약을 조회한다. `UPDATE_GROUP_POPCORN` 액션은 삭제(Task 8의 `/api/reservations` `CONFIRM_GROUP`이 대체). Task 13(`app/print/page.tsx`)이 `KIOSK_LOGIN`/`PRINT_TICKET`을 호출한다.

- [ ] **Step 1: 파일 전체 교체**

```ts
// app/api/kiosk/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json();

    if (action === 'KIOSK_LOGIN') {
      const { password } = payload;
      const { data: settings, error } = await supabaseAdmin.from('kiosk_settings').select('password').eq('id', 1).single();
      if (error) throw error;

      if (!settings || settings.password !== password) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Invalid kiosk password' }, { status: 401 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'PRINT_TICKET') {
      const { ticketId, studentId, studentName, seatNumber } = payload;

      const { data: ticket, error: fetchError } = await supabaseAdmin.from('reservations')
        .select('id, student_id, student_name')
        .eq('id', ticketId)
        .single();

      if (fetchError || !ticket || ticket.student_id !== studentId || ticket.student_name !== studentName) {
        return NextResponse.json({ success: false, error: 'Unauthorized: 학번/이름이 예약 내역과 일치하지 않습니다.' }, { status: 401 });
      }

      const { error: e1 } = await supabaseAdmin.from('reservations').update({ is_printed: true }).eq('id', ticketId);
      if (e1) throw e1;

      const { error: e2 } = await supabaseAdmin.from('activity_logs').insert([{
        student_id: studentId,
        student_name: studentName,
        description: `현장 KIOSK 티켓 발권 완료 (${seatNumber})`
      }]);
      if (e2) throw e2;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Kiosk API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/kiosk/route.ts
git commit -m "$(cat <<'EOF'
feat: 키오스크 잠금/발권 인증을 비밀번호 없는 방식으로 전환

KIOSK_LOGIN 액션 추가(kiosk_settings 테이블 값과 비교, 하드코딩
문자열 제거). PRINT_TICKET은 학번+이름이 예약 내역과 일치하는지만
확인한다(비밀번호 검증 RPC 제거). UPDATE_GROUP_POPCORN은
/api/reservations CONFIRM_GROUP으로 통합되어 제거.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 7: 단체예매 자동 정리 크론 `app/api/cron/group-check/route.ts` 수정

**Files:**
- Modify: `app/api/cron/group-check/route.ts:100-108` (`getEmail` 함수만 교체)

**Interfaces:**
- Consumes: 없음(기존 `reservation.email` 컬럼, Task 1에서 추가됨)
- Produces: `getEmail(reservation)`이 더 이상 `lib/emails.ts`를 참조하지 않음.

- [ ] **Step 1: `getEmail` 함수 교체**

기존(라인 100-108):
```ts
function getEmail(reservation: any): string | null {
  // 학번→이메일 매핑은 서버에서 직접 접근하기 어려우므로 간접 구현
  // USER_EMAILS를 여기서도 사용
  try {
    const { USER_EMAILS } = require('@/lib/emails');
    const key = reservation.student_id === "교직원" ? reservation.student_name : reservation.student_id;
    return USER_EMAILS[key] || null;
  } catch { return null; }
}
```

교체 후:
```ts
function getEmail(reservation: any): string | null {
  return reservation.email || null;
}
```

- [ ] **Step 2: 이 함수를 호출하는 `select('*')` 쿼리들이 `email` 컬럼을 포함하는지 확인**

Run: `grep -n "\.select(" app/api/cron/group-check/route.ts`
Expected: 모든 `reservations` 조회가 `select('*')`이므로 `email` 컬럼이 자동으로 포함됨(별도 수정 불필요, 확인만).

- [ ] **Step 3: 커밋**

```bash
git add app/api/cron/group-check/route.ts
git commit -m "$(cat <<'EOF'
fix: 단체예매 정리 크론에서 USER_EMAILS 대신 reservations.email 사용

lib/emails.ts 삭제를 앞두고, 만료 리포트/취소 메일 발송 시 이메일을
찾던 자리를 예약 행에 저장된 email 컬럼으로 교체.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 8: 본인 예약 조작 API `app/api/reservations/route.ts` 신설

기존에는 비밀번호를 아는 사람이면 누구나(RPC `cancel_reservation_secure`/`confirm_group_reservation`) 취소/확정할 수 있었다. 이제는 "로그인한 세션의 `user_id`가 예약의 `user_id`와 일치하는가"로 소유권을 검증한다. 단체예매 생성(리더+멤버 좌석 동시 확보)도 여기서 처리한다 — 멤버의 실제 이메일은 `profiles`에서 서버가 직접 조회하므로, 클라이언트(리더)는 멤버 이메일을 알 필요도, 알 수도 없다.

**Files:**
- Create: `app/api/reservations/route.ts`

**Interfaces:**
- Consumes: `getUserFromRequest`(Task 3)
- Produces:
  - `POST { action: 'CREATE_GROUP', payload: { movieDate, leaderSeat, memberSeats: {profileId, seat}[], groupId, expiresAt } }` → `{ success, leaderTicket, memberTickets }`
  - `POST { action: 'CANCEL_OWN', payload: { reservationId } }` → `{ success, ticket }`
  - `POST { action: 'CONFIRM_GROUP', payload: { reservationId, popcornOrder } }` → `{ success, ticket }`
  - `POST { action: 'LEAVE_GROUP', payload: { reservationId } }` → `{ success }`
  Task 15(`app/page.tsx`의 `handleGroupFinalize`), Task 17(`app/cancel/page.tsx`), Task 18(`app/group-confirm/page.tsx`)이 이 액션들을 호출한다.

- [ ] **Step 1: 파일 작성**

```ts
// app/api/reservations/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserFromRequest } from '@/lib/api-auth';

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });

    const { action, payload } = await req.json();

    switch (action) {
      case 'CREATE_GROUP': {
        const { movieDate, leaderSeat, memberSeats, groupId, expiresAt } = payload as {
          movieDate: string; leaderSeat: string;
          memberSeats: { profileId: string; seat: string }[];
          groupId: string; expiresAt: string;
        };

        const { data: leaderProfile, error: leaderProfileError } = await supabaseAdmin
          .from('profiles').select('*').eq('id', user.id).single();
        if (leaderProfileError || !leaderProfile) {
          return NextResponse.json({ success: false, error: '프로필을 찾을 수 없습니다.' }, { status: 400 });
        }

        const { data: leaderTicket, error: leaderError } = await supabaseAdmin.from('reservations').insert([{
          movie_date: movieDate, user_id: leaderProfile.id, student_id: leaderProfile.student_id,
          student_name: leaderProfile.name, email: leaderProfile.email, seat_number: leaderSeat,
          popcorn_order: 'none', payment_status: 'confirmed', group_id: groupId,
          is_group_leader: true, group_expires_at: expiresAt
        }]).select('*').single();
        if (leaderError) {
          return NextResponse.json({ success: false, error: '리더 좌석 예매 중 오류가 발생했습니다.\n(이미 선점된 좌석일 수 있습니다.)' }, { status: 400 });
        }

        const memberProfileIds = memberSeats.map(m => m.profileId);
        const { data: memberProfiles, error: memberProfileError } = await supabaseAdmin
          .from('profiles').select('*').in('id', memberProfileIds);
        if (memberProfileError) throw memberProfileError;

        const profileById = new Map((memberProfiles || []).map(p => [p.id, p]));
        const memberInserts = memberSeats.map(m => {
          const p = profileById.get(m.profileId);
          return {
            movie_date: movieDate, user_id: m.profileId, student_id: p?.student_id ?? null,
            student_name: p?.name ?? '', email: p?.email ?? '', seat_number: m.seat,
            popcorn_order: 'none', payment_status: 'group_pending', group_id: groupId,
            is_group_leader: false, group_expires_at: expiresAt
          };
        });

        const { data: memberTickets, error: memberError } = await supabaseAdmin.from('reservations')
          .insert(memberInserts).select('id, student_id, student_name, seat_number');
        if (memberError) {
          await supabaseAdmin.from('reservations').delete().eq('id', leaderTicket.id);
          return NextResponse.json({ success: false, error: '멤버 좌석 예매 중 오류가 발생했습니다.\n(이미 선점된 좌석이 포함되어 있을 수 있습니다.)' }, { status: 400 });
        }

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: leaderProfile.student_id, student_name: leaderProfile.name,
          description: `단체 예매 생성 (리더: ${leaderSeat}, 멤버 ${memberSeats.length}명)`
        }]);

        return NextResponse.json({ success: true, leaderTicket, memberTickets });
      }

      case 'CANCEL_OWN': {
        const { reservationId } = payload;
        const { data: ticket, error: fetchError } = await supabaseAdmin.from('reservations').select('*').eq('id', reservationId).single();
        if (fetchError || !ticket) return NextResponse.json({ success: false, error: '존재하지 않거나 이미 취소된 예매 내역입니다.' }, { status: 404 });
        if (ticket.user_id !== user.id) return NextResponse.json({ success: false, error: '본인 예약만 취소할 수 있습니다.' }, { status: 403 });

        const { error: deleteError } = await supabaseAdmin.from('reservations').delete().eq('id', reservationId);
        if (deleteError) throw deleteError;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: ticket.student_id, student_name: ticket.student_name,
          description: `본인 예매 취소 (${ticket.seat_number})`
        }]);

        return NextResponse.json({ success: true, ticket });
      }

      case 'CONFIRM_GROUP': {
        const { reservationId, popcornOrder } = payload;
        const { data: ticket, error: fetchError } = await supabaseAdmin.from('reservations').select('*').eq('id', reservationId).single();
        if (fetchError || !ticket) return NextResponse.json({ success: false, error: '존재하지 않거나 이미 처리된 초대입니다.' }, { status: 404 });
        if (ticket.user_id !== user.id) return NextResponse.json({ success: false, error: '본인 초대만 확정할 수 있습니다.' }, { status: 403 });
        if (ticket.payment_status !== 'group_pending') return NextResponse.json({ success: false, error: '이미 처리된 초대입니다.' }, { status: 400 });
        if (ticket.group_expires_at && new Date(ticket.group_expires_at) < new Date()) {
          return NextResponse.json({ success: false, error: '초대 시간이 만료되었습니다.' }, { status: 400 });
        }

        const finalStatus = popcornOrder && popcornOrder !== 'none' ? 'pending' : 'confirmed';
        const { data: updated, error: updateError } = await supabaseAdmin.from('reservations')
          .update({ popcorn_order: popcornOrder || 'none', payment_status: finalStatus })
          .eq('id', reservationId)
          .select('*').single();
        if (updateError) throw updateError;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: ticket.student_id, student_name: ticket.student_name,
          description: popcornOrder && popcornOrder !== 'none'
            ? `단체 예매 확정 + 팝콘 주문 (${ticket.seat_number})`
            : `단체 예매 확정 (${ticket.seat_number})`
        }]);

        return NextResponse.json({ success: true, ticket: updated });
      }

      case 'LEAVE_GROUP': {
        const { reservationId } = payload;
        const { data: ticket, error: fetchError } = await supabaseAdmin.from('reservations').select('*').eq('id', reservationId).single();
        if (fetchError || !ticket) return NextResponse.json({ success: false, error: '존재하지 않거나 이미 처리된 초대입니다.' }, { status: 404 });
        if (ticket.user_id !== user.id) return NextResponse.json({ success: false, error: '본인 초대만 거절할 수 있습니다.' }, { status: 403 });

        const { error: deleteError } = await supabaseAdmin.from('reservations').delete().eq('id', reservationId);
        if (deleteError) throw deleteError;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: ticket.student_id, student_name: ticket.student_name,
          description: `단체 예매 거절 (${ticket.seat_number})`
        }]);

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Reservations API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/reservations/route.ts
git commit -m "$(cat <<'EOF'
feat: 본인 예약 조작 API 신설 (비밀번호 RPC 대체)

세션의 user_id와 예약의 user_id 일치 여부로 소유권을 검증하는
CANCEL_OWN/CONFIRM_GROUP/LEAVE_GROUP 액션을 추가해
cancel_reservation_secure/confirm_group_reservation RPC를 대체한다.
CREATE_GROUP은 단체예매 생성 시 멤버 이메일을 서버가 profiles에서
직접 조회해 채운다(클라이언트는 다른 사람 이메일을 알 수 없음).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 9: 단체초대 메일 API `app/api/group-invite/route.ts` — 이메일을 서버에서 직접 조회하도록 변경

리더의 브라우저는 멤버의 이메일을 모른다(Task 4의 검색 API가 이메일을 절대 안 내려주므로). 그래서 이 라우트가 각 멤버의 `reservationId`(=`memberId`)로 `reservations.email`을 직접 조회하도록 바꾼다.

**Files:**
- Modify: `app/api/group-invite/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `supabaseAdmin`(기존)
- Produces: 요청 바디에서 `members[].email` 필드가 사라짐(대신 서버가 `memberId`로 조회). Task 15(`app/page.tsx`)의 `handleGroupFinalize`가 이 계약에 맞춰 `email` 없이 호출한다.

- [ ] **Step 1: 파일 상단 로직 교체**

기존:
```ts
export async function POST(req: Request) {
  try {
    const { members, leaderName, movieTitle, movieDate, groupId, baseUrl } = await req.json();

    const { transporter, user: senderUser } = getTransporter();

    const sendPromises = members.map((member: { email: string, name: string, seat: string, studentId: string, memberId: string }) => {
      if (!member.email) return Promise.resolve();

      const confirmUrl = `${baseUrl}/group-confirm?groupId=${groupId}&memberId=${member.memberId}`;
```

교체 후:
```ts
export async function POST(req: Request) {
  try {
    const { members, leaderName, movieTitle, movieDate, groupId, baseUrl } = await req.json();

    const { transporter, user: senderUser } = getTransporter();

    const memberIds = members.map((m: { memberId: string }) => m.memberId);
    const { data: rows } = await supabaseAdmin.from('reservations').select('id, email').in('id', memberIds);
    const emailByMemberId = new Map((rows || []).map((r: any) => [r.id, r.email]));

    const sendPromises = members.map((member: { name: string, seat: string, studentId: string, memberId: string }) => {
      const email = emailByMemberId.get(member.memberId);
      if (!email) return Promise.resolve();

      const confirmUrl = `${baseUrl}/group-confirm?groupId=${groupId}&memberId=${member.memberId}`;
```

- [ ] **Step 2: `sendMail`의 `to: member.email`을 `to: email`로 교체**

기존(파일 끝부분):
```ts
      return transporter.sendMail({
        from: `"영화대교 예매시스템" <${senderUser}>`,
        to: member.email,
        subject: `[영화대교] 🎬 ${member.name}님, 단체 관람에 초대되었습니다 - ${member.seat} 좌석`,
        html: htmlContent
      });
    });
```

교체 후:
```ts
      return transporter.sendMail({
        from: `"영화대교 예매시스템" <${senderUser}>`,
        to: email,
        subject: `[영화대교] 🎬 ${member.name}님, 단체 관람에 초대되었습니다 - ${member.seat} 좌석`,
        html: htmlContent
      });
    });
```

- [ ] **Step 3: import 추가**

파일 최상단 `import { getTransporter } from '@/lib/mailer';` 다음 줄에 추가:
```ts
import { supabaseAdmin } from '@/lib/supabase-admin';
```

- [ ] **Step 4: 커밋**

```bash
git add app/api/group-invite/route.ts
git commit -m "$(cat <<'EOF'
fix: 단체초대 메일 발송 시 이메일을 서버에서 직접 조회

리더 클라이언트는 멤버 이메일을 알 수 없으므로(검색 API가 email을
내려주지 않음), reservations.email을 memberId로 서버가 직접 조회해
발송하도록 변경.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part D: 예매 페이지 (`app/page.tsx`)

이 파일은 1194줄이며 좌석 배치도/팝콘/단체예매 UI 대부분은 이번 변경과 무관하다. 아래 태스크들은 인증 관련 부분만 정확히 짚어 수정한다(전체 재작성 아님). 각 스텝의 "기존"/"교체 후" 블록은 `Edit` 도구의 `old_string`/`new_string`처럼 그대로 옮기면 된다.

### Task 10: `app/page.tsx` — import/상태/로그인 게이트

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `ensureProfile`, `signInWithGoogle`, `authFetch`, `AppProfile`, `DomainNotAllowedError`(Task 2)
- Produces: 컴포넌트 최상위에 `profile: AppProfile | null`, `authLoading: boolean`, `clubMemberIds: string[]` 상태. 이후 Task 11(handleSubmit 등)이 `profile`을 그대로 사용한다.

- [ ] **Step 1: import 교체**

기존(라인 1-10):
```tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { USER_EMAILS } from '../lib/emails';
import Link from 'next/link'; // 🌟[추가] Next.js Link 임포트


import { STUDENT_LIST, STAFF_LIST, CLUB_MEMBERS } from '../lib/constants';
import AccountInfo from '@/components/AccountInfo';
```

교체 후:
```tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ensureProfile, signInWithGoogle, authFetch, DomainNotAllowedError, type AppProfile } from '../lib/supabase-auth';
import Link from 'next/link'; // 🌟[추가] Next.js Link 임포트

import AccountInfo from '@/components/AccountInfo';
```

- [ ] **Step 2: `formData`/`showResetButton`/`isResetting` state 제거, 인증 상태 추가**

기존(라인 41-44):
```tsx
  const[formData, setFormData] = useState({ studentId: '', name: '', password: '' });
  
  const[showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
```

교체 후:
```tsx
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clubMemberIds, setClubMemberIds] = useState<string[]>([]);
```

- [ ] **Step 3: `handleSeatClick`의 그룹모드 VIP 체크에서 `CLUB_MEMBERS` 교체**

`handleSubmit`/`handleGroupStart`/`handleAddGroupMember`는 각각 Task 12/13/14에서 함수 전체를 교체하며 `clubMemberIds`를 직접 쓰도록 다시 쓰므로, 여기서는 그 세 곳을 제외한 나머지 한 곳만 고친다.

기존(라인 231):
```tsx
      if (vipSeats.has(seatId) && groupLeader && !CLUB_MEMBERS.includes(groupLeader.studentId)) {
```
교체 후:
```tsx
      if (vipSeats.has(seatId) && groupLeader && (!groupLeader.studentId || !clubMemberIds.includes(groupLeader.studentId))) {
```

Run: `grep -n "CLUB_MEMBERS" app/page.tsx` (Task 12~14까지 모두 끝난 뒤 다시 실행)
Expected: 아무 결과도 없어야 함(전부 `clubMemberIds`로 교체 완료).

- [ ] **Step 4: 홍보메일 초청 링크(`?invite=true`) 소비 로직 및 `inviteName` 배너 제거**

`promo` 기능 자체가 삭제되므로(spec 1절) 그 이메일이 만들던 `?invite=true&id=...&name=...` 링크를 소비하던 코드도 죽은 코드가 된다.

기존(라인 118-119 중 `inviteName` 선언, 라인 135-156 useEffect 전체, 라인 607-616 배너 JSX) 세 군데를 각각 제거한다.

`inviteName` 선언 제거 — 기존:
```tsx
  const [inviteName, setInviteName] = useState("");
  const [isManualOpen, setIsManualOpen] = useState(false);
```
교체 후:
```tsx
  const [isManualOpen, setIsManualOpen] = useState(false);
```

`?invite=true` useEffect 제거 — 기존:
```tsx
  // 🌟 [추가됨] VIP 초청 링크를 통한 접근 시 데이터 자동 채우기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('invite') === 'true') {
        let paramId = params.get('id') || '';
        let paramName = params.get('name') || '';
        
        if (paramId === 'undefined' || paramId === 'null') paramId = '';
        if (paramName === 'undefined' || paramName === 'null') paramName = '';

        if (paramId || paramName) {
          // 🍎 [추가됨] 숫자가 아닌 학번(교직원/관리자 등)은 '교직원'으로 표시합니다.
          const finalId = (paramId && isNaN(Number(paramId))) ? '교직원' : paramId;
          setFormData(prev => ({ ...prev, studentId: finalId, name: paramName }));
          if (paramName) setInviteName(paramName);
        }
        // 주소창에서 파라미터 숨기기 (깔끔한 UI 유지)
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // 🌟 [단체 예매] 이메일 발송 중 페이지 이탈 방지
```
교체 후(useEffect 블록 통째로 삭제, 다음 주석/useEffect만 남김):
```tsx
  // 🌟 [단체 예매] 이메일 발송 중 페이지 이탈 방지
```

배너 JSX 제거 — 기존:
```tsx
      {inviteName && (
        <div className="w-full max-w-4xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-500/30 rounded-2xl p-5 mb-6 text-center transform shadow-[0_0_30px_rgba(245,158,11,0.15)] animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="text-amber-400 font-bold text-lg md:text-xl tracking-wide flex items-center justify-center gap-2">
            <span>✨</span>
            <span><span className="text-white">{inviteName}</span>님, 특별 초청을 환영합니다!</span>
            <span>✨</span>
          </div>
          <p className="text-slate-400 text-sm mt-2 font-light">예매 시 귀하의 학번과 이름이 자동으로 입력되어 있습니다.</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center gap-6 mb-12 bg-white/5 backdrop-blur-xl p-6 rounded-2xl w-full max-w-4xl shadow-2xl border border-white/10 transition-all duration-500 hover:border-white/20 hover:bg-white/10">
```
교체 후:
```tsx
      <div className="flex flex-col md:flex-row items-center gap-6 mb-12 bg-white/5 backdrop-blur-xl p-6 rounded-2xl w-full max-w-4xl shadow-2xl border border-white/10 transition-all duration-500 hover:border-white/20 hover:bg-white/10">
```

- [ ] **Step 5: 로그인 부트스트랩 useEffect 추가**

`useEffect(() => { fetchInitialData(); },[]);` (라인 131-133) 바로 앞에 새 useEffect를 추가한다. 기존:
```tsx
  useEffect(() => {
    fetchInitialData();
  },[]);
```
교체 후:
```tsx
  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const p = await ensureProfile();
        if (active) setProfile(p);
      } catch (err) {
        if (err instanceof DomainNotAllowedError) {
          showAlert('🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다.');
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { setProfile(null); return; }
      try {
        const p = await ensureProfile();
        setProfile(p);
      } catch (err) {
        if (err instanceof DomainNotAllowedError) {
          showAlert('🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다.');
        }
        setProfile(null);
      }
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (profile) fetchInitialData();
  }, [profile]);
```

`showAlert`는 이 시점에 아직 선언 전(라인 51)이므로, 이 useEffect는 `showAlert` 선언(라인 47-53) **다음**에 위치해야 한다 — 원래 `useEffect(() => { fetchInitialData(); },[]);`가 있던 라인 131 자리 그대로면 이미 `showAlert` 선언보다 뒤이므로 문제 없음.

- [ ] **Step 6: 커밋**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/page.tsx): 구글 로그인 부트스트랩 상태 추가

profile/authLoading/clubMemberIds 상태와 세션 부트스트랩 useEffect
추가. 학번/이름/비밀번호 입력용 formData와 홍보메일 초청 링크
소비 로직(inviteName)은 제거. CLUB_MEMBERS 배열 참조는
clubMemberIds state로 교체.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 11: `app/page.tsx` — `fetchInitialData`에 동아리원 목록 추가

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `club_members` 테이블(Task 1), `authenticated` RLS 정책(Task 1) — `profile`이 설정된 뒤에만 호출되므로 세션이 있는 상태에서 실행됨.
- Produces: `clubMemberIds` state가 채워짐. Task 12(handleSubmit 등)가 이 값을 읽는다.

- [ ] **Step 1: `fetchInitialData` 내 `Promise.all` 교체**

기존(라인 168-172):
```tsx
  const fetchInitialData = async () => {
    try {
      const [{ data: settingsData }, { data: bgData }] = await Promise.all([
        supabase.from('movie_settings').select('*').eq('id', 1).single(),
        supabase.from('blacklist').select('student_id'),
      ]);
```
교체 후:
```tsx
  const fetchInitialData = async () => {
    try {
      const [{ data: settingsData }, { data: bgData }, { data: clubData }] = await Promise.all([
        supabase.from('movie_settings').select('*').eq('id', 1).single(),
        supabase.from('blacklist').select('student_id'),
        supabase.from('club_members').select('student_id'),
      ]);
      if (clubData) setClubMemberIds(clubData.map(c => c.student_id));
```

- [ ] **Step 2: 커밋**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/page.tsx): club_members 테이블에서 VIP 명단 로드

기존 CLUB_MEMBERS 하드코딩 배열 대신 DB에서 조회.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 12: `app/page.tsx` — `handleSubmit` 재작성 (개인 예매)

**Files:**
- Modify: `app/page.tsx:281-404` (`handleSubmit` 함수 전체 교체), `app/page.tsx:266-279`(`handleRequestReset` 삭제)

**Interfaces:**
- Consumes: `profile`(Task 10), `clubMemberIds`(Task 11)
- Produces: `reservations` insert/update 시 `user_id`, `email` 컬럼을 채움. `password` 컬럼 참조 제거.

- [ ] **Step 1: `handleRequestReset` 함수 삭제**

기존(라인 266-279):
```tsx
  const handleRequestReset = async () => {
    const cleanStudentId = formData.studentId.replace(/['"]/g, '').trim();
    setIsResetting(true);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ studentId: cleanStudentId, studentName: formData.name, baseUrl: window.location.origin })
      });
      if (res.ok) {
        showAlert("학교 이메일로 비밀번호 재설정 링크가 발송되었습니다.", false);
        setShowResetButton(false);
      } else { showAlert("발송에 실패했습니다."); }
    } finally { setIsResetting(false); }
  };

```
교체 후: (통째로 삭제, 빈 줄 없이 바로 다음 함수로 이어짐)

- [ ] **Step 2: `handleSubmit` 전체 교체**

기존(라인 281-404, `handleInputChange`는 그대로 두고 `handleSubmit`만 대상):
```tsx
  const handleSubmit = async () => {
    if (!formData.studentId || !formData.name || !formData.password) return showAlert("정보를 모두 입력해주세요!");
    if (!/^[0-9]{4}$/.test(formData.password)) return showAlert("❌ 비밀번호는 4자리 '숫자'만 입력해주세요!");

    const cleanStudentId = formData.studentId.replace(/['"]/g, '').trim();

    if (cleanStudentId === "교직원") {
      if (!STAFF_LIST.includes(formData.name)) return showAlert("❌ 등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanStudentId.length !== 4) return showAlert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanStudentId] !== formData.name) return showAlert(`❌ 학번과 이름이 일치하지 않습니다.`);
    }

    if (blacklistedUsers.includes(cleanStudentId)) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");

    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!CLUB_MEMBERS.includes(cleanStudentId)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
      }
    }

    const authKey = cleanStudentId === "교직원" ? formData.name : cleanStudentId;
    const { data: authResult, error: authError } = await supabase.rpc('verify_student_password', { 
      p_student_id: authKey, 
      p_password: formData.password 
    });

    if (authError) return showAlert("네트워크 오류가 발생했습니다.");

    if (!authResult.exists) {
      // 신규 사용자: INSERT (RLS anon INSERT 허용됨)
      await supabase.from('student_auth').insert({ student_id: authKey, password: formData.password });
      setShowResetButton(false);
    } else {
      if (!authResult.success) {
        setShowResetButton(true);
        return showAlert("❌ 비밀번호가 일치하지 않습니다.");
      } else {
        setShowResetButton(false);
      }
    }

    const processReservation = async () => {
      try {
        const { data: existingTickets } = await supabase.from('reservations')
          .select('*')
          .eq('movie_date', movieInfo.db_date)
          .eq('student_id', cleanStudentId)
          .eq('student_name', formData.name);

        const baseUrl = window.location.origin;
        const userEmail = cleanStudentId === "교직원" ? USER_EMAILS[formData.name] : USER_EMAILS[cleanStudentId];
        const finalPopcornString = popcornList.filter(p => p !== 'none').join(',') || 'none';

        if (existingTickets && existingTickets.length > 0) {
          const myOldTicket = existingTickets[0];
          
          // 기존 팝콘 삭제 불가 로직
          const oldPopcorns = myOldTicket.popcorn_order && myOldTicket.popcorn_order !== 'none' ? myOldTicket.popcorn_order.split(',') : [];
          const newPopcorns = finalPopcornString !== 'none' ? finalPopcornString.split(',') : [];
          
          if (newPopcorns.length < oldPopcorns.length) {
            return showAlert("🚫 결제 혼선 방지를 위해 기존에 주문한 팝콘 수량을 취소/삭제할 수 없습니다. (맛 변경 및 추가만 가능)");
          }

          let confirmMsg = `이미 예약된 좌석(${myOldTicket.seat_number})을 새로운 좌석(${selectedSeat})으로 변경하시겠습니까?`;
          if (myOldTicket.popcorn_order !== finalPopcornString) {
            confirmMsg = `팝콘 주문 내역이 변경되었습니다.\n(추가 결제/수령 시 현장에서 문의해주세요.)\n\n` + confirmMsg;
          }
          
          showConfirm(confirmMsg, async () => {
            const { data: updatedTicket, error: updateError } = await supabase.from('reservations')
              .update({ seat_number: selectedSeat, popcorn_order: finalPopcornString })
              .eq('id', myOldTicket.id)
              .select('id')
              .single();

            if (updateError) return showAlert("변경 중 오류 발생 (이미 선점된 좌석일 수 있습니다).");

            await supabase.from('activity_logs').insert([{ student_id: cleanStudentId, student_name: formData.name, description: `좌석 변경 (${myOldTicket.seat_number} ➡️ ${selectedSeat}) 및 팝콘 갱신` }]);

            if (userEmail && updatedTicket) {
              fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: formData.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'changed', popcorn: finalPopcornString, ticketId: updatedTicket.id, baseUrl }) });
            }
            showSuccess("예매 변경 완료!", "✨ 좌석이 성공적으로 변경되었습니다.\n새로운 티켓이 학교 메일로 발송되었습니다.");
            fetchInitialData(); setIsModalOpen(false); setSelectedSeat(null);
          });
          return;
        }

        const finalStatus = finalPopcornString === 'none' ? 'confirmed' : 'pending';
        const { data: newTicket, error: insertError } = await supabase.from('reservations')
          .insert([{ movie_date: movieInfo.db_date, student_id: cleanStudentId, student_name: formData.name, password: formData.password, seat_number: selectedSeat, popcorn_order: finalPopcornString, payment_status: finalStatus }])
          .select('id').single();

        if (insertError) {
          showAlert("앗! 다른 분이 먼저 예매했습니다.\n다른 좌석을 선택해주세요.");
          fetchInitialData(); return;
        }

        const logDesc = finalStatus === 'confirmed' ? `무료 예매 (${selectedSeat})` : `팝콘 포함 예매 대기 (${selectedSeat})`;
        await supabase.from('activity_logs').insert([{ student_id: cleanStudentId, student_name: formData.name, description: logDesc }]);

        setSeatStatuses((prev) => ({ ...prev,[selectedSeat as string]: { status: finalStatus, name: formData.name, ticketId: newTicket?.id || '' } }));
        setIsModalOpen(false); 

        if (userEmail && newTicket) {
          fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: formData.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: finalStatus, popcorn: finalPopcornString, ticketId: newTicket.id, baseUrl }) });
        }

        if (finalStatus === 'confirmed') {
          showSuccess("🎉 예매 성공!", `${formData.name}님 귀중한 예매 감사합니다! 📧\n입력하신 학교 이메일로 VIP 모바일 티켓이 발송되었습니다.`);
          setSelectedSeat(null);
        } else {
          setIsPaymentModalOpen(true);
        }
        
      } catch (err) {
        showAlert("네트워크 오류가 발생했습니다.");
      }
    };

    showConfirm(`[${selectedSeat}] 좌석 예매를 확정하시겠습니까?`, processReservation);
  };
```

교체 후:
```tsx
  const handleSubmit = async () => {
    if (!profile) return showAlert("로그인이 필요합니다.");

    if (blacklistedUsers.includes(profile.student_id ?? '')) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");

    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!profile.student_id || !clubMemberIds.includes(profile.student_id)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
      }
    }

    const processReservation = async () => {
      try {
        const { data: existingTickets } = await supabase.from('reservations')
          .select('*')
          .eq('movie_date', movieInfo.db_date)
          .eq('user_id', profile.id);

        const baseUrl = window.location.origin;
        const userEmail = profile.email;
        const finalPopcornString = popcornList.filter(p => p !== 'none').join(',') || 'none';

        if (existingTickets && existingTickets.length > 0) {
          const myOldTicket = existingTickets[0];

          const oldPopcorns = myOldTicket.popcorn_order && myOldTicket.popcorn_order !== 'none' ? myOldTicket.popcorn_order.split(',') : [];
          const newPopcorns = finalPopcornString !== 'none' ? finalPopcornString.split(',') : [];

          if (newPopcorns.length < oldPopcorns.length) {
            return showAlert("🚫 결제 혼선 방지를 위해 기존에 주문한 팝콘 수량을 취소/삭제할 수 없습니다. (맛 변경 및 추가만 가능)");
          }

          let confirmMsg = `이미 예약된 좌석(${myOldTicket.seat_number})을 새로운 좌석(${selectedSeat})으로 변경하시겠습니까?`;
          if (myOldTicket.popcorn_order !== finalPopcornString) {
            confirmMsg = `팝콘 주문 내역이 변경되었습니다.\n(추가 결제/수령 시 현장에서 문의해주세요.)\n\n` + confirmMsg;
          }

          showConfirm(confirmMsg, async () => {
            const { data: updatedTicket, error: updateError } = await supabase.from('reservations')
              .update({ seat_number: selectedSeat, popcorn_order: finalPopcornString })
              .eq('id', myOldTicket.id)
              .select('id')
              .single();

            if (updateError) return showAlert("변경 중 오류 발생 (이미 선점된 좌석일 수 있습니다).");

            await supabase.from('activity_logs').insert([{ student_id: profile.student_id, student_name: profile.name, description: `좌석 변경 (${myOldTicket.seat_number} ➡️ ${selectedSeat}) 및 팝콘 갱신` }]);

            if (userEmail && updatedTicket) {
              fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: profile.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'changed', popcorn: finalPopcornString, ticketId: updatedTicket.id, baseUrl }) });
            }
            showSuccess("예매 변경 완료!", "✨ 좌석이 성공적으로 변경되었습니다.\n새로운 티켓이 학교 메일로 발송되었습니다.");
            fetchInitialData(); setIsModalOpen(false); setSelectedSeat(null);
          });
          return;
        }

        const finalStatus = finalPopcornString === 'none' ? 'confirmed' : 'pending';
        const { data: newTicket, error: insertError } = await supabase.from('reservations')
          .insert([{ movie_date: movieInfo.db_date, user_id: profile.id, student_id: profile.student_id, student_name: profile.name, email: profile.email, seat_number: selectedSeat, popcorn_order: finalPopcornString, payment_status: finalStatus }])
          .select('id').single();

        if (insertError) {
          showAlert("앗! 다른 분이 먼저 예매했습니다.\n다른 좌석을 선택해주세요.");
          fetchInitialData(); return;
        }

        const logDesc = finalStatus === 'confirmed' ? `무료 예매 (${selectedSeat})` : `팝콘 포함 예매 대기 (${selectedSeat})`;
        await supabase.from('activity_logs').insert([{ student_id: profile.student_id, student_name: profile.name, description: logDesc }]);

        setSeatStatuses((prev) => ({ ...prev,[selectedSeat as string]: { status: finalStatus, name: profile.name, ticketId: newTicket?.id || '' } }));
        setIsModalOpen(false);

        if (userEmail && newTicket) {
          fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: profile.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: finalStatus, popcorn: finalPopcornString, ticketId: newTicket.id, baseUrl }) });
        }

        if (finalStatus === 'confirmed') {
          showSuccess("🎉 예매 성공!", `${profile.name}님 귀중한 예매 감사합니다! 📧\n학교 이메일로 VIP 모바일 티켓이 발송되었습니다.`);
          setSelectedSeat(null);
        } else {
          setIsPaymentModalOpen(true);
        }

      } catch (err) {
        showAlert("네트워크 오류가 발생했습니다.");
      }
    };

    showConfirm(`[${selectedSeat}] 좌석 예매를 확정하시겠습니까?`, processReservation);
  };
```

- [ ] **Step 3: 커밋**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/page.tsx): handleSubmit을 세션 profile 기반으로 재작성

학번/이름/비밀번호 자유 입력 + 명렬표 대조 + verify_student_password
RPC를 전부 제거하고 로그인된 profile 값을 그대로 사용한다. 기존
예약 조회도 student_id+student_name 매칭 대신 user_id로 한다.
handleRequestReset(비밀번호 재설정)도 함께 삭제.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 13: `app/page.tsx` — 단체예매 상태 타입 변경 및 `handleGroupStart` 재작성

단체 멤버는 이제 "자유 입력"이 아니라 "이미 로그인한 사람 검색 후 선택"이므로(spec 5절), 멤버 데이터에 `profileId`가 필요하다.

**Files:**
- Modify: `app/page.tsx:123-126`(상태 타입), `app/page.tsx:408-451`(`handleGroupStart`)

**Interfaces:**
- Consumes: `profile`(Task 10)
- Produces: `groupLeader: { studentId, name, seat }`(비밀번호 필드 제거), `groupMembers: { profileId, studentId, name, seat }[]`. Task 14(`handleAddGroupMember`)와 Task 15(`handleGroupFinalize`)가 이 형태를 그대로 쓴다.

- [ ] **Step 1: 상태 타입 교체**

기존(라인 123-126):
```tsx
  const [groupLeader, setGroupLeader] = useState<{studentId: string, name: string, password: string, seat: string} | null>(null);
  const [groupMembers, setGroupMembers] = useState<{studentId: string, name: string, seat: string}[]>([]);
  const [isGroupMemberModal, setIsGroupMemberModal] = useState(false);
  const [memberFormData, setMemberFormData] = useState({studentId: '', name: ''});
```
교체 후:
```tsx
  const [groupLeader, setGroupLeader] = useState<{profileId: string, studentId: string | null, name: string, seat: string} | null>(null);
  const [groupMembers, setGroupMembers] = useState<{profileId: string, studentId: string | null, name: string, seat: string}[]>([]);
  const [isGroupMemberModal, setIsGroupMemberModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<{id: string, student_id: string | null, name: string}[]>([]);
  const [selectedMember, setSelectedMember] = useState<{id: string, student_id: string | null, name: string} | null>(null);
```

- [ ] **Step 2: `handleGroupStart` 전체 교체**

기존(라인 408-451):
```tsx
  const handleGroupStart = async () => {
    if (!formData.studentId || !formData.name || !formData.password) return showAlert("정보를 모두 입력해주세요!");
    if (!/^[0-9]{4}$/.test(formData.password)) return showAlert("❌ 비밀번호는 4자리 '숫자'만 입력해주세요!");
    const cleanStudentId = formData.studentId.replace(/['\"]/g, '').trim();
    if (cleanStudentId === "교직원") {
      if (!STAFF_LIST.includes(formData.name)) return showAlert("❌ 등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanStudentId.length !== 4) return showAlert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanStudentId] !== formData.name) return showAlert(`❌ 학번과 이름이 일치하지 않습니다.`);
    }
    if (blacklistedUsers.includes(cleanStudentId)) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");
    if (selectedSeat && vipSeats.has(selectedSeat) && !CLUB_MEMBERS.includes(cleanStudentId)) {
      return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
    }
    const authKey = cleanStudentId === "교직원" ? formData.name : cleanStudentId;
    const { data: authResult, error: authError } = await supabase.rpc('verify_student_password', { 
      p_student_id: authKey, 
      p_password: formData.password 
    });

    if (authError) return showAlert("네트워크 오류가 발생했습니다.");

    if (!authResult.exists) {
      await supabase.from('student_auth').insert({ student_id: authKey, password: formData.password });
      setShowResetButton(false);
    } else {
      if (!authResult.success) {
        setShowResetButton(true);
        return showAlert("❌ 비밀번호가 일치하지 않습니다.");
      } else {
        setShowResetButton(false);
      }
    }
    const { data: existingTickets } = await supabase.from('reservations')
      .select('id').eq('movie_date', movieInfo.db_date).eq('student_id', cleanStudentId);
    if (existingTickets && existingTickets.length > 0) {
      return showAlert("이미 예매 내역이 존재하는 학생은 단체 예매 리더가 될 수 없습니다.\n기존 예매를 취소한 뒤 다시 시도해주세요.");
    }
    setGroupLeader({ studentId: cleanStudentId, name: formData.name, password: formData.password, seat: selectedSeat! });
    setGroupMembers([]);
    setIsGroupMode(true);
    setIsModalOpen(false);
    setShowResetButton(false);
  };
```
교체 후:
```tsx
  const handleGroupStart = async () => {
    if (!profile) return showAlert("로그인이 필요합니다.");

    if (blacklistedUsers.includes(profile.student_id ?? '')) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");
    if (selectedSeat && vipSeats.has(selectedSeat) && (!profile.student_id || !clubMemberIds.includes(profile.student_id))) {
      return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
    }

    const { data: existingTickets } = await supabase.from('reservations')
      .select('id').eq('movie_date', movieInfo.db_date).eq('user_id', profile.id);
    if (existingTickets && existingTickets.length > 0) {
      return showAlert("이미 예매 내역이 존재하는 학생은 단체 예매 리더가 될 수 없습니다.\n기존 예매를 취소한 뒤 다시 시도해주세요.");
    }

    setGroupLeader({ profileId: profile.id, studentId: profile.student_id, name: profile.name, seat: selectedSeat! });
    setGroupMembers([]);
    setIsGroupMode(true);
    setIsModalOpen(false);
  };
```

- [ ] **Step 3: 커밋**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/page.tsx): 단체예매 리더 시작 로직을 profile 기반으로 재작성

groupLeader/groupMembers 상태에서 password 필드 제거, profileId
필드 추가(단체 멤버를 검색-선택 방식으로 바꾸기 위한 선행 작업).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 14: `app/page.tsx` — 단체 멤버를 자유 입력 대신 검색해서 선택하도록 변경

**Files:**
- Modify: `app/page.tsx:453-483`(`handleAddGroupMember` 전체 교체), `app/page.tsx:996-1018`(멤버 추가 모달 JSX 교체)

**Interfaces:**
- Consumes: `GET /api/profiles/search?q=`(Task 4), `authFetchGet`(Task 2), `memberSearchQuery`/`memberSearchResults`/`selectedMember`(Task 13)
- Produces: `groupMembers` 배열에 실제 `profiles` 데이터 기반 항목이 추가됨. Task 15(`handleGroupFinalize`)가 이 배열의 `profileId`를 사용한다.

- [ ] **Step 1: 검색 디바운스 useEffect 추가**

`handleAddGroupMember` 함수 바로 위에 추가:
```tsx
  useEffect(() => {
    const q = memberSearchQuery.trim();
    if (q.length < 1) { setMemberSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await authFetchGet(`/api/profiles/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success) setMemberSearchResults(data.results);
      } catch { setMemberSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearchQuery]);

```
(이 useEffect가 `authFetchGet`을 쓰므로 Task 10 Step 1의 import 줄에 `authFetchGet`도 추가한다: `import { ensureProfile, signInWithGoogle, authFetch, authFetchGet, DomainNotAllowedError, type AppProfile } from '../lib/supabase-auth';`)

- [ ] **Step 2: `handleAddGroupMember` 전체 교체**

기존(라인 453-483):
```tsx
  const handleAddGroupMember = async (andFinalize: boolean) => {
    if (!memberFormData.studentId || !memberFormData.name) return showAlert("학번과 이름을 모두 입력해주세요!");
    const cleanId = memberFormData.studentId.replace(/['\"]/g, '').trim();
    if (cleanId === "교직원") {
      if (!STAFF_LIST.includes(memberFormData.name)) return showAlert("❌ 등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanId.length !== 4) return showAlert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanId] !== memberFormData.name) return showAlert(`❌ 학번과 이름이 일치하지 않습니다.`);
    }
    if (blacklistedUsers.includes(cleanId)) return showAlert("🚫 블랙리스트에 등록되어 추가할 수 없습니다.");
    if (groupLeader?.studentId === cleanId) return showAlert("리더 본인은 추가할 수 없습니다.");
    if (groupMembers.some(m => m.studentId === cleanId)) return showAlert("이미 단체에 추가된 학생입니다.");
    const { data: existing } = await supabase.from('reservations')
      .select('id').eq('movie_date', movieInfo.db_date).eq('student_id', cleanId);
    if (existing && existing.length > 0) return showAlert("이미 예매가 완료된 학생입니다.");

    // 🌟 [추가] 동아리 전용 좌석 검증 (멤버 추가 시)
    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!CLUB_MEMBERS.includes(cleanId)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n이 좌석에는 동아리 부원만 추가할 수 있습니다.");
      }
    }

    const newMembers = [...groupMembers, { studentId: cleanId, name: memberFormData.name, seat: selectedSeat! }];
    setGroupMembers(newMembers);
    setIsGroupMemberModal(false);
    setSelectedSeat(null);
    if (andFinalize) {
      setTimeout(() => setIsGroupSummaryOpen(true), 100);
    }
  };
```
교체 후:
```tsx
  const handleAddGroupMember = async (andFinalize: boolean) => {
    if (!selectedMember) return showAlert("추가할 사람을 검색해서 선택해주세요!");
    if (blacklistedUsers.includes(selectedMember.student_id ?? '')) return showAlert("🚫 블랙리스트에 등록되어 추가할 수 없습니다.");
    if (groupLeader?.profileId === selectedMember.id) return showAlert("리더 본인은 추가할 수 없습니다.");
    if (groupMembers.some(m => m.profileId === selectedMember.id)) return showAlert("이미 단체에 추가된 사람입니다.");

    const { data: existing } = await supabase.from('reservations')
      .select('id').eq('movie_date', movieInfo.db_date).eq('user_id', selectedMember.id);
    if (existing && existing.length > 0) return showAlert("이미 예매가 완료된 학생입니다.");

    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!selectedMember.student_id || !clubMemberIds.includes(selectedMember.student_id)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n이 좌석에는 동아리 부원만 추가할 수 있습니다.");
      }
    }

    const newMembers = [...groupMembers, { profileId: selectedMember.id, studentId: selectedMember.student_id, name: selectedMember.name, seat: selectedSeat! }];
    setGroupMembers(newMembers);
    setIsGroupMemberModal(false);
    setSelectedSeat(null);
    setMemberSearchQuery('');
    setMemberSearchResults([]);
    setSelectedMember(null);
    if (andFinalize) {
      setTimeout(() => setIsGroupSummaryOpen(true), 100);
    }
  };
```

- [ ] **Step 3: 멤버 추가 모달 JSX 교체**

기존(라인 996-1018):
```tsx
      {isGroupMemberModal && selectedSeat && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-2xl w-full max-w-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-2xl font-bold text-white mb-2">단체 멤버 추가</h2>
            <p className="text-slate-400 text-sm mb-6">좌석 <span className="text-sky-400 font-bold">{selectedSeat}</span>에 앉을 학생 정보를 입력하세요.</p>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-slate-300 mb-1 text-sm">학번</label>
                <input type="text" value={memberFormData.studentId} onChange={e => setMemberFormData(prev => ({...prev, studentId: e.target.value}))} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all" placeholder="예: 2703 (교직원은 '교직원')"/>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 text-sm">이름 (본명)</label>
                <input type="text" value={memberFormData.name} onChange={e => setMemberFormData(prev => ({...prev, name: e.target.value}))} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all" placeholder="이름을 정확히 입력하세요"/>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => { setIsGroupMemberModal(false); setSelectedSeat(null); }} className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 font-bold transition-all text-sm">취소</button>
              <button onClick={() => handleAddGroupMember(false)} className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 border border-sky-500 rounded-lg text-white font-bold transition-all text-sm">계속하기</button>
              <button onClick={() => handleAddGroupMember(true)} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg text-white font-bold transition-all text-sm">완료하기</button>
            </div>
          </div>
        </div>
      )}
```
교체 후:
```tsx
      {isGroupMemberModal && selectedSeat && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-2xl w-full max-w-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-2xl font-bold text-white mb-2">단체 멤버 추가</h2>
            <p className="text-slate-400 text-sm mb-6">좌석 <span className="text-sky-400 font-bold">{selectedSeat}</span>에 앉을 사람을 검색하세요. <span className="text-amber-400">한 번이라도 로그인한 적이 있어야</span> 검색됩니다.</p>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-slate-300 mb-1 text-sm">이름 또는 학번으로 검색</label>
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={e => { setMemberSearchQuery(e.target.value); setSelectedMember(null); }}
                  className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                  placeholder="예: 신민규 또는 2208"
                />
              </div>
              {memberSearchQuery.trim().length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {memberSearchResults.length === 0 && (
                    <p className="text-slate-500 text-xs px-1">검색 결과가 없습니다. 아직 로그인한 적이 없는 사람일 수 있어요.</p>
                  )}
                  {memberSearchResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedMember(r); setMemberSearchQuery(r.name); setMemberSearchResults([]); }}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${selectedMember?.id === r.id ? 'bg-sky-600/30 border-sky-500' : 'bg-slate-800/60 border-white/10 hover:bg-slate-700/60'}`}
                    >
                      <span className="text-white font-bold">{r.name}</span>
                      {r.student_id && <span className="text-slate-400 text-sm ml-2">{r.student_id}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => { setIsGroupMemberModal(false); setSelectedSeat(null); setMemberSearchQuery(''); setMemberSearchResults([]); setSelectedMember(null); }} className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 font-bold transition-all text-sm">취소</button>
              <button onClick={() => handleAddGroupMember(false)} disabled={!selectedMember} className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed border border-sky-500 rounded-lg text-white font-bold transition-all text-sm">계속하기</button>
              <button onClick={() => handleAddGroupMember(true)} disabled={!selectedMember} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500 rounded-lg text-white font-bold transition-all text-sm">완료하기</button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/page.tsx): 단체 멤버 추가를 자유 입력에서 검색-선택으로 변경

명렬표가 없어져 학번/이름 자유 입력을 대조 검증할 방법이 없으므로,
/api/profiles/search로 이미 로그인한 사람만 검색해서 선택하는
방식으로 바꾼다. 선택된 사람의 student_id는 본인이 로그인할 때
확정된 값이라 리더가 잘못 입력할 여지가 없다(VIP 좌석 검증도 이
시점에 정확해짐).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 15: `app/page.tsx` — `handleGroupFinalize`를 `/api/reservations` `CREATE_GROUP` 호출로 재작성

**Files:**
- Modify: `app/page.tsx:485-558`(`handleGroupFinalize` 전체 교체)

**Interfaces:**
- Consumes: `POST /api/reservations` `CREATE_GROUP`(Task 8), `authFetch`(Task 2), `POST /api/group-invite`(Task 9, `email` 필드 없이 `memberId`만 전달)
- Produces: 없음(최종 사용자 흐름)

- [ ] **Step 1: `handleGroupFinalize` 전체 교체**

기존(라인 485-558):
```tsx
  const handleGroupFinalize = async () => {
    setIsGroupSummaryOpen(false);
    const leaderName = groupLeader!.name;
    const leaderSeat = groupLeader!.seat;
    const leaderStudentId = groupLeader!.studentId;
    const memberCount = groupMembers.length;
    const groupId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const baseUrl = window.location.origin;

    const { data: leaderTicket, error: leaderError } = await supabase.from('reservations')
      .insert([{
        movie_date: movieInfo.db_date, student_id: leaderStudentId, student_name: leaderName,
        password: groupLeader!.password, seat_number: leaderSeat, popcorn_order: 'none',
        payment_status: 'confirmed', group_id: groupId, is_group_leader: true, group_expires_at: expiresAt
      }]).select('id').single();
    if (leaderError) {
      return showAlert("리더 좌석 예매 중 오류가 발생했습니다.\n(이미 선점된 좌석일 수 있습니다.)");
    }

    const memberInserts = groupMembers.map(m => ({
      movie_date: movieInfo.db_date, student_id: m.studentId, student_name: m.name,
      password: '', seat_number: m.seat, popcorn_order: 'none',
      payment_status: 'group_pending', group_id: groupId, is_group_leader: false, group_expires_at: expiresAt
    }));
    const { data: memberTickets, error: memberError } = await supabase.from('reservations')
      .insert(memberInserts).select('id, student_id, student_name, seat_number');
    if (memberError) {
      await supabase.from('reservations').delete().eq('id', leaderTicket.id);
      return showAlert("멤버 좌석 예매 중 오류가 발생했습니다.\n(이미 선점된 좌석이 포함되어 있을 수 있습니다.)");
    }

    await supabase.from('activity_logs').insert([{
      student_id: leaderStudentId, student_name: leaderName,
      description: `단체 예매 생성 (리더: ${leaderSeat}, 멤버 ${memberCount}명)`
    }]);

    const leaderEmail = leaderStudentId === "교직원" ? USER_EMAILS[leaderName] : USER_EMAILS[leaderStudentId];
    if (leaderEmail) {
      fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({
          email: leaderEmail, name: leaderName, seat: leaderSeat,
          movieTitle: movieInfo.title, movieDate: movieInfo.date_string,
          statusType: 'confirmed', popcorn: 'none', ticketId: leaderTicket.id, baseUrl
        })
      });
    }

    setGroupSendingProgress({ current: 0, total: memberTickets!.length, sending: true });
    const emailPayloads = memberTickets!.map(t => ({
      email: t.student_id === "교직원" ? USER_EMAILS[t.student_name] : USER_EMAILS[t.student_id],
      name: t.student_name, seat: t.seat_number, studentId: t.student_id, memberId: t.id
    }));
    const CHUNK_SIZE = 5;
    for (let i = 0; i < emailPayloads.length; i += CHUNK_SIZE) {
      const chunk = emailPayloads.slice(i, i + CHUNK_SIZE);
      try {
        await fetch('/api/group-invite', {
          method: 'POST',
          body: JSON.stringify({ members: chunk, leaderName, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, groupId, baseUrl })
        });
      } catch (err) { console.error(err); }
      setGroupSendingProgress({ current: Math.min(i + CHUNK_SIZE, emailPayloads.length), total: emailPayloads.length, sending: true });
      if (i + CHUNK_SIZE < emailPayloads.length) await new Promise(r => setTimeout(r, 1000));
    }

    setGroupSendingProgress(prev => ({ ...prev, sending: false }));
    setIsGroupMode(false);
    setGroupLeader(null);
    setGroupMembers([]);
    fetchInitialData();
    showSuccess("🎉 단체 예매 완료!", `${leaderName}님의 단체 예매가 등록되었습니다!\n\n리더의 예매는 즉시 확정되었습니다.\n멤버 ${memberCount}명에게 초대 이메일이 발송되었습니다.\n\n⏰ 멤버들은 1시간 이내에 이메일을 통해 예매를 확정해야 합니다.`);
  };
```
교체 후:
```tsx
  const handleGroupFinalize = async () => {
    if (!profile) return showAlert("로그인이 필요합니다.");
    setIsGroupSummaryOpen(false);
    const leaderName = groupLeader!.name;
    const leaderSeat = groupLeader!.seat;
    const memberCount = groupMembers.length;
    const groupId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const baseUrl = window.location.origin;

    const res = await authFetch('/api/reservations', {
      action: 'CREATE_GROUP',
      payload: {
        movieDate: movieInfo.db_date,
        leaderSeat,
        memberSeats: groupMembers.map(m => ({ profileId: m.profileId, seat: m.seat })),
        groupId, expiresAt
      }
    });
    const data = await res.json();
    if (!data.success) return showAlert(data.error || "단체 예매 생성 중 오류가 발생했습니다.");

    const { leaderTicket, memberTickets } = data;

    fetch('/api/ticket', {
      method: 'POST',
      body: JSON.stringify({
        email: profile.email, name: leaderName, seat: leaderSeat,
        movieTitle: movieInfo.title, movieDate: movieInfo.date_string,
        statusType: 'confirmed', popcorn: 'none', ticketId: leaderTicket.id, baseUrl
      })
    });

    setGroupSendingProgress({ current: 0, total: memberTickets.length, sending: true });
    const emailPayloads = memberTickets.map((t: any) => ({
      memberId: t.id, name: t.student_name, seat: t.seat_number, studentId: t.student_id
    }));
    const CHUNK_SIZE = 5;
    for (let i = 0; i < emailPayloads.length; i += CHUNK_SIZE) {
      const chunk = emailPayloads.slice(i, i + CHUNK_SIZE);
      try {
        await fetch('/api/group-invite', {
          method: 'POST',
          body: JSON.stringify({ members: chunk, leaderName, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, groupId, baseUrl })
        });
      } catch (err) { console.error(err); }
      setGroupSendingProgress({ current: Math.min(i + CHUNK_SIZE, emailPayloads.length), total: emailPayloads.length, sending: true });
      if (i + CHUNK_SIZE < emailPayloads.length) await new Promise(r => setTimeout(r, 1000));
    }

    setGroupSendingProgress(prev => ({ ...prev, sending: false }));
    setIsGroupMode(false);
    setGroupLeader(null);
    setGroupMembers([]);
    fetchInitialData();
    showSuccess("🎉 단체 예매 완료!", `${leaderName}님의 단체 예매가 등록되었습니다!\n\n리더의 예매는 즉시 확정되었습니다.\n멤버 ${memberCount}명에게 초대 이메일이 발송되었습니다.\n\n⏰ 멤버들은 1시간 이내에 이메일을 통해 예매를 확정해야 합니다.`);
  };
```

- [ ] **Step 2: 커밋**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/page.tsx): 단체예매 확정을 /api/reservations 서버 API로 이전

클라이언트가 직접 reservations를 insert하던 방식에서 서버가
profiles를 조회해 리더/멤버 행을 만드는 방식으로 변경. 클라이언트는
멤버 이메일을 전혀 다루지 않는다(USER_EMAILS 조회 완전 제거).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 16: `app/page.tsx` — 로그인 게이트 화면 + 예매 모달 입력란을 프로필 표시로 교체

**Files:**
- Modify: `app/page.tsx:253-256`(`handleInputChange` 삭제), `app/page.tsx:569-582`(로딩/로그인 게이트 분기), `app/page.tsx:780-797`(예매 모달 입력란), `app/page.tsx:849`(결제 대기 모달 입금자명), `app/page.tsx:909-918,984-986`(이용안내 문구)

**Interfaces:**
- Consumes: `profile`, `authLoading`(Task 10), `signInWithGoogle`(Task 2)
- Produces: 없음(최종 사용자 흐름)

- [ ] **Step 1: `handleInputChange` 삭제 (더 이상 존재하지 않는 `formData`를 참조하는 죽은 코드)**

기존(라인 253-256):
```tsx
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

```
교체 후: (통째로 삭제)

- [ ] **Step 2: 로딩/로그인 게이트 분기 추가**

기존(라인 569-584):
```tsx
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center select-none overflow-hidden">
        <div className="relative flex flex-col items-center justify-center animate-pulse">
          <div className="absolute w-48 h-48 md:w-64 md:h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>
          <div style={{ fontFamily: "var(--font-song-myung), serif" }} className="text-center flex flex-col leading-tight z-10 text-slate-100">
            <span className="text-[60px] md:text-[80px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">영화</span>
            <span className="text-[60px] md:text-[80px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">대교</span>
          </div>
          <p className="mt-8 text-amber-500/80 text-[10px] md:text-xs tracking-[0.4em] font-bold z-10 uppercase font-sans">시스템 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
```
교체 후:
```tsx
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center select-none overflow-hidden">
        <div className="relative flex flex-col items-center justify-center animate-pulse">
          <div className="absolute w-48 h-48 md:w-64 md:h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>
          <div style={{ fontFamily: "var(--font-song-myung), serif" }} className="text-center flex flex-col leading-tight z-10 text-slate-100">
            <span className="text-[60px] md:text-[80px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">영화</span>
            <span className="text-[60px] md:text-[80px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">대교</span>
          </div>
          <p className="mt-8 text-amber-500/80 text-[10px] md:text-xs tracking-[0.4em] font-bold z-10 uppercase font-sans">로그인 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center select-none p-4">
        <div style={{ fontFamily: "var(--font-song-myung), serif" }} className="text-center flex flex-col leading-tight z-10 text-slate-100 mb-10">
          <span className="text-[50px] md:text-[70px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">영화</span>
          <span className="text-[50px] md:text-[70px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">대교</span>
        </div>
        <p className="text-slate-400 text-sm mb-8 text-center">학교(@ts.hs.kr) 구글 계정으로 로그인해주세요.</p>
        <button
          onClick={() => signInWithGoogle().catch(() => showAlert('로그인에 실패했습니다.'))}
          className="flex items-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-bold py-4 px-8 rounded-xl shadow-lg transition-all"
        >
          구글 계정으로 로그인
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center select-none overflow-hidden">
        <div className="relative flex flex-col items-center justify-center animate-pulse">
          <div className="absolute w-48 h-48 md:w-64 md:h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>
          <div style={{ fontFamily: "var(--font-song-myung), serif" }} className="text-center flex flex-col leading-tight z-10 text-slate-100">
            <span className="text-[60px] md:text-[80px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">영화</span>
            <span className="text-[60px] md:text-[80px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">대교</span>
          </div>
          <p className="mt-8 text-amber-500/80 text-[10px] md:text-xs tracking-[0.4em] font-bold z-10 uppercase font-sans">시스템 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
```

- [ ] **Step 3: 예매 모달 입력란을 프로필 읽기전용 표시로 교체**

기존(라인 780-797):
```tsx
              <div>
                <label className="block text-slate-300 mb-1 text-sm">학번</label>
                <input type="text" name="studentId" value={formData.studentId} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="예: 2703 (교직원은 '교직원')"/>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 text-sm">이름 (본명)</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="이름을 정확히 입력하세요"/>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 text-sm">예매 확인용 비밀번호 (숫자 4자리)</label>
                <input type="password" name="password" maxLength={4} value={formData.password} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="반드시 숫자 4자리 입력"/>
                <p className="text-rose-400/90 text-xs mt-2 font-bold">* 좌석 변경 및 영화관 입장 확인 시 필요하므로 절대 잊어버리지 마세요!</p>
                {showResetButton && (
                  <button onClick={handleRequestReset} disabled={isResetting} className="mt-3 text-sm text-amber-400 hover:text-amber-300 underline underline-offset-4 font-bold block w-full text-left">
                    {isResetting ? "메일 발송 중..." : "🚨 본인인데 비밀번호를 모르겠나요? (이메일로 재설정)"}
                  </button>
                )}
              </div>
```
교체 후:
```tsx
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <p className="text-slate-500 text-xs mb-1">예매자 (구글 계정으로 확인됨)</p>
                <p className="text-white font-bold text-lg">{profile.name} <span className="text-slate-400 font-normal text-sm">{profile.student_id ?? '교직원'}</span></p>
                <p className="text-slate-500 text-xs mt-1">{profile.email}</p>
              </div>
```

- [ ] **Step 4: 결제 대기 모달 입금자명 표시 교체**

기존(라인 849):
```tsx
              <p className="text-sm text-slate-300">입금자명: <span className="text-indigo-400 font-bold">{formData.studentId} {formData.name}</span></p>
```
교체 후:
```tsx
              <p className="text-sm text-slate-300">입금자명: <span className="text-indigo-400 font-bold">{profile.student_id ?? ''} {profile.name}</span></p>
```

- [ ] **Step 5: 이용안내 모달의 비밀번호 관련 문구 수정**

기존(라인 909, 913-916):
```tsx
                <p>배치도에서 원하는 좌석을 누른 후, 화면 하단의 <span className="text-indigo-400 font-bold">예매하기</span> 버튼을 클릭하세요. 본인의 학번, 이름, 그리고 예매 확인용 4자리 비밀번호를 입력하면 예약이 확정됩니다.</p>
                <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <p className="text-indigo-200 leading-relaxed">
                      <span className="font-bold text-indigo-300">4자리 비밀번호는 영구적으로 유지되며,</span><br/>
                      티켓 출력 및 좌석 변경 시 반드시 필요하니 꼭 기억해 주세요!
                    </p>
                  </div>
                </div>
```
교체 후:
```tsx
                <p>배치도에서 원하는 좌석을 누른 후, 화면 하단의 <span className="text-indigo-400 font-bold">예매하기</span> 버튼을 클릭하면, 로그인된 구글 계정 정보로 바로 예약이 확정됩니다.</p>
                <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <p className="text-indigo-200 leading-relaxed">
                      <span className="font-bold text-indigo-300">학번/이름은 구글 계정 이름에서 자동으로 인식됩니다.</span><br/>
                      정보가 잘못 표시되면 동아리 관리자에게 문의해주세요.
                    </p>
                  </div>
                </div>
```

기존(라인 984-986):
```tsx
              <div>
                <h3 className="font-bold text-white text-lg mb-1">6. 비밀번호를 잊으셨을 경우</h3>
                <p>예매창 하단의 <span className="text-rose-400 font-bold">비밀번호 찾기</span>를 누르면 학교 이메일로 비밀번호 재설정 링크가 즉시 전송됩니다.</p>
              </div>
```
교체 후: (섹션 자체를 삭제 — 비밀번호 개념이 없어졌으므로)

- [ ] **Step 6: 커밋**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/page.tsx): 로그인 게이트 화면과 프로필 기반 예매 UI로 교체

미로그인 시 구글 로그인 버튼만 노출. 예매 모달의 학번/이름/비밀번호
입력란을 로그인된 프로필 읽기전용 표시로 교체. 이용안내 텍스트에서
비밀번호 관련 안내 제거.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part E: 취소 / 단체초대 확정 / 키오스크 페이지

### Task 17: `app/cancel/page.tsx` 전체 재작성 — 세션 기반 본인 확인

147줄로 작은 파일이라 전체를 교체한다. 비밀번호 입력 대신, 로그인 세션의 `user_id`가 예약의 `user_id`와 일치하는지로 본인 확인한다.

**Files:**
- Modify: `app/cancel/page.tsx` (전체 교체)

**Interfaces:**
- Consumes: `ensureProfile`, `signInWithGoogle`, `authFetch`, `DomainNotAllowedError`(Task 2), `POST /api/reservations` `CANCEL_OWN`(Task 8)
- Produces: 없음(최종 사용자 흐름)

- [ ] **Step 1: 파일 전체 교체**

```tsx
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ensureProfile, signInWithGoogle, authFetch, DomainNotAllowedError, type AppProfile } from '@/lib/supabase-auth';

function CancelForm() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const router = useRouter();

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const p = await ensureProfile();
        if (active) setProfile(p);
      } catch (err) {
        if (err instanceof DomainNotAllowedError) alert('🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다.');
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    bootstrap();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ticketId) {
      supabase.from('reservations').select('*').eq('id', ticketId).single().then(({ data }) => {
        setTicket(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [ticketId]);

  const handleCancel = async () => {
    if (isCanceling) return;
    setIsCanceling(true);
    try {
      const res = await authFetch('/api/reservations', { action: 'CANCEL_OWN', payload: { reservationId: ticketId } });
      const data = await res.json();
      if (!data.success) { alert(`❌ ${data.error || '취소 중 오류가 발생했습니다.'}`); return; }

      const canceledTicket = data.ticket;

      if (canceledTicket.email) {
        const { data: movieSettings } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
        const isRefundNeeded = canceledTicket.popcorn_order !== 'none' && canceledTicket.payment_status === 'confirmed';
        await fetch('/api/ticket', {
          method: 'POST',
          body: JSON.stringify({
            email: canceledTicket.email, name: canceledTicket.student_name, seat: canceledTicket.seat_number,
            movieTitle: movieSettings?.title, movieDate: movieSettings?.date_string,
            statusType: 'canceled', popcorn: canceledTicket.popcorn_order, ticketId: canceledTicket.id,
            baseUrl: window.location.origin, isRefundNeeded
          })
        });
      }

      alert("✅ 예매가 정상적으로 취소되었습니다.");
      router.push('/');
    } finally {
      setIsCanceling(false);
    }
  };

  if (authLoading || loading) return <div className="text-white text-center mt-20 font-bold">데이터를 불러오는 중...</div>;

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <p className="text-white font-bold mb-6">예매를 취소하려면 학교(@ts.hs.kr) 구글 계정으로 로그인해주세요.</p>
        <button onClick={() => signInWithGoogle()} className="py-3 px-8 bg-white text-gray-900 font-bold rounded-lg">구글 계정으로 로그인</button>
      </div>
    );
  }

  if (!ticket) return <div className="text-white text-center mt-20 font-bold">존재하지 않거나 이미 취소된 예매 내역입니다.</div>;

  if (ticket.user_id !== profile.id) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <p className="text-white font-bold text-center">🚫 본인 예약이 아닙니다.<br/>이 링크는 {ticket.student_name}님의 예매 취소 링크입니다.</p>
      </div>
    );
  }

  const isPaidPopcorn = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-red-500 mb-2">예매 취소</h1>
        <p className="text-gray-300 text-sm mb-6 bg-gray-700 p-3 rounded-lg">
          좌석: <span className="font-bold text-white">{ticket.seat_number}</span><br/>
          예매자: <span className="font-bold text-white">{ticket.student_id} {ticket.student_name}</span>
        </p>

        {isPaidPopcorn && (
          <div className="mb-6 bg-yellow-900/30 border border-yellow-600 p-4 rounded-xl text-yellow-500 text-sm font-bold">
            🚨 결제가 확정된 팝콘 예매가 포함되어 있습니다.<br/>
            온라인상으로는 예매 내역이 즉시 취소되지만,<br/>
            <span className="text-yellow-400">환불 금액은 영화 상영 당일 현장에서<br/>학생회 스태프를 찾아와 직접 수령하셔야 합니다.</span>
          </div>
        )}

        <button onClick={handleCancel} disabled={isCanceling} className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-white font-bold transition-colors shadow-lg">
          {isCanceling ? '취소 처리 중...' : '예매 취소하기'}
        </button>
      </div>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={<div className="text-white text-center mt-20">로딩 중...</div>}>
      <CancelForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/cancel/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/cancel): 비밀번호 입력 대신 구글 세션으로 본인 확인

ticket.user_id와 로그인 세션의 profile.id가 일치할 때만 취소 버튼을
노출한다. 취소 처리는 /api/reservations CANCEL_OWN을 호출하고,
서버가 돌려준 ticket.email로 취소 안내 메일을 보낸다.
비밀번호 재설정 요청 로직은 완전히 제거.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 18: `app/group-confirm/page.tsx` 전체 재작성 — 세션 기반 본인 확인 + CONFIRM_GROUP/LEAVE_GROUP API 사용

팝콘 선택/QR결제 UI(라인 226-300 부근)는 인증과 무관하므로 그대로 보존한다. 바뀌는 것은: 비밀번호 입력 단계 제거, 본인 확인을 세션으로, 확정/거절을 `/api/reservations`로.

**Files:**
- Modify: `app/group-confirm/page.tsx` (전체 교체)

**Interfaces:**
- Consumes: `ensureProfile`, `signInWithGoogle`, `authFetch`, `DomainNotAllowedError`(Task 2), `POST /api/reservations` `CONFIRM_GROUP`/`LEAVE_GROUP`(Task 8)
- Produces: 없음(최종 사용자 흐름)

- [ ] **Step 1: 파일 전체 교체**

```tsx
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ensureProfile, signInWithGoogle, authFetch, DomainNotAllowedError, type AppProfile } from '@/lib/supabase-auth';
import AccountInfo from '@/components/AccountInfo';

function GroupConfirmForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const groupId = searchParams.get('groupId');
  const memberId = searchParams.get('memberId');

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [myReservation, setMyReservation] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [leader, setLeader] = useState<any>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isAlreadyConfirmed, setIsAlreadyConfirmed] = useState(false);

  // 🍿 팝콘 선택 관련 상태
  const [showPopcornStep, setShowPopcornStep] = useState(false);
  const [popcornList, setPopcornList] = useState<string[]>(['none']);
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const p = await ensureProfile();
        if (active) setProfile(p);
      } catch (err) {
        if (err instanceof DomainNotAllowedError) alert('🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다.');
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    bootstrap();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (groupId && memberId) fetchGroupData();
  }, [groupId, memberId]);

  const fetchGroupData = async () => {
    try {
      const { data: myData } = await supabase.from('reservations')
        .select('*').eq('id', memberId).single();

      if (!myData) { setLoading(false); return; }
      setMyReservation(myData);

      if (myData.payment_status === 'confirmed') {
        setIsAlreadyConfirmed(true);
      }

      if (myData.group_expires_at && new Date(myData.group_expires_at) < new Date()) {
        setIsExpired(true);
      }

      const { data: groupData } = await supabase.from('reservations')
        .select('*').eq('group_id', groupId).order('is_group_leader', { ascending: false });

      if (groupData) {
        const leaderData = groupData.find(r => r.is_group_leader);
        setLeader(leaderData);
        setGroupMembers(groupData.filter(r => !r.is_group_leader));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePopcornChange = (index: number, value: string) => {
    let newList = [...popcornList];
    newList[index] = value;
    const filtered = newList.filter(p => p !== 'none');
    filtered.push('none');
    setPopcornList(filtered);
  };

  const handleSkipPopcorn = async () => {
    await finalizeConfirm('none');
  };

  const handlePopcornConfirm = async () => {
    const finalPopcornString = popcornList.filter(p => p !== 'none').join(',') || 'none';
    if (finalPopcornString !== 'none') {
      await finalizeConfirm(finalPopcornString, true);
    } else {
      await finalizeConfirm('none');
    }
  };

  const finalizeConfirm = async (popcornOrder: string, showQR: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/reservations', {
        action: 'CONFIRM_GROUP',
        payload: { reservationId: memberId, popcornOrder }
      });
      const data = await res.json();
      if (!data.success) { alert(`❌ ${data.error || '확정 중 오류가 발생했습니다.'}`); return; }

      const ticket = data.ticket;

      if (ticket.email) {
        const { data: movieSettings } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
        if (movieSettings) {
          fetch('/api/ticket', {
            method: 'POST',
            body: JSON.stringify({
              email: ticket.email, name: ticket.student_name, seat: ticket.seat_number,
              movieTitle: movieSettings.title, movieDate: movieSettings.date_string,
              statusType: ticket.payment_status, popcorn: popcornOrder, ticketId: memberId,
              baseUrl: window.location.origin
            })
          });
        }
      }

      if (showQR) {
        setShowPaymentQR(true);
      } else {
        alert("✅ 예매가 확정되었습니다! 학교 이메일로 티켓이 발송되었습니다.");
        router.push('/');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm("정말 단체에서 나가시겠습니까?\n해당 좌석이 해제됩니다.")) return;

    const res = await authFetch('/api/reservations', { action: 'LEAVE_GROUP', payload: { reservationId: memberId } });
    const data = await res.json();
    if (!data.success) { alert(`❌ ${data.error || '처리 중 오류가 발생했습니다.'}`); return; }

    alert("단체에서 나갔습니다. 좌석이 해제되었습니다.");
    router.push('/');
  };

  if (authLoading || loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-white font-bold animate-pulse">데이터를 불러오는 중...</p></div>;

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <p className="text-white font-bold mb-6 text-center">단체 관람 초대를 확인하려면<br/>학교(@ts.hs.kr) 구글 계정으로 로그인해주세요.</p>
        <button onClick={() => signInWithGoogle()} className="py-3 px-8 bg-white text-slate-900 font-bold rounded-xl">구글 계정으로 로그인</button>
      </div>
    );
  }

  if (!myReservation) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-white font-bold">존재하지 않거나 이미 처리된 초대입니다.</p></div>;

  if (myReservation.user_id !== profile.id) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <p className="text-white font-bold text-center">🚫 본인 초대가 아닙니다.<br/>이 링크는 {myReservation.student_name}님을 위한 초대 링크입니다.</p>
      </div>
    );
  }

  // 🍿 팝콘 결제 QR 화면
  if (showPaymentQR) {
    const totalPrice = popcornList.filter(p => p !== 'none').length * 2500;
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/90 backdrop-blur-xl p-8 rounded-2xl max-w-sm w-full border border-amber-500/30 text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <h2 className="text-2xl font-bold text-amber-400 mb-2">결제 대기 중</h2>
          <p className="text-slate-300 mb-6 text-sm">QR코드로 30분 내에 입금을 완료해주세요.</p>
          <div className="bg-white p-4 rounded-xl mb-4 inline-block"><img src="/qr.jpeg" alt="QR" loading="lazy" decoding="async" className="w-48 h-48 object-contain" /></div>
          <div className="mb-6"><AccountInfo /></div>
          <div className="bg-slate-800 rounded-xl p-4 text-left mb-6 border border-slate-700">
            <p className="text-sm text-slate-300 mb-1">결제 금액: <span className="text-amber-400 font-bold text-xl">{totalPrice.toLocaleString()}원</span></p>
            <p className="text-sm text-slate-300">입금자명: <span className="text-indigo-400 font-bold">{myReservation.student_id} {myReservation.student_name}</span></p>
          </div>
          <p className="text-slate-400 text-xs mb-4">입금 확인 후 관리자가 예매를 확정합니다.<br/>학교 이메일로도 안내가 발송되었습니다.</p>
          <button onClick={() => router.push('/')} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold transition-all text-sm">메인 페이지로 돌아가기</button>
        </div>
      </div>
    );
  }

  // 🍿 팝콘 선택 단계 화면
  if (showPopcornStep) {
    const totalPrice = popcornList.filter(p => p !== 'none').length * 2500;
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center select-none">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-bold text-center mb-2 text-amber-400">🍿 팝콘 선택</h1>
          <p className="text-center text-slate-400 mb-8 text-sm">
            단체 확정 전, 팝콘을 선택할 수 있습니다.<br/>
            <span className="text-white font-bold">{myReservation.student_name}</span>님 · 좌석 <span className="text-emerald-400 font-bold">{myReservation.seat_number}</span>
          </p>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
            <label className="block text-slate-300 mb-3 text-sm font-bold">🍿 팝콘 선택 (개당 2,500원)</label>

            {popcornList.map((pop, idx) => (
              <div key={idx} className="mb-3 flex items-center gap-2">
                <span className="text-slate-400 text-xs w-12 text-center">
                  {pop === 'none' ? '추가' : `선택 ${idx + 1}`}
                </span>
                <select
                  value={pop}
                  onChange={(e) => handlePopcornChange(idx, e.target.value)}
                  className="flex-1 p-2 rounded-lg bg-slate-800 border border-slate-600 outline-none text-sm text-slate-200"
                >
                  <option value="none">{pop === 'none' ? '+ 팝콘 추가하기 (선택 시 결제 필요)' : '선택 취소'}</option>
                  <option value="original">오리지널 버터 팝콘 (2,500원)</option>
                  <option value="consomme">콘소메맛 팝콘 (2,500원)</option>
                  <option value="caramel">카라멜맛 팝콘 (2,500원)</option>
                </select>
              </div>
            ))}

            <p className="text-xs text-slate-400 mt-2">* 팝콘은 여러 개 추가할 수 있습니다. (음료는 배부하지 않습니다.)</p>

            {totalPrice > 0 && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex justify-between items-center">
                <span className="text-amber-400 font-bold">총 결제 예정 금액</span>
                <span className="text-xl font-bold text-amber-400">{totalPrice.toLocaleString()}원</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSkipPopcorn} disabled={isSubmitting} className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 font-bold transition-all text-sm disabled:opacity-50">
              팝콘 없이 확정
            </button>
            <button onClick={handlePopcornConfirm} disabled={isSubmitting} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-xl text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm disabled:opacity-50">
              {totalPrice > 0 ? `팝콘 포함 확정 (${totalPrice.toLocaleString()}원)` : '팝콘 없이 확정'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center select-none">
      <div className="w-full max-w-lg">

        <h1 className="text-3xl font-bold text-center mb-2 text-emerald-400">🎬 단체 관람 초대</h1>
        <p className="text-center text-slate-400 mb-8 text-sm">예매를 확정하여 단체에 합류하세요</p>

        {isExpired && (
          <div className="bg-rose-900/30 border border-rose-500/50 p-4 rounded-xl mb-6 text-center">
            <p className="text-rose-400 font-bold">⏰ 초대 시간이 만료되었습니다.</p>
            <p className="text-slate-400 text-sm mt-1">1시간이 경과하여 이 초대는 더 이상 유효하지 않습니다.</p>
          </div>
        )}

        {isAlreadyConfirmed && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded-xl mb-6 text-center">
            <p className="text-emerald-400 font-bold">✅ 이미 예매가 확정된 상태입니다.</p>
            <button onClick={() => router.push('/')} className="mt-3 text-sm text-indigo-400 underline">메인 페이지로 돌아가기</button>
          </div>
        )}

        {/* 그룹 현황 */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">📋 단체 현황</h2>
          {leader && (
            <div className="bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-xl mb-3 flex items-center gap-3">
              <span className="text-emerald-400 font-bold">👑</span>
              <div>
                <p className="text-emerald-300 font-bold text-sm">{leader.student_name} <span className="text-emerald-500 text-xs">(리더)</span></p>
                <p className="text-slate-400 text-xs">좌석: {leader.seat_number} · ✅ 확정됨</p>
              </div>
            </div>
          )}
          {groupMembers.map((m) => (
            <div key={m.id} className={`p-3 rounded-xl mb-2 flex items-center gap-3 ${m.id === memberId ? 'bg-sky-900/30 border border-sky-500/30' : 'bg-slate-800/50 border border-slate-700'}`}>
              <span className={`font-bold text-sm ${m.id === memberId ? 'text-sky-400' : 'text-slate-500'}`}>
                {m.payment_status === 'confirmed' ? '✅' : '⏳'}
              </span>
              <div>
                <p className={`font-bold text-sm ${m.id === memberId ? 'text-sky-300' : 'text-slate-300'}`}>
                  {m.student_name} {m.id === memberId && <span className="text-sky-500 text-xs">(나)</span>}
                </p>
                <p className="text-slate-400 text-xs">
                  좌석: {m.seat_number} · {m.payment_status === 'confirmed' ? '확정됨' : '대기 중'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 본인 정보 */}
        {!isExpired && !isAlreadyConfirmed && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
            <h2 className="text-lg font-bold text-white mb-4">🎫 내 예매 정보</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800 p-3 rounded-lg">
                <p className="text-slate-500 text-xs mb-1">학번</p>
                <p className="text-white font-bold">{myReservation.student_id ?? '교직원'}</p>
              </div>
              <div className="bg-slate-800 p-3 rounded-lg">
                <p className="text-slate-500 text-xs mb-1">이름</p>
                <p className="text-white font-bold">{myReservation.student_name}</p>
              </div>
              <div className="bg-slate-800 p-3 rounded-lg col-span-2">
                <p className="text-slate-500 text-xs mb-1">좌석</p>
                <p className="text-emerald-400 font-black text-2xl">{myReservation.seat_number}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleLeave} className="flex-1 py-3 bg-rose-600/80 hover:bg-rose-500 border border-rose-500 rounded-lg text-white font-bold transition-all text-sm">
                단체에서 나가기
              </button>
              <button onClick={() => setShowPopcornStep(true)} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm">
                예매 확정하기
              </button>
            </div>
          </div>
        )}

        <button onClick={() => router.push('/')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-600 text-sm">
          🏠 메인 페이지로 돌아가기
        </button>
      </div>
    </div>
  );
}

export default function GroupConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-white font-bold">로딩 중...</p></div>}>
      <GroupConfirmForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/group-confirm/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/group-confirm): 비밀번호 검증 대신 구글 세션으로 본인 확인

myReservation.user_id와 로그인 세션의 profile.id가 일치할 때만
확정/거절 UI를 노출한다. 확정은 /api/reservations CONFIRM_GROUP,
거절은 LEAVE_GROUP을 호출한다(verify_student_password RPC와
클라이언트 직접 delete 제거). 팝콘 선택/QR결제 UI는 그대로 유지.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 19: `app/print/page.tsx` — 키오스크 잠금/발권을 비밀번호 없는 방식으로 전환

이 파일의 영수증/바코드 렌더링 부분(라인 196-343 대부분)은 인증과 무관하므로 손대지 않는다. 키오스크는 spec 6절에 따라 구글 로그인을 요구하지 않는다(현장 관리자 잠금으로 보호되는 공유 기기이므로) — 잠금 비밀번호만 하드코딩에서 DB 조회로 바뀐다.

**Files:**
- Modify: `app/print/page.tsx`

**Interfaces:**
- Consumes: `POST /api/kiosk` `KIOSK_LOGIN`/`PRINT_TICKET`(Task 6)
- Produces: 없음(최종 사용자 흐름)

- [ ] **Step 1: import 교체**

기존(라인 1-10):
```tsx
"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { USER_EMAILS } from '@/lib/emails';
import Link from 'next/link';

// (STUDENT_LIST, STAFF_LIST 명단은 기존 그대로 유지)

import { STUDENT_LIST, STAFF_LIST } from '../../lib/constants';

```
교체 후:
```tsx
"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

```

- [ ] **Step 2: `formData` 타입에서 `password` 제거**

기존(라인 17):
```tsx
  const [formData, setFormData] = useState({ studentId: '', name: '', password: '' });
```
교체 후:
```tsx
  const [formData, setFormData] = useState({ studentId: '', name: '' });
```

- [ ] **Step 3: `afterprint` 핸들러의 초기화 값에서 `password` 제거**

기존(라인 50-57):
```tsx
  useEffect(() => {
    const handleAfterPrint = () => {
      setTicketData(null);
      setFormData({ studentId: '', name: '', password: '' });
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);
```
교체 후:
```tsx
  useEffect(() => {
    const handleAfterPrint = () => {
      setTicketData(null);
      setFormData({ studentId: '', name: '' });
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);
```

- [ ] **Step 4: `handleAdminLogin`을 DB 조회 기반으로 교체, `handleRequestReset` 삭제**

기존(라인 63-89):
```tsx
  const handleAdminLogin = () => {
    if (adminPasswordInput === "영화대교최고") {
      setIsAdminAuth(true);
    } else {
      alert("관리자 비밀번호가 틀렸습니다.");
      setAdminPasswordInput('');
    }
  };

  const handleRequestReset = async () => {
    const cleanId = formData.studentId.replace(/['"]/g, '').trim();
    setIsResetting(true);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ studentId: cleanId, studentName: formData.name, baseUrl: window.location.origin, returnUrl: '/print' })
      });
      if (res.ok) {
        alert("학교 이메일로 비밀번호 재설정 링크가 발송되었습니다. 폰에서 확인해주세요!");
        setShowResetButton(false);
      } else {
        alert("이메일 발송에 실패했습니다.");
      }
    } finally {
      setIsResetting(false);
    }
  };
```
교체 후:
```tsx
  const handleAdminLogin = async () => {
    try {
      const res = await fetch('/api/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'KIOSK_LOGIN', payload: { password: adminPasswordInput } })
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminAuth(true);
      } else {
        alert("관리자 비밀번호가 틀렸습니다.");
        setAdminPasswordInput('');
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };
```

- [ ] **Step 5: `handlePrintSubmit`에서 비밀번호/명렬표 검증 제거**

기존(라인 91-156):
```tsx
  const handlePrintSubmit = async () => {
    if (!formData.studentId || !formData.name || !formData.password) return alert("정보를 모두 입력해주세요.");
    const cleanId = formData.studentId.replace(/['"]/g, '').trim();

    if (cleanId === "교직원") {
      if (!STAFF_LIST.includes(formData.name)) return alert("등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanId.length !== 4) return alert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanId] !== formData.name) return alert("학번과 이름이 일치하지 않습니다.");
    }

    if (isPrinting) return;
    setIsPrinting(true);

    try {
      const authKey = cleanId === "교직원" ? formData.name : cleanId;
      const { data: authResult, error: authError } = await supabase.rpc('verify_student_password', { 
        p_student_id: authKey, 
        p_password: formData.password 
      });

      if (authError || !authResult.success) {
        setShowResetButton(true);
        return alert("❌ 비밀번호가 일치하지 않습니다.");
      } else {
        setShowResetButton(false);
      }

      const { data: ticket } = await supabase.from('reservations')
        .select('*')
        .eq('student_id', cleanId)
        .eq('student_name', formData.name)
        .eq('movie_date', movieInfo.db_date)
        .single();

      if (!ticket) return alert("예매 내역이 존재하지 않습니다.");

      if (ticket.is_printed) {
        return alert("⚠️ 이미 현장에서 발권이 완료된 티켓입니다! (1인 1매 원칙)\n오류인 경우 관리자에게 문의하세요.");
      }

      // 🌟 [수정됨] RLS(보안) 정책에 의해 클라이언트 직접 수정이 막히는 문제를 해결하기 위해 안전한 서버 API 호출로 업데이트
      const apiRes = await fetch('/api/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PRINT_TICKET',
          payload: { ticketId: ticket.id, studentId: cleanId, studentName: formData.name, password: formData.password, seatNumber: ticket.seat_number }
        })
      });
      const apiData = await apiRes.json();
      
      if (!apiData.success) {
        alert("⚠️ 서버 오류로 발권 기록 업데이트에 실패했습니다. 관리자에게 문의하세요.");
        return;
      }

      ticket.is_printed = true; // 화면 반영을 위한 상태 업데이트
      setTicketData(ticket);

    } catch (err) {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsPrinting(false);
    }
  };
```
교체 후:
```tsx
  const handlePrintSubmit = async () => {
    if (!formData.studentId || !formData.name) return alert("학번과 이름을 모두 입력해주세요.");
    const cleanId = formData.studentId.replace(/['"]/g, '').trim();

    if (isPrinting) return;
    setIsPrinting(true);

    try {
      const { data: ticket } = await supabase.from('reservations')
        .select('*')
        .eq('student_id', cleanId)
        .eq('student_name', formData.name)
        .eq('movie_date', movieInfo.db_date)
        .single();

      if (!ticket) return alert("예매 내역이 존재하지 않습니다. 학번/이름을 다시 확인해주세요.");

      if (ticket.is_printed) {
        return alert("⚠️ 이미 현장에서 발권이 완료된 티켓입니다! (1인 1매 원칙)\n오류인 경우 관리자에게 문의하세요.");
      }

      const apiRes = await fetch('/api/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PRINT_TICKET',
          payload: { ticketId: ticket.id, studentId: cleanId, studentName: formData.name, seatNumber: ticket.seat_number }
        })
      });
      const apiData = await apiRes.json();

      if (!apiData.success) {
        alert("⚠️ 서버 오류로 발권 기록 업데이트에 실패했습니다. 관리자에게 문의하세요.");
        return;
      }

      ticket.is_printed = true;
      setTicketData(ticket);

    } catch (err) {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsPrinting(false);
    }
  };
```

- [ ] **Step 6: 발권 폼 JSX에서 비밀번호 입력란 제거**

기존(라인 216-233):
```tsx
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-bold">학번</label>
                  <input type="text" name="studentId" value={formData.studentId} onChange={handleInputChange} className="w-full p-4 rounded-xl bg-gray-700 text-white border border-gray-600 outline-none focus:border-yellow-500 text-lg" placeholder="예: 2703" />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-bold">이름</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-4 rounded-xl bg-gray-700 text-white border border-gray-600 outline-none focus:border-yellow-500 text-lg" placeholder="본명 입력" />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-bold">예매 비밀번호 (숫자 4자리)</label>
                  <input type="password" name="password" maxLength={4} value={formData.password} onChange={handleInputChange} className="w-full p-4 rounded-xl bg-gray-700 text-white border border-gray-600 outline-none focus:border-yellow-500 text-center text-2xl tracking-widest" placeholder="****" />
                  {showResetButton && (
                    <button onClick={handleRequestReset} disabled={isResetting} className="mt-3 text-sm text-red-400 hover:text-red-300 underline font-bold block w-full text-left">
                      {isResetting ? "메일 발송 중..." : "🚨 비밀번호를 잊으셨나요? (폰으로 재설정 링크 받기)"}
                    </button>
                  )}
                </div>
              </div>
```
교체 후:
```tsx
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-bold">학번</label>
                  <input type="text" name="studentId" value={formData.studentId} onChange={handleInputChange} className="w-full p-4 rounded-xl bg-gray-700 text-white border border-gray-600 outline-none focus:border-yellow-500 text-lg" placeholder="예: 2703" />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-bold">이름</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-4 rounded-xl bg-gray-700 text-white border border-gray-600 outline-none focus:border-yellow-500 text-lg" placeholder="본명 입력" />
                </div>
              </div>
```

- [ ] **Step 7: 이제 쓰이지 않는 `showResetButton`/`isResetting` state 제거**

기존(라인 23-24):
```tsx
  const [showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

```
교체 후: (통째로 삭제)

- [ ] **Step 8: 커밋**

```bash
git add app/print/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/print): 키오스크 잠금/발권을 비밀번호 없는 방식으로 전환

잠금 화면은 하드코딩 문자열 대신 /api/kiosk KIOSK_LOGIN(DB 조회)로
검증. 발권은 학번+이름만으로 예약을 조회한다(verify_student_password
RPC, 비밀번호 재설정 요청 로직 모두 제거). 영수증/바코드 렌더링은
변경 없음.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part F: 관리자 사이트 (`app/admin/page.tsx`)

683줄짜리 파일이라 여러 태스크로 나눈다. 표 렌더링(라인 599-681)이나 설정 편집 폼(라인 510-549) 등 인증과 무관한 JSX는 손대지 않는다.

### Task 20: 로그인 화면을 구글 OAuth 게이트로 교체

**Files:**
- Modify: `app/admin/page.tsx:1-10`(import), `:12-38`(상태), `:55-101`(localStorage 자동로그인/`toggleSkipAuth`), `:359-393`(`handleAdminLogin`/로그인 화면 JSX)

**Interfaces:**
- Consumes: `ensureProfile`, `signInWithGoogle`, `authFetch`, `DomainNotAllowedError`(Task 2)
- Produces: `profile: AppProfile | null`, `authLoading`, `isAdmin: boolean` 상태. Task 21(나머지 핸들러들)이 `authFetch`를 사용하게 된다.

- [ ] **Step 1: import 교체**

기존(라인 1-10):
```tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { USER_EMAILS } from '../../lib/emails';
import Link from 'next/link';

import { STUDENT_LIST, CLUB_MEMBERS } from '../../lib/constants';

const POPCORN_NAMES: Record<string, string> = { "original": "오리지널", "consomme": "콘소메", "caramel": "카라멜" };
```
교체 후:
```tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ensureProfile, signInWithGoogle, authFetch, DomainNotAllowedError, type AppProfile } from '../../lib/supabase-auth';
import Link from 'next/link';

const POPCORN_NAMES: Record<string, string> = { "original": "오리지널", "consomme": "콘소메", "caramel": "카라멜" };
```

- [ ] **Step 2: `password`/`isAuthenticated`/`skipAuth` 상태를 세션 기반 상태로 교체**

기존(라인 12-38 중 관련 부분, 라인 13-14, 38):
```tsx
export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
```
교체 후:
```tsx
export default function AdminPage() {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
```

기존(라인 36-38):
```tsx
  const [baseUrl, setBaseUrl] = useState('');
  useEffect(() => setBaseUrl(window.location.origin), []);
  const [skipAuth, setSkipAuth] = useState(false);
```
교체 후:
```tsx
  const [baseUrl, setBaseUrl] = useState('');
  useEffect(() => setBaseUrl(window.location.origin), []);
```

- [ ] **Step 3: localStorage 자동로그인 useEffect와 `toggleSkipAuth`를 세션 부트스트랩으로 교체**

기존(라인 55-101):
```tsx
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('skip_auth') === 'true') {
      const savedPass = localStorage.getItem('admin_token');
      if (savedPass) {
        setPassword(savedPass);
        setSkipAuth(true);
        setIsAuthenticated(true);
      } else {
        localStorage.setItem('skip_auth', 'false');
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchAdminData();
    // password는 인증 시점 이후 변경되지 않으므로 의존성에서 제외
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSkipAuth = async () => {
    let currentPass = password;
    if (!skipAuth) {
      const pass = prompt("자동 로그인을 켜기 위해 관리자 비밀번호를 입력해주세요:");
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'LOGIN', adminPassword: pass })
      });
      const data = await res.json();
      if (!data.success) {
        alert("비밀번호가 틀렸습니다. 설정을 변경할 수 없습니다.");
        return;
      }
      currentPass = pass || '';
    }

    const newVal = !skipAuth;
    if (typeof window !== 'undefined') {
      if (newVal) {
        localStorage.setItem('skip_auth', 'true');
        localStorage.setItem('admin_token', currentPass);
      } else {
        localStorage.setItem('skip_auth', 'false');
        localStorage.removeItem('admin_token');
      }
    }
    setSkipAuth(newVal);
    alert(newVal ? "현재 브라우저에서 관리자/발권기 접속 시 비밀번호가 생략됩니다! (베타용)" : "비밀번호 생략이 해제되었습니다.");
  };
```
교체 후:
```tsx
  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const p = await ensureProfile();
        if (active) setProfile(p);
      } catch (err) {
        if (err instanceof DomainNotAllowedError) alert('🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다.');
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    bootstrap();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (profile) checkAdminAndLoad();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAdminAndLoad = async () => {
    setCheckingAdmin(true);
    const ok = await fetchAdminData();
    setIsAdmin(ok);
    setCheckingAdmin(false);
  };
```

- [ ] **Step 4: `handleAdminLogin`과 로그인 화면 JSX를 구글 로그인 게이트로 교체**

기존(라인 359-393):
```tsx
  const handleAdminLogin = async () => {
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'LOGIN', adminPassword: password })
    });
    const data = await res.json();
    if (data.success) {
      setIsAuthenticated(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">🔒 관리자 로그인</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
          className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 mb-4 text-center outline-none focus:border-blue-500"
          placeholder="비밀번호 입력"
        />
        <button
          onClick={handleAdminLogin}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors"
        >
          접속하기
        </button>

      </div>
    </div>
  );
```
교체 후:
```tsx
  if (authLoading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <p className="text-white font-bold animate-pulse">로그인 확인 중...</p>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">🔒 관리자 로그인</h1>
        <p className="text-gray-400 text-sm mb-6">학교(@ts.hs.kr) 구글 계정으로 로그인해주세요.</p>
        <button
          onClick={() => signInWithGoogle().catch(() => alert('로그인에 실패했습니다.'))}
          className="w-full py-3 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-bold transition-colors"
        >
          구글 계정으로 로그인
        </button>
      </div>
    </div>
  );

  if (checkingAdmin) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <p className="text-white font-bold animate-pulse">권한 확인 중...</p>
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-red-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-red-400 mb-4">🚫 권한 없음</h1>
        <p className="text-gray-400 text-sm">{profile.email} 계정은 관리자로 등록되어 있지 않습니다.</p>
      </div>
    </div>
  );
```

- [ ] **Step 5: 커밋**

```bash
git add app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/admin): 관리자 로그인을 비밀번호에서 구글 OAuth로 전환

localStorage 기반 자동로그인/비밀번호 프롬프트를 전부 제거하고
구글 세션 + admins 테이블 조회(FETCH_INITIAL_DATA의 403 응답)로
권한을 판단한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 21: 데이터 조회/조작 핸들러를 `authFetch`로 전환 + `USER_EMAILS`/`STUDENT_LIST` 제거

**Files:**
- Modify: `app/admin/page.tsx:33-35`(관리/동아리/키오스크 상태 선행 선언), `:103-142`(`fetchAdminData`), `:152-182`(`proceedSave`), `:184-208`(`handleApprove`), `:210-235`(`handleCancel`), `:237-257`(`handleResetPrint`), `:259-305`(`handleAddBlacklist`/`handleRemoveBlacklist`), `:582-597`(블랙리스트 추가 폼 JSX)

**Interfaces:**
- Consumes: `authFetch`(Task 2), Task 5의 새 응답 필드(`adminData`, `clubData`, `kioskPassword`, `ADD_BLACKLIST`/`REMOVE_BLACKLIST`의 `email`)
- Produces: `admins`, `clubMembers`, `kioskPasswordInput` 상태(값 채우기는 여기서, CRUD UI는 Task 23). Task 22(신규 블랙리스트 입력 폼)가 여기서 추가한 `newBlackName` 상태를 사용한다.

- [ ] **Step 1: 관리자/동아리/키오스크 상태 선언 추가**

기존(라인 33-35):
```tsx
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [newBlackId, setNewBlackId] = useState('');
```
교체 후:
```tsx
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [newBlackId, setNewBlackId] = useState('');
  const [newBlackName, setNewBlackName] = useState('');

  const [admins, setAdmins] = useState<{email: string, added_by: string | null, created_at: string}[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [clubMembers, setClubMembers] = useState<{student_id: string, added_by: string | null, created_at: string}[]>([]);
  const [newClubStudentId, setNewClubStudentId] = useState('');
  const [kioskPasswordInput, setKioskPasswordInput] = useState('');
```

- [ ] **Step 2: `fetchAdminData` 재작성 (권한 여부를 반환값으로 전달)**

기존(라인 103-142):
```tsx
  const fetchAdminData = async () => {
    setIsLoadingUI(true);
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'FETCH_INITIAL_DATA', adminPassword: password })
      });
      const { data, success, error } = await res.json();

      if (!success) {
        if (res.status === 401) setIsAuthenticated(false);
        alert(`데이터 불러오기 실패: ${error}`);
        return console.error("데이터 로드 실패:", error);
      }

      const { movieData, resData, blData, logData } = data;
      if (movieData) {
        setMovieInfo(movieData);
        setEditForm({
          ...movieData,
          age_rating: movieData.age_rating || '전체관람가',
          mid_vip_start_row: movieData.mid_vip_start_row || 'A',
          mid_vip_end_row: movieData.mid_vip_end_row || 'C',
          mid_vip_start_col: movieData.mid_vip_start_col || 5,
          mid_vip_end_col: movieData.mid_vip_end_col || 10,
          grand_vip_start_row: movieData.grand_vip_start_row || 'A',
          grand_vip_end_row: movieData.grand_vip_end_row || 'C',
          grand_vip_start_col: movieData.grand_vip_start_col || 10,
          grand_vip_end_col: movieData.grand_vip_end_col || 18,
        });
      }
      if (resData) setReservations(resData);
      if (blData) setBlacklist(blData);
      if (logData) setLogs(logData);
    } catch (err) {
      console.error("데이터 불러오기 오류:", err);
    } finally {
      setIsLoadingUI(false);
    }
  };
```
교체 후:
```tsx
  const fetchAdminData = async (): Promise<boolean> => {
    setIsLoadingUI(true);
    try {
      const res = await authFetch('/api/admin/action', { action: 'FETCH_INITIAL_DATA' });
      const { data, success, error } = await res.json();

      if (!success) {
        if (res.status === 401 || res.status === 403) return false;
        alert(`데이터 불러오기 실패: ${error}`);
        console.error("데이터 로드 실패:", error);
        return true;
      }

      const { movieData, resData, blData, logData, adminData, clubData, kioskPassword } = data;
      if (movieData) {
        setMovieInfo(movieData);
        setEditForm({
          ...movieData,
          age_rating: movieData.age_rating || '전체관람가',
          mid_vip_start_row: movieData.mid_vip_start_row || 'A',
          mid_vip_end_row: movieData.mid_vip_end_row || 'C',
          mid_vip_start_col: movieData.mid_vip_start_col || 5,
          mid_vip_end_col: movieData.mid_vip_end_col || 10,
          grand_vip_start_row: movieData.grand_vip_start_row || 'A',
          grand_vip_end_row: movieData.grand_vip_end_row || 'C',
          grand_vip_start_col: movieData.grand_vip_start_col || 10,
          grand_vip_end_col: movieData.grand_vip_end_col || 18,
        });
      }
      if (resData) setReservations(resData);
      if (blData) setBlacklist(blData);
      if (logData) setLogs(logData);
      if (adminData) setAdmins(adminData);
      if (clubData) setClubMembers(clubData);
      if (typeof kioskPassword === 'string') setKioskPasswordInput(kioskPassword);
      return true;
    } catch (err) {
      console.error("데이터 불러오기 오류:", err);
      return true;
    } finally {
      setIsLoadingUI(false);
    }
  };
```

- [ ] **Step 3: `proceedSave`에서 `adminPassword` 제거**

기존(라인 162-165, 172-175):
```tsx
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'UPDATE_SETTINGS', adminPassword: password, payload })
    });
```
교체 후:
```tsx
    const res = await authFetch('/api/admin/action', { action: 'UPDATE_SETTINGS', payload });
```

기존:
```tsx
        await fetch('/api/admin/action', {
          method: 'POST',
          body: JSON.stringify({ action: 'CLEAR_RESERVATIONS', adminPassword: password, payload: { movieDate: movieInfo.db_date } })
        });
```
교체 후:
```tsx
        await authFetch('/api/admin/action', { action: 'CLEAR_RESERVATIONS', payload: { movieDate: movieInfo.db_date } });
```

- [ ] **Step 4: `handleApprove`에서 `adminPassword` 제거 + `USER_EMAILS` → `ticket.email`**

기존(라인 184-208):
```tsx
  const handleApprove = async (ticket: any) => {
    const popcorns = ticket.popcorn_order !== 'none' ? ticket.popcorn_order.split(',') : [];
    const totalPrice = popcorns.length * 2500;

    if (!confirm(`${ticket.student_name}님의 예매를 확정하시겠습니까?\n(입금 확인 금액: ${totalPrice.toLocaleString()}원)`)) return;

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'APPROVE_RESERVATION',
        adminPassword: password,
        payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
      })
    });

    const data = await res.json();
    if (!data.success) return alert("승인 실패: " + data.error);

    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'confirmed', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl }) });
    }
    setReservations(prev => prev.map(r => r.id === ticket.id ? { ...r, payment_status: 'confirmed' } : r));
    alert("승인 완료 및 이메일 발송됨!");
  };
```
교체 후:
```tsx
  const handleApprove = async (ticket: any) => {
    const popcorns = ticket.popcorn_order !== 'none' ? ticket.popcorn_order.split(',') : [];
    const totalPrice = popcorns.length * 2500;

    if (!confirm(`${ticket.student_name}님의 예매를 확정하시겠습니까?\n(입금 확인 금액: ${totalPrice.toLocaleString()}원)`)) return;

    const res = await authFetch('/api/admin/action', {
      action: 'APPROVE_RESERVATION',
      payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
    });

    const data = await res.json();
    if (!data.success) return alert("승인 실패: " + data.error);

    if (ticket.email) {
      fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: ticket.email, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'confirmed', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl }) });
    }
    setReservations(prev => prev.map(r => r.id === ticket.id ? { ...r, payment_status: 'confirmed' } : r));
    alert("승인 완료 및 이메일 발송됨!");
  };
```

- [ ] **Step 5: `handleCancel`에서 `adminPassword` 제거 + `USER_EMAILS` → `ticket.email`**

기존(라인 210-235):
```tsx
  const handleCancel = async (ticket: any) => {
    if (!confirm(`정말 ${ticket.student_name}님의 예매를 취소하시겠습니까?`)) return;

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'CANCEL_RESERVATION',
        adminPassword: password,
        payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
      })
    });

    const data = await res.json();
    if (!data.success) return alert("취소 실패: " + data.error);

    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
      });
    }
    setReservations(prev => prev.filter(r => r.id !== ticket.id));
    alert("취소 완료 및 이메일 발송됨!");
  };
```
교체 후:
```tsx
  const handleCancel = async (ticket: any) => {
    if (!confirm(`정말 ${ticket.student_name}님의 예매를 취소하시겠습니까?`)) return;

    const res = await authFetch('/api/admin/action', {
      action: 'CANCEL_RESERVATION',
      payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
    });

    const data = await res.json();
    if (!data.success) return alert("취소 실패: " + data.error);

    if (ticket.email) {
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({ email: ticket.email, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
      });
    }
    setReservations(prev => prev.filter(r => r.id !== ticket.id));
    alert("취소 완료 및 이메일 발송됨!");
  };
```

- [ ] **Step 6: `handleResetPrint`에서 `adminPassword` 제거**

기존(라인 237-257):
```tsx
  const handleResetPrint = async (ticket: any) => {
    if (!confirm(`${ticket.student_name}님의 티켓 발권 상태를 '미발권'으로 초기화하시겠습니까?\n(학생이 현장 키오스크에서 다시 티켓을 출력할 수 있게 됩니다.)`)) return;

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'RESET_PRINT',
        adminPassword: password,
        payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
      })
    });

    const data = await res.json();
    if (!data.success) {
      alert("초기화 실패: " + data.error);
      return;
    }

    setReservations(prev => prev.map(r => r.id === ticket.id ? { ...r, is_printed: false } : r));
    alert("✅ 발권 상태가 초기화되었습니다.");
  };
```
교체 후:
```tsx
  const handleResetPrint = async (ticket: any) => {
    if (!confirm(`${ticket.student_name}님의 티켓 발권 상태를 '미발권'으로 초기화하시겠습니까?\n(학생이 현장 키오스크에서 다시 티켓을 출력할 수 있게 됩니다.)`)) return;

    const res = await authFetch('/api/admin/action', {
      action: 'RESET_PRINT',
      payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
    });

    const data = await res.json();
    if (!data.success) {
      alert("초기화 실패: " + data.error);
      return;
    }

    setReservations(prev => prev.map(r => r.id === ticket.id ? { ...r, is_printed: false } : r));
    alert("✅ 발권 상태가 초기화되었습니다.");
  };
```

- [ ] **Step 7: `handleAddBlacklist`/`handleRemoveBlacklist`에서 명렬표 대조 제거, 이름 자유 입력으로 전환**

기존(라인 259-305):
```tsx
  const handleAddBlacklist = async () => {
    if (newBlackId.length !== 4) return alert("학번 4자리를 정확히 입력해주세요.");
    const studentName = STUDENT_LIST[newBlackId];
    if (!studentName) return alert("존재하지 않는 학번입니다.");

    if (!confirm(`${studentName}(${newBlackId}) 학생을 블랙리스트에 추가하시겠습니까?\n(⚠️ 주의: 현재 진행 중이거나 완료된 예매 내역이 있다면 자동으로 취소됩니다.)`)) return;

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'ADD_BLACKLIST', adminPassword: password, payload: { studentId: newBlackId, studentName, movieDate: movieInfo.db_date } })
    });
    const data = await res.json();
    if (!data.success) return alert("추가 실패 (이미 등록된 학생일 수 있습니다.)");

    const userEmail = USER_EMAILS[newBlackId];
    if (data.canceledTicket && userEmail) {
      const ticket = data.canceledTicket;
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail, name: studentName, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
      });
    }

    if (userEmail) {
      fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: userEmail, name: studentName, action: 'added' }) });
    }

    setBlacklist(prev => [...prev, { student_id: newBlackId, student_name: studentName }]);
    setReservations(prev => prev.filter(r => r.student_id !== newBlackId));
    setNewBlackId('');
    alert("블랙리스트 추가 및 예매 자동 취소 처리가 완료되었습니다!");
  };

  const handleRemoveBlacklist = async (studentId: string, studentName: string) => {
    if (!confirm(`${studentName}(${studentId}) 학생의 블랙리스트를 해제하시겠습니까?`)) return;
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'REMOVE_BLACKLIST', adminPassword: password, payload: { studentId } })
    });
    const data = await res.json();
    if (!data.success) return alert("해제 실패");
    const userEmail = USER_EMAILS[studentId];
    if (userEmail) fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: userEmail, name: studentName, action: 'removed' }) });
    setBlacklist(prev => prev.filter(b => b.student_id !== studentId));
    alert("해제 완료 및 안내 메일 발송!");
  };
```
교체 후:
```tsx
  const handleAddBlacklist = async () => {
    if (newBlackId.length !== 4) return alert("학번 4자리를 정확히 입력해주세요.");
    if (!newBlackName.trim()) return alert("이름을 입력해주세요.");
    const studentName = newBlackName.trim();

    if (!confirm(`${studentName}(${newBlackId}) 학생을 블랙리스트에 추가하시겠습니까?\n(⚠️ 주의: 현재 진행 중이거나 완료된 예매 내역이 있다면 자동으로 취소됩니다.)`)) return;

    const res = await authFetch('/api/admin/action', { action: 'ADD_BLACKLIST', payload: { studentId: newBlackId, studentName, movieDate: movieInfo.db_date } });
    const data = await res.json();
    if (!data.success) return alert("추가 실패 (이미 등록된 학생일 수 있습니다.)");

    if (data.canceledTicket && data.email) {
      const ticket = data.canceledTicket;
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({ email: data.email, name: studentName, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
      });
    }

    if (data.email) {
      fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: data.email, name: studentName, action: 'added' }) });
    }

    setBlacklist(prev => [...prev, { student_id: newBlackId, student_name: studentName }]);
    setReservations(prev => prev.filter(r => r.student_id !== newBlackId));
    setNewBlackId('');
    setNewBlackName('');
    alert("블랙리스트 추가 및 예매 자동 취소 처리가 완료되었습니다!" + (data.email ? '' : '\n(등록된 이메일이 없어 안내 메일은 발송되지 않았습니다.)'));
  };

  const handleRemoveBlacklist = async (studentId: string, studentName: string) => {
    if (!confirm(`${studentName}(${studentId}) 학생의 블랙리스트를 해제하시겠습니까?`)) return;
    const res = await authFetch('/api/admin/action', { action: 'REMOVE_BLACKLIST', payload: { studentId } });
    const data = await res.json();
    if (!data.success) return alert("해제 실패");
    if (data.email) fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: data.email, name: studentName, action: 'removed' }) });
    setBlacklist(prev => prev.filter(b => b.student_id !== studentId));
    alert("해제 완료" + (data.email ? ' 및 안내 메일 발송!' : ' (등록된 이메일이 없어 안내 메일은 발송되지 않았습니다.)'));
  };
```

- [ ] **Step 8: 블랙리스트 추가 폼에 이름 입력란 추가**

기존(라인 584-587):
```tsx
        <div className="flex gap-2 mb-6">
          <input type="text" maxLength={4} value={newBlackId} onChange={(e) => setNewBlackId(e.target.value)} placeholder="학번 4자리 입력" className="p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white w-48" />
          <button onClick={handleAddBlacklist} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold transition-colors">추가하기</button>
        </div>
```
교체 후:
```tsx
        <div className="flex gap-2 mb-6">
          <input type="text" maxLength={4} value={newBlackId} onChange={(e) => setNewBlackId(e.target.value)} placeholder="학번 4자리" className="p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white w-32" />
          <input type="text" value={newBlackName} onChange={(e) => setNewBlackName(e.target.value)} placeholder="이름" className="p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white w-32" />
          <button onClick={handleAddBlacklist} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold transition-colors">추가하기</button>
        </div>
```

- [ ] **Step 9: 커밋**

```bash
git add app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/admin): 데이터 조작 핸들러를 authFetch로 전환

adminPassword 바디 파라미터를 전부 제거하고 authFetch(Bearer 토큰)로
교체. USER_EMAILS 조회는 서버가 돌려주는 ticket.email/응답의 email
필드로 대체. 블랙리스트 추가는 명렬표 대조 없이 학번+이름을 자유
입력받는다(이름 입력란 추가).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 22: 상단 툴바를 로그아웃 버튼으로 교체 + 대량 홍보 메일 기능 완전 삭제

spec 1절/7절 결정에 따라 대량 홍보 메일(학년별/전체/개인 발송) 기능을 통째로 제거한다. `profiles`가 로그인 이력이 있는 사람만 존재해서 이 기능이 애초에 무력화되기 때문.

**Files:**
- Modify: `app/admin/page.tsx:26-31`(promo 상태 삭제), `:307-357`(`handleSendPromoClick`/`executeSendPromo` 삭제), `:397-405`(툴바), `:424-447`(홍보 발송 확인 모달 삭제), `:551-580`(홍보 메일 섹션 삭제)

**Interfaces:**
- Consumes: `signOutAndClear`(Task 2)
- Produces: 없음

- [ ] **Step 1: promo 관련 상태 선언 삭제**

기존(라인 26-31):
```tsx
  const [promoTargets, setPromoTargets] = useState({ grade1: false, grade2: false, grade3: false, staff: false, club: true });
  const [singleTarget, setSingleTarget] = useState("");
  const [isSendingPromo, setIsSendingPromo] = useState(false);
  const [promoProgress, setPromoProgress] = useState({ current: 0, total: 0 });
  const [showPromoWarning, setShowPromoWarning] = useState(false);
  const [pendingPromoRecipients, setPendingPromoRecipients] = useState<any[]>([]);
```
교체 후: (통째로 삭제)

- [ ] **Step 2: `handleSendPromoClick`/`executeSendPromo` 삭제**

기존(라인 307-357, `handleAddBlacklist`/`handleRemoveBlacklist`와 `handleAdminLogin` 사이):
```tsx
  const handleSendPromoClick = () => {
    const recipientMap = new Map();
    if (promoTargets.club) {
      CLUB_MEMBERS.forEach(id => {
        if (USER_EMAILS[id]) recipientMap.set(id, { studentId: id, email: USER_EMAILS[id], name: STUDENT_LIST[id] || "학생" });
      });
    }
    if (singleTarget && USER_EMAILS[singleTarget]) {
      const name = isNaN(Number(singleTarget)) ? singleTarget : STUDENT_LIST[singleTarget] || "학생";
      recipientMap.set(singleTarget, { studentId: singleTarget, email: USER_EMAILS[singleTarget], name });
    }
    Object.keys(USER_EMAILS).forEach(key => {
      let shouldAdd = false;
      if (promoTargets.grade1 && key.startsWith('1') && key.length === 4) shouldAdd = true;
      if (promoTargets.grade2 && key.startsWith('2') && key.length === 4) shouldAdd = true;
      if (promoTargets.grade3 && key.startsWith('3') && key.length === 4) shouldAdd = true;
      if (promoTargets.staff && isNaN(Number(key))) shouldAdd = true;
      if (shouldAdd) recipientMap.set(key, { studentId: key, email: USER_EMAILS[key], name: isNaN(Number(key)) ? key : STUDENT_LIST[key] || "학생" });
    });

    const recipients = Array.from(recipientMap.values());
    if (recipients.length === 0) return alert("선택된 발송 대상이 없습니다.");

    setPendingPromoRecipients(recipients);
    setShowPromoWarning(true);
  };

  const executeSendPromo = async () => {
    setShowPromoWarning(false); setIsSendingPromo(true);
    const recipients = pendingPromoRecipients;
    setPromoProgress({ current: 0, total: recipients.length });

    const CHUNK_SIZE = 15;
    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);
      try { await fetch('/api/promo', { method: 'POST', body: JSON.stringify({ chunk, movieInfo, baseUrl }) }); } catch (err) { console.error(err); }
      setPromoProgress({ current: Math.min(i + CHUNK_SIZE, recipients.length), total: recipients.length });
      await new Promise(res => setTimeout(res, 1000));
    }

    await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'LOG_ACTION',
        adminPassword: password,
        payload: { studentId: "관리자", studentName: "-", description: `홍보 이메일 발송 완료 (${recipients.length}명)` }
      })
    });

    setIsSendingPromo(false); alert("✅ 홍보 메일 발송 완료!"); fetchAdminData();
  };
```
교체 후: (통째로 삭제)

- [ ] **Step 3: 상단 툴바를 프로필 표시 + 로그아웃 버튼으로 교체**

기존(라인 395-405):
```tsx
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 relative">
      <div className="w-full flex flex-wrap justify-end gap-3 mb-6 z-20">
        {isAuthenticated && (
          <button onClick={toggleSkipAuth} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors shadow-lg border ${skipAuth ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-400' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-400'}`}>
            {skipAuth ? "🔓 자동 로그인 (ON)" : "🔒 자동 로그인 (OFF)"}
          </button>
        )}
        <Link href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">🏠 메인 홈</Link>
        <Link href="/print" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">🖨️ 현장 발권기</Link>
      </div>
```
교체 후:
```tsx
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 relative">
      <div className="w-full flex flex-wrap justify-end items-center gap-3 mb-6 z-20">
        <span className="text-xs md:text-sm text-gray-500">{profile.email}</span>
        <button onClick={() => signOutAndClear().then(() => window.location.reload())} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs md:text-sm text-slate-400 font-bold transition-colors shadow-lg">
          🚪 로그아웃
        </button>
        <Link href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">🏠 메인 홈</Link>
        <Link href="/print" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">🖨️ 현장 발권기</Link>
      </div>
```

(이 Step에서 `signOutAndClear`를 쓰므로 Task 20 Step 1의 import 줄에 추가한다: `import { ensureProfile, signInWithGoogle, signOutAndClear, authFetch, DomainNotAllowedError, type AppProfile } from '../../lib/supabase-auth';`)

- [ ] **Step 4: 홍보 발송 확인 모달 JSX 삭제**

기존(라인 424-447, `showVenueWarning` 모달과 로딩 스피너 사이):
```tsx
      {showPromoWarning && (
        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-gray-900 p-8 rounded-2xl max-w-lg w-full border-4 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)] text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 animate-pulse">📧 대량 메일 발송 확인</h2>
            <div className="text-blue-200 text-base md:text-lg font-bold space-y-4 mb-8">
              <p>현재 선택된 그룹을 바탕으로 명단을 추출했습니다.</p>
              <div className="bg-blue-950 p-6 rounded-xl text-white border border-blue-800 shadow-inner">
                <p className="text-sm text-blue-300 mb-2">발송 예정 총 인원</p>
                <p className="text-6xl text-yellow-400 font-black drop-shadow-md">
                  {pendingPromoRecipients.length}<span className="text-2xl text-white ml-2 font-bold">명</span>
                </p>
              </div>
              <p className="text-sm text-gray-400 font-normal leading-relaxed">
                (발송 중에는 창을 닫거나 새로고침하지 말고,<br />로딩 게이지가 다 찰 때까지 잠시만 기다려 주세요.)
              </p>
              <p className="text-white">위 인원에게 홍보 메일을 발송하시겠습니까?</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowPromoWarning(false)} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-bold text-lg transition-colors">돌아가기</button>
              <button onClick={executeSendPromo} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-lg shadow-[0_0_15px_rgba(59,130,246,0.8)] transition-colors">발송 시작 🚀</button>
            </div>
          </div>
        </div>
      )}

```
교체 후: (통째로 삭제)

- [ ] **Step 5: 홍보 메일 발송 섹션 JSX 삭제**

기존(라인 551-580, `isEditingSettings` 설정 편집 패널과 블랙리스트 관리 섹션 사이):
```tsx
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-blue-600 mb-8">
        <h2 className="text-xl font-bold text-blue-400 mb-4">📧 상영작 홍보 메일 발송</h2>
        <div className="flex flex-wrap gap-6 mb-6">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={promoTargets.grade1} onChange={e => setPromoTargets({ ...promoTargets, grade1: e.target.checked })} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">1학년</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={promoTargets.grade2} onChange={e => setPromoTargets({ ...promoTargets, grade2: e.target.checked })} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">2학년</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={promoTargets.grade3} onChange={e => setPromoTargets({ ...promoTargets, grade3: e.target.checked })} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">3학년</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={promoTargets.staff} onChange={e => setPromoTargets({ ...promoTargets, staff: e.target.checked })} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">교직원</span></label>
          <label className="flex items-center gap-2 cursor-pointer border-l-2 border-gray-600 pl-6 ml-2"><input type="checkbox" checked={promoTargets.club} onChange={e => setPromoTargets({ ...promoTargets, club: e.target.checked })} className="w-5 h-5 accent-purple-600" /> <span className="text-purple-400 font-bold">테스트용 (동아리부원 10명)</span></label>
        </div>

        <div className="mb-6 p-4 bg-gray-700/50 rounded-xl border border-gray-600">
          <label className="block text-gray-300 mb-2 text-sm font-bold">🎯 특정 1인에게만 보내기 (선택)</label>
          <select value={singleTarget} onChange={e => setSingleTarget(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-600 outline-none focus:border-blue-500">
            <option value="">-- 개인 발송 안 함 (위에 체크된 그룹에게만 발송) --</option>
            <optgroup label="👩‍🏫 교직원">{Object.keys(USER_EMAILS).filter(k => isNaN(Number(k))).sort().map(staff => <option key={staff} value={staff}>{staff}</option>)}</optgroup>
            <optgroup label="🎓 1학년">{Object.keys(USER_EMAILS).filter(k => k.startsWith('1') && k.length === 4).sort().map(id => <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>)}</optgroup>
            <optgroup label="🎓 2학년">{Object.keys(USER_EMAILS).filter(k => k.startsWith('2') && k.length === 4).sort().map(id => <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>)}</optgroup>
            <optgroup label="🎓 3학년">{Object.keys(USER_EMAILS).filter(k => k.startsWith('3') && k.length === 4).sort().map(id => <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>)}</optgroup>
          </select>
        </div>

        {isSendingPromo ? (
          <div className="w-full bg-gray-700 rounded-full h-8 relative overflow-hidden border border-gray-600">
            <div className="bg-blue-600 h-8 transition-all duration-300 flex items-center justify-center" style={{ width: `${(promoProgress.current / promoProgress.total) * 100}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md">안전 발송 중... ({promoProgress.current} / {promoProgress.total})</span>
          </div>
        ) : (
          <button onClick={handleSendPromoClick} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl shadow-lg transition-colors">🚀 체크한 대상에게 홍보 메일 발송하기</button>
        )}
      </div>

```
교체 후: (통째로 삭제)

- [ ] **Step 6: 커밋**

```bash
git add app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/admin): 대량 홍보 메일 기능 삭제, 로그아웃 버튼 추가

profiles가 로그인 이력이 있는 사람만 존재해 대량 홍보 메일 기능이
전제부터 무력화되므로(스펙 1절) 완전히 삭제. 자동로그인 토글 버튼은
구글 로그아웃 버튼으로 교체.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 23: 관리자/동아리원/키오스크 비밀번호 관리 탭 추가

기존 하드코딩 배열(`ADMIN_PASSWORD`, `CLUB_MEMBERS`, 키오스크 문자열)을 관리자 페이지에서 직접 편집할 수 있게 한다(spec 7절). Task 20~22가 모두 적용된 뒤 실행한다(아래 anchor 텍스트들이 그 결과물이기 때문).

**Files:**
- Modify: `app/admin/page.tsx` (Task 21에서 만든 `handleRemoveBlacklist` 바로 뒤에 핸들러 추가, Task 20에서 만든 로그인 게이트 직전에 위치), `app/admin/page.tsx`(설정 편집 패널과 블랙리스트 섹션 사이에 JSX 추가)

**Interfaces:**
- Consumes: `LIST_ADMINS`/`ADD_ADMIN`/`REMOVE_ADMIN`/`LIST_CLUB_MEMBERS`/`ADD_CLUB_MEMBER`/`REMOVE_CLUB_MEMBER`/`UPDATE_KIOSK_PASSWORD`(Task 5), `admins`/`clubMembers`/`kioskPasswordInput`(Task 21)
- Produces: 없음

- [ ] **Step 1: 핸들러 추가**

`handleRemoveBlacklist` 함수(Task 21에서 작성) 바로 뒤, `if (authLoading) return (`(Task 20에서 작성) 바로 앞에 추가:

```tsx
  const handleAddAdmin = async () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email.endsWith('@ts.hs.kr')) return alert("@ts.hs.kr 이메일만 등록할 수 있습니다.");
    const res = await authFetch('/api/admin/action', { action: 'ADD_ADMIN', payload: { email } });
    const data = await res.json();
    if (!data.success) return alert("추가 실패: " + data.error);
    setAdmins(prev => [{ email, added_by: profile.email, created_at: new Date().toISOString() }, ...prev]);
    setNewAdminEmail('');
  };

  const handleRemoveAdmin = async (email: string) => {
    if (email === profile.email) return alert("본인 계정은 스스로 제거할 수 없습니다.");
    if (!confirm(`${email}의 관리자 권한을 제거하시겠습니까?`)) return;
    const res = await authFetch('/api/admin/action', { action: 'REMOVE_ADMIN', payload: { email } });
    const data = await res.json();
    if (!data.success) return alert("제거 실패: " + data.error);
    setAdmins(prev => prev.filter(a => a.email !== email));
  };

  const handleAddClubMember = async () => {
    const studentId = newClubStudentId.trim();
    if (!/^\d{4}$/.test(studentId)) return alert("학번은 4자리 숫자로 입력해주세요.");
    const res = await authFetch('/api/admin/action', { action: 'ADD_CLUB_MEMBER', payload: { studentId } });
    const data = await res.json();
    if (!data.success) return alert("추가 실패: " + data.error);
    setClubMembers(prev => [{ student_id: studentId, added_by: profile.email, created_at: new Date().toISOString() }, ...prev]);
    setNewClubStudentId('');
  };

  const handleRemoveClubMember = async (studentId: string) => {
    if (!confirm(`${studentId} 학생을 동아리원(VIP)에서 제거하시겠습니까?`)) return;
    const res = await authFetch('/api/admin/action', { action: 'REMOVE_CLUB_MEMBER', payload: { studentId } });
    const data = await res.json();
    if (!data.success) return alert("제거 실패: " + data.error);
    setClubMembers(prev => prev.filter(c => c.student_id !== studentId));
  };

  const handleUpdateKioskPassword = async () => {
    if (!kioskPasswordInput.trim()) return alert("키오스크 비밀번호를 입력해주세요.");
    const res = await authFetch('/api/admin/action', { action: 'UPDATE_KIOSK_PASSWORD', payload: { password: kioskPasswordInput.trim() } });
    const data = await res.json();
    if (!data.success) return alert("변경 실패: " + data.error);
    alert("✅ 키오스크 잠금 비밀번호가 변경되었습니다.");
  };

```

- [ ] **Step 2: JSX 섹션 추가**

설정 편집 패널(`isEditingSettings && movieInfo && (...)`, Task 22에서 promo 섹션을 지운 뒤 그 자리) 바로 다음, 블랙리스트 관리 섹션(`🚫 블랙리스트 관리`) 바로 앞에 추가:

```tsx
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-emerald-600 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h2 className="text-lg font-bold text-emerald-400 mb-3">👑 관리자 목록</h2>
          <div className="flex gap-2 mb-3">
            <input type="text" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="xxxx@ts.hs.kr" className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleAddAdmin} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded font-bold text-sm">추가</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {admins.map(a => (
              <div key={a.email} className="flex items-center justify-between bg-gray-700/50 rounded px-2 py-1 text-xs">
                <span className="text-gray-200">{a.email}</span>
                <button onClick={() => handleRemoveAdmin(a.email)} className="text-red-400 hover:text-red-300 font-bold">×</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-indigo-400 mb-3">🎟️ 동아리원(VIP) 목록</h2>
          <div className="flex gap-2 mb-3">
            <input type="text" maxLength={4} value={newClubStudentId} onChange={e => setNewClubStudentId(e.target.value)} placeholder="학번 4자리" className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleAddClubMember} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded font-bold text-sm">추가</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {clubMembers.map(c => (
              <div key={c.student_id} className="flex items-center justify-between bg-gray-700/50 rounded px-2 py-1 text-xs">
                <span className="text-gray-200">{c.student_id}</span>
                <button onClick={() => handleRemoveClubMember(c.student_id)} className="text-red-400 hover:text-red-300 font-bold">×</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-yellow-400 mb-3">🖨️ 키오스크 잠금 비밀번호</h2>
          <div className="flex gap-2">
            <input type="text" value={kioskPasswordInput} onChange={e => setKioskPasswordInput(e.target.value)} className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleUpdateKioskPassword} className="bg-yellow-600 hover:bg-yellow-500 px-3 py-2 rounded font-bold text-sm text-black">변경</button>
          </div>
          <p className="text-gray-500 text-xs mt-2">현장 키오스크(/print) 진입 시 입력하는 비밀번호입니다.</p>
        </div>
      </div>

```

- [ ] **Step 3: 커밋**

```bash
git add app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/admin): 관리자/동아리원/키오스크 비밀번호 관리 탭 추가

하드코딩 ADMIN_PASSWORD/CLUB_MEMBERS/키오스크 문자열을 대체하는
DB 테이블(admins/club_members/kiosk_settings)을 관리자 페이지에서
직접 CRUD할 수 있게 한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part G: 구시대 코드 삭제

### Task 24: 관리자 페이지에 "프로필 수정" 패널 추가 (구글 이름 파싱 오류 대응)

spec 2절/10절: 구글 프로필 이름이 학생 스스로 잘못 설정했거나(공백 위치, 학번 누락 등) 파싱이 실패한 경우, 관리자가 해당 계정의 학번/이름/역할을 직접 고칠 수 있어야 한다. Task 4에서 만든 검색 API는 일반 사용자용(이메일 비노출)이라 관리자용으로 그대로 못 쓴다 — 이메일까지 보여주고 수정도 가능해야 하므로 `app/api/admin/action`에 전용 액션을 둔다(Task 5에서 이미 `SEARCH_PROFILE`/`UPDATE_PROFILE` 추가함).

**Files:**
- Modify: `app/admin/page.tsx` (Task 23에서 추가한 관리 탭 grid에 네 번째 칸 추가, 관련 상태/핸들러 추가)

**Interfaces:**
- Consumes: `SEARCH_PROFILE`/`UPDATE_PROFILE`(Task 5)
- Produces: 없음

- [ ] **Step 1: 상태 선언 추가**

Task 21 Step 1에서 추가한 상태 선언 바로 뒤에 추가:
```tsx
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileSearchResults, setProfileSearchResults] = useState<{id: string, email: string, student_id: string | null, name: string, role: string}[]>([]);
  const [editingProfile, setEditingProfile] = useState<{id: string, email: string, student_id: string, name: string, role: string} | null>(null);
```

- [ ] **Step 2: 핸들러 추가**

Task 23 Step 1에서 추가한 `handleUpdateKioskPassword` 함수 바로 뒤에 추가:
```tsx
  const handleSearchProfile = async () => {
    const res = await authFetch('/api/admin/action', { action: 'SEARCH_PROFILE', payload: { query: profileSearchQuery } });
    const data = await res.json();
    if (data.success) setProfileSearchResults(data.data);
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    if (editingProfile.role === 'student' && !/^\d{4}$/.test(editingProfile.student_id)) {
      return alert("학생은 학번 4자리가 필요합니다.");
    }
    const res = await authFetch('/api/admin/action', {
      action: 'UPDATE_PROFILE',
      payload: { id: editingProfile.id, studentId: editingProfile.student_id, name: editingProfile.name, role: editingProfile.role }
    });
    const data = await res.json();
    if (!data.success) return alert("저장 실패: " + data.error);
    alert("✅ 저장되었습니다.");
    setEditingProfile(null);
    setProfileSearchResults([]);
    setProfileSearchQuery('');
  };

```

- [ ] **Step 3: JSX 추가**

Task 23 Step 2에서 만든 `grid grid-cols-1 md:grid-cols-3`을 `md:grid-cols-4`로 넓히고, 그 안에 네 번째 칸을 추가한다.

기존(Task 23 Step 2가 만든 결과물의 첫 줄):
```tsx
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-emerald-600 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
```
교체 후:
```tsx
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-emerald-600 mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
```

같은 `div`의 마지막 칸(키오스크 비밀번호 칸) 바로 뒤, `</div>`(grid 닫는 태그) 바로 앞에 추가:
```tsx

        <div>
          <h2 className="text-lg font-bold text-pink-400 mb-3">🛠️ 사용자 프로필 수정</h2>
          <p className="text-gray-500 text-xs mb-2">구글 이름이 잘못 인식된 경우 여기서 고칩니다.</p>
          <div className="flex gap-2 mb-3">
            <input type="text" value={profileSearchQuery} onChange={e => setProfileSearchQuery(e.target.value)} placeholder="이메일/이름/학번" className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleSearchProfile} className="bg-pink-600 hover:bg-pink-500 px-3 py-2 rounded font-bold text-sm">검색</button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto mb-3">
            {profileSearchResults.map(p => (
              <button
                key={p.id}
                onClick={() => setEditingProfile({ id: p.id, email: p.email, student_id: p.student_id ?? '', name: p.name, role: p.role })}
                className="w-full text-left bg-gray-700/50 hover:bg-gray-700 rounded px-2 py-1 text-xs text-gray-200"
              >
                {p.email} — {p.name} ({p.student_id ?? '교직원'})
              </button>
            ))}
          </div>
          {editingProfile && (
            <div className="bg-gray-900 p-3 rounded-lg border border-pink-700 space-y-2">
              <p className="text-xs text-gray-400">{editingProfile.email}</p>
              <select value={editingProfile.role} onChange={e => setEditingProfile({ ...editingProfile, role: e.target.value })} className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs">
                <option value="student">학생</option>
                <option value="staff">교직원</option>
              </select>
              {editingProfile.role === 'student' && (
                <input type="text" maxLength={4} value={editingProfile.student_id} onChange={e => setEditingProfile({ ...editingProfile, student_id: e.target.value })} placeholder="학번 4자리" className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs" />
              )}
              <input type="text" value={editingProfile.name} onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })} placeholder="이름" className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs" />
              <div className="flex gap-2">
                <button onClick={() => setEditingProfile(null)} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold">취소</button>
                <button onClick={handleSaveProfile} className="flex-1 py-1.5 bg-pink-600 hover:bg-pink-500 rounded text-xs font-bold">저장</button>
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 4: 커밋**

```bash
git add app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat(app/admin): 사용자 프로필(학번/이름/역할) 수정 패널 추가

구글 프로필 이름 파싱이 잘못되거나 실패한 계정을 관리자가 직접
검색해서 학번/이름/역할을 고칠 수 있게 한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 25: 죽은 파일/코드 삭제 (하드 컷오버 완료 후)

Task 1~23이 모두 끝나 새 인증 시스템이 정상 동작함을 확인한 뒤 실행한다(9절 "하드 컷오버" 방침). 삭제 전에 참조가 남아있지 않은지 grep으로 반드시 확인한다.

**Files:**
- Delete: `lib/emails.ts`, `lib/constants.ts`, `app/reset-password/page.tsx`, `app/api/auth/request-reset/route.ts`, `app/api/promo/route.ts`
- Modify: `.env.local`, Vercel 프로젝트 환경변수(`ADMIN_PASSWORD` 제거)

**Interfaces:**
- Consumes: 없음
- Produces: 없음(순수 삭제)

- [ ] **Step 1: 참조가 남아있지 않은지 확인**

Run:
```bash
grep -rn "lib/emails\|USER_EMAILS\|lib/constants\|STUDENT_LIST\|STAFF_LIST\|CLUB_MEMBERS\|student_auth\|verify_student_password\|cancel_reservation_secure\|confirm_group_reservation\|adminPassword\|request-reset\|ADMIN_PASSWORD" app lib components 2>/dev/null
```
Expected: 아무 결과도 없어야 함. 결과가 남아있다면 해당 파일부터 먼저 고치고 이 태스크를 다시 시도한다.

- [ ] **Step 2: 파일 삭제**

```bash
git rm lib/emails.ts lib/constants.ts app/reset-password/page.tsx app/api/auth/request-reset/route.ts app/api/promo/route.ts
```

- [ ] **Step 3: 빌드로 최종 확인**

Run: `npm run build 2>&1 | tail -60`
Expected: 타입 에러나 "Module not found" 없이 빌드 성공.

- [ ] **Step 4: `.env.local`에서 `ADMIN_PASSWORD` 제거**

`.env.local`에서 `ADMIN_PASSWORD=...` 줄을 삭제한다(이 파일은 git에 커밋되지 않으므로 커밋 대상 아님, 로컬에서만 수정).

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: 구 비밀번호 인증 시스템 관련 코드 완전 삭제

lib/emails.ts(USER_EMAILS), lib/constants.ts(STUDENT_LIST/STAFF_LIST/
CLUB_MEMBERS), 비밀번호 재설정 페이지/API, 대량 홍보 메일 API 삭제.
DB의 student_auth 테이블과 verify_student_password/
cancel_reservation_secure/confirm_group_reservation RPC는 이미
Task 1 마이그레이션에서 삭제됨.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Vercel 환경변수에서 `ADMIN_PASSWORD` 제거 안내**

사용자에게 안내: Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 `ADMIN_PASSWORD`를 삭제하고 재배포해달라고 요청한다(Claude는 Vercel 대시보드 접근 권한이 없어 직접 할 수 없음).

---

## Part H: 외부 콘솔 설정 (사용자가 직접 수행)

### Task 26: Google Cloud Console + Supabase 대시보드 설정 가이드 작성

Claude는 이 두 콘솔에 접근할 수 없으므로, 사용자가 그대로 따라 할 수 있는 체크리스트 문서를 만든다. Task 1(DB 마이그레이션)이 끝난 뒤, 나머지 코드 태스크(2~24)와 병행해서 사용자가 진행할 수 있다.

**Files:**
- Create: `docs/superpowers/google-oauth-setup.md`

**Interfaces:**
- Consumes: 없음
- Produces: 사용자가 따라 할 체크리스트. 이 문서의 3단계(Supabase Google Provider 활성화)가 끝나야 Task 9 이후 페이지들의 로그인 버튼이 실제로 동작한다.

- [ ] **Step 1: 가이드 문서 작성**

```markdown
# Google OAuth 설정 가이드 (사용자 직접 수행)

Claude는 Google Cloud Console과 Supabase 대시보드에 접근할 수 없어서
아래 작업은 신민규 님이 직접 해야 합니다. 순서대로 따라 하면 됩니다.

## 1. Google Cloud Console — OAuth 동의 화면

1. https://console.cloud.google.com 접속, 새 프로젝트 생성(또는 기존 프로젝트 선택).
2. 왼쪽 메뉴 "API 및 서비스" → "OAuth 동의 화면" 이동.
3. User Type: "내부"(학교 Workspace 조직 내부용) 선택 가능하면 선택, 안 되면 "외부" + 게시 상태 "프로덕션".
4. 앱 이름: "영화대교 예매 시스템", 사용자 지원 이메일: 본인 학교 이메일 입력.
5. 승인된 도메인에 `ts.hs.kr`과 Vercel 배포 도메인(예: `hwip.vercel.app`처럼 실제 서비스 도메인)을 추가.

## 2. Google Cloud Console — OAuth 클라이언트 ID 생성

1. "API 및 서비스" → "사용자 인증 정보" → "+ 사용자 인증 정보 만들기" → "OAuth 클라이언트 ID".
2. 애플리케이션 유형: "웹 애플리케이션".
3. "승인된 리디렉션 URI"에 Supabase 콜백 URL 추가: `https://<Supabase 프로젝트 ref>.supabase.co/auth/v1/callback`
   (Supabase 프로젝트 ref는 대시보드 URL이나 Project Settings에서 확인 가능)
4. 생성 후 나오는 "클라이언트 ID"와 "클라이언트 보안 비밀번호(secret)"를 복사해둔다.

## 3. Supabase 대시보드 — Google Provider 활성화

1. https://supabase.com/dashboard → 해당 프로젝트 → Authentication → Providers.
2. "Google" 항목을 찾아 활성화(Enable).
3. 2단계에서 복사한 Client ID / Client Secret을 붙여넣고 저장.
4. Authentication → URL Configuration에서 "Site URL"과 "Redirect URLs"에 실제 서비스 도메인(예: `https://<서비스 도메인>/**`)이 등록되어 있는지 확인. 없으면 추가.

## 4. 최종 확인

- 배포된 사이트에서 구글 로그인 버튼을 눌러 실제 `@ts.hs.kr` 계정으로 로그인이 되는지 확인한다.
- 개인 Gmail 계정으로 시도했을 때 로그인 자체는 되더라도, 이후 화면에서 "🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다" 경고와 함께 자동 로그아웃되는지 확인한다(코드가 처리하는 부분, `lib/supabase-auth.ts`의 `ensureProfile`).
```

- [ ] **Step 2: 커밋**

```bash
git add docs/superpowers/google-oauth-setup.md
git commit -m "$(cat <<'EOF'
docs: Google OAuth 콘솔 설정 가이드 작성

Claude가 접근할 수 없는 Google Cloud Console/Supabase 대시보드
작업을 사용자가 직접 따라 할 수 있도록 체크리스트 형태로 정리.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part I: 최종 검증

### Task 27: 전체 흐름 수동 E2E 검증

이 저장소엔 테스트 프레임워크가 없으므로(Global Constraints 참고), `npm run build` 통과만으로 끝내지 않고 실제 배포(또는 `npm run dev`) 환경에서 아래 흐름을 전부 손으로 눌러본다. Task 26(Google OAuth 콘솔 설정)가 끝나 있어야 로그인이 실제로 동작한다.

**Files:** 없음(코드 변경 없음, 검증만)

- [ ] **Step 1: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 성공.

- [ ] **Step 2: 도메인 제한 확인**

`npm run dev`로 로컬 실행 후 `/`에서 구글 로그인 클릭 → 개인 Gmail 계정으로 로그인 시도.
Expected: 로그인은 되지만 즉시 "🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다" 알림과 함께 로그아웃되어 다시 로그인 버튼 화면으로 돌아옴.

- [ ] **Step 3: 최초 로그인 시 프로필 자동 생성 확인**

`@ts.hs.kr` 테스트 계정으로 로그인(이름이 "1234홍길동" 형식인 계정, 없다면 Supabase 대시보드에서 해당 auth.users 행의 이름 메타데이터를 임시로 그렇게 바꿔서 테스트).
Expected: 로그인 직후 `profiles` 테이블에 `student_id='1234', name='홍길동', role='student'` 행이 생김(Supabase 대시보드 Table Editor로 확인). 예매 모달에 학번/이름이 정확히 표시됨.

- [ ] **Step 4: 개인 예매 흐름**

빈 좌석 클릭 → 예매하기 → "예매 확정하기".
Expected: 좌석이 즉시 예매 완료 상태로 바뀌고, 로그인한 구글 계정 메일함에 티켓 메일이 도착함.

- [ ] **Step 5: 취소 흐름**

방금 예매한 좌석 클릭 → "예매 취소하기" → `/cancel?ticketId=...`로 이동 → 취소 버튼 클릭.
Expected: 비밀번호 입력 없이 바로 취소되고, 취소 안내 메일이 도착함. 다른 구글 계정으로 같은 취소 링크에 접속하면 "🚫 본인 예약이 아닙니다" 화면이 뜨는지도 확인.

- [ ] **Step 6: 단체예매 흐름 (계정 2개 필요)**

계정 A로 좌석 선택 → 단체 예매하기 → 멤버 검색창에 **한 번도 로그인한 적 없는 학번**을 입력해 검색 결과가 비어있는지 확인 → 이미 로그인한 적 있는 계정 B를 검색해 선택 → 완료하기 → 확정 및 이메일 발송.
Expected: 계정 B의 메일함에 초대 메일 도착. 링크 클릭 → 계정 B로 로그인 상태면 바로 확정 화면, 계정 A로 로그인된 상태면 "🚫 본인 초대가 아닙니다" 뜸.

- [ ] **Step 7: 관리자 페이지**

`/admin`에 부트스트랩 계정(`ts250024@ts.hs.kr`)으로 로그인.
Expected: 대시보드 정상 로드, 관리자/동아리원 추가·삭제, 키오스크 비밀번호 변경, 블랙리스트 추가(학번+이름 자유 입력), 프로필 검색 후 학번/이름/역할 수정이 모두 동작. 관리자로 등록되지 않은 다른 `@ts.hs.kr` 계정으로 로그인하면 "🚫 권한 없음" 화면이 뜨는지 확인.

- [ ] **Step 8: 키오스크 발권**

`/print`에서 방금 관리자 페이지에서 바꾼 키오스크 비밀번호로 진입 → 예매된 학번+이름 입력 → 발권.
Expected: 영수증이 정상 출력(브라우저 인쇄 미리보기)되고 `is_printed`가 `true`로 바뀜(관리자 대시보드에서 확인).

- [ ] **Step 9: 결과 보고**

8단계 중 하나라도 실패하면 그 항목을 정확히 기록해 사용자에게 보고하고, 원인을 systematic-debugging 스킬로 조사한 뒤 고친다. 전부 통과하면 사용자에게 "전환 완료, 하드 컷오버 준비됨"이라고 보고한다.
