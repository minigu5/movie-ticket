-- supabase/migrations/0002_email_membership.sql

-- =========================================================
-- club_members: 학번(student_id) 기반 -> 이메일(email) 기반 하드 컷오버
-- =========================================================
truncate table public.club_members;

alter table public.club_members drop constraint if exists club_members_pkey;
alter table public.club_members drop column if exists student_id;
alter table public.club_members add column if not exists email text;
alter table public.club_members add constraint club_members_pkey primary key (email);

insert into public.club_members (email, added_by) values
  ('ts250024@ts.hs.kr', 'migration'),
  ('ts250079@ts.hs.kr', 'migration'),
  ('ts250025@ts.hs.kr', 'migration'),
  ('ts250091@ts.hs.kr', 'migration'),
  ('ts250083@ts.hs.kr', 'migration'),
  ('ts250089@ts.hs.kr', 'migration'),
  ('ts250038@ts.hs.kr', 'migration'),
  ('ts250027@ts.hs.kr', 'migration'),
  ('ts250035@ts.hs.kr', 'migration'),
  ('ts250007@ts.hs.kr', 'migration')
on conflict (email) do nothing;

-- =========================================================
-- blacklist: 학번(student_id)+이름 기반 -> 이메일(email) 기반 하드 컷오버
-- =========================================================
truncate table public.blacklist;

alter table public.blacklist drop constraint if exists blacklist_pkey;
alter table public.blacklist drop column if exists student_id;
alter table public.blacklist drop column if exists student_name;
alter table public.blacklist add column if not exists email text;
alter table public.blacklist add column if not exists created_at timestamptz not null default now();
alter table public.blacklist add constraint blacklist_pkey primary key (email);
