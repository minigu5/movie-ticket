-- supabase/migrations/0008_ticket_background_template.sql
-- 관리자가 브라우저에서 미리 합성한 티켓 카드 배경(블러+로고+카드프레임+절취선,
-- 텍스트 없음) PNG의 Cloudinary URL을 저장한다. 이메일 발송 시 이 URL이 있으면
-- satori가 여기 텍스트만 오버레이하고, 없으면 outer 없는 기존 카드로 폴백한다.
alter table public.movie_settings
  add column if not exists background_template_url text;
