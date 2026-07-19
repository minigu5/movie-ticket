-- supabase/migrations/0006_movie_settings_real_id_sequence.sql
-- 0005에서 setval로 시퀀스를 맞추려 했으나 실패: movie_settings.id는
-- kiosk_settings처럼 애초에 시퀀스가 아니라 고정 리터럴(default 1)로 생성된 컬럼이었음
-- (pg_get_serial_sequence가 NULL을 반환해 0005의 setval이 조용히 아무 일도 안 함).
-- 실제 auto-increment 시퀀스를 새로 만들어 붙인다.

create sequence if not exists public.movie_settings_id_seq;
alter sequence public.movie_settings_id_seq owned by public.movie_settings.id;
select setval('public.movie_settings_id_seq', (select coalesce(max(id), 0) from public.movie_settings) + 1, false);
alter table public.movie_settings alter column id set default nextval('public.movie_settings_id_seq');
