-- supabase/migrations/0004_movie_history.sql
-- movie_settings를 싱글턴(id=1)에서 여러 회차를 보관하는 이력 테이블로 확장.
-- is_active=true인 행이 "현재 상영중인 영화" 단 하나임을 부분 유니크 인덱스로 보장.

alter table public.movie_settings
  add column if not exists is_active boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

update public.movie_settings set is_active = true where id = 1;

do $$
begin
  create unique index movie_settings_only_one_active on public.movie_settings (is_active) where is_active;
exception when duplicate_table then null;
end $$;

-- reservations를 movie_date(text 스냅샷) 대신 movie_settings 행에 정확히 연결.
-- movie_date 컬럼은 기존 조회 코드 호환을 위해 그대로 둔다.
alter table public.reservations
  add column if not exists movie_settings_id bigint references public.movie_settings(id);

update public.reservations set movie_settings_id = 1 where movie_settings_id is null;

create index if not exists reservations_movie_settings_id_idx on public.reservations(movie_settings_id);
