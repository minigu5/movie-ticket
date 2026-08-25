-- supabase/migrations/0009_movie_reviews.sql
-- 보관 중인(is_active=false) 영화 회차에 한해 동아리원(club_members)이 남기는 평점+후기.
-- 별점은 0.5~5.0, 0.5 단위. 열람은 비회원 포함 전체 공개, 작성/수정/삭제는 본인만(관리자는 service-role로 우회 삭제).

create table if not exists public.movie_reviews (
  id bigint generated always as identity primary key,
  movie_settings_id bigint not null references public.movie_settings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating numeric(2,1) not null check (rating >= 0.5 and rating <= 5 and rating * 2 = floor(rating * 2)),
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (movie_settings_id, user_id)
);

create index if not exists movie_reviews_movie_settings_id_idx on public.movie_reviews(movie_settings_id);

alter table public.movie_reviews enable row level security;

do $$ begin
  create policy movie_reviews_select_all on public.movie_reviews
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy movie_reviews_insert_club_member on public.movie_reviews
    for insert to authenticated with check (
      auth.uid() = user_id
      and exists (select 1 from public.club_members cm where cm.email = auth.jwt()->>'email')
      and exists (select 1 from public.movie_settings ms where ms.id = movie_settings_id and ms.is_active = false)
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy movie_reviews_update_own on public.movie_reviews
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy movie_reviews_delete_own on public.movie_reviews
    for delete to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
