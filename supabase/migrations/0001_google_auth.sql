-- supabase/migrations/0001_google_auth.sql

-- =========================================================
-- 1. reservations 하드 컷오버: 기존 데이터 전부 삭제 후 스키마 변경
-- =========================================================
truncate table public.reservations;

alter table public.reservations
  add column if not exists user_id uuid,
  add column if not exists email text;

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

do $$
begin
  alter table public.reservations
    add constraint reservations_user_id_fkey foreign key (user_id) references public.profiles(id);
exception when duplicate_object then null;
end $$;

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
