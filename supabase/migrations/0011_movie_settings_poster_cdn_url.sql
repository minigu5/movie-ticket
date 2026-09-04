-- supabase/migrations/0011_movie_settings_poster_cdn_url.sql
-- 원본 포스터 호스트(img.movist.com 등)가 datacenter IP / 비브라우저 클라이언트를
-- 스로틀해 Cloudflare Workers에서 fetch가 간헐적으로 타임아웃한다. 관리자가 티켓
-- 배경을 생성할 때 브라우저가 이미 포스터를 불러오므로, 그 시점에 원본 포스터를
-- Cloudinary에 복사해 두고 그 URL을 저장한다. 홍보/티켓 메일은 이 URL을 우선 사용한다.
alter table public.movie_settings
  add column if not exists poster_cdn_url text;
