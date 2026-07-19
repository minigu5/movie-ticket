-- supabase/migrations/0005_fix_movie_settings_seq.sql
-- movie_settings는 원래 대시보드에서 수동 생성된 싱글턴 테이블이라
-- id 시퀀스가 한 번도 전진하지 않아(첫 행 이후 INSERT가 없었음) 기본값이 계속 1을 반환,
-- START_NEW_MOVIE의 INSERT가 기존 id=1 행과 충돌(duplicate key)하던 문제 수정.
select setval(pg_get_serial_sequence('public.movie_settings', 'id'), (select coalesce(max(id), 1) from public.movie_settings));
