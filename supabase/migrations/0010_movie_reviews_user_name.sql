-- supabase/migrations/0010_movie_reviews_user_name.sql
-- movie_reviews가 작성자 이름을 profiles(name) join으로 표시했는데, profiles RLS가
-- 본인 행만 select 허용(profiles_select_own)이라 남의 이름은 항상 null로 와서
-- 목록에서 다른 사람 후기가 사실상 익명(동아리원)으로 보이던 문제 수정.
-- reservations.student_name과 동일하게 작성 시점 이름을 스냅샷으로 저장한다.

alter table public.movie_reviews add column if not exists user_name text;

update public.movie_reviews mr
set user_name = p.name
from public.profiles p
where p.id = mr.user_id and mr.user_name is null;

update public.movie_reviews set user_name = '동아리원' where user_name is null;

alter table public.movie_reviews alter column user_name set not null;
