-- 구글 인증 전환(0001_google_auth.sql) 이전의 옛날 비밀번호 재설정 RPC.
-- 코드베이스 어디에서도 더 이상 호출하지 않는데, anon/authenticated 롤이
-- SECURITY DEFINER 함수를 /rest/v1/rpc/update_password_secure 로 직접 호출 가능한
-- 상태로 남아 있었음(불필요한 공격 표면). student_auth 테이블 데이터는 보존하고
-- 함수만 제거한다.

revoke execute on function public.update_password_secure(text, text, text) from anon;
revoke execute on function public.update_password_secure(text, text, text) from authenticated;

drop function if exists public.update_password_secure(text, text, text);
