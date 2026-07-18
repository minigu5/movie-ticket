# Google OAuth 설정 가이드 (사용자 직접 수행)

Claude는 Google Cloud Console과 Supabase 대시보드에 접근할 수 없어서
아래 작업은 신민규 님이 직접 해야 합니다. 순서대로 따라 하면 됩니다.

## 1. Google Cloud Console — OAuth 동의 화면

1. https://console.cloud.google.com 접속, 새 프로젝트 생성(또는 기존 프로젝트 선택).
2. 왼쪽 메뉴 "API 및 서비스" → "OAuth 동의 화면" 이동.
3. User Type: "내부"(학교 Workspace 조직 내부용) 선택 가능하면 선택, 안 되면 "외부" + 게시 상태 "프로덕션".
4. 앱 이름: "영화대교 예매 시스템", 사용자 지원 이메일: 본인 학교 이메일 입력.
5. 승인된 도메인에 `ts.hs.kr`과 Vercel 배포 도메인(예: `hwip.vercel.app`처럼 실제 서비스 도메인)을 추가.

## 2. Google Cloud Console — OAuth 클라이언트 ID 생성

1. "API 및 서비스" → "사용자 인증 정보" → "+ 사용자 인증 정보 만들기" → "OAuth 클라이언트 ID".
2. 애플리케이션 유형: "웹 애플리케이션".
3. "승인된 리디렉션 URI"에 Supabase 콜백 URL 추가: `https://<Supabase 프로젝트 ref>.supabase.co/auth/v1/callback`
   (Supabase 프로젝트 ref는 대시보드 URL이나 Project Settings에서 확인 가능)
4. 생성 후 나오는 "클라이언트 ID"와 "클라이언트 보안 비밀번호(secret)"를 복사해둔다.

## 3. Supabase 대시보드 — Google Provider 활성화

1. https://supabase.com/dashboard → 해당 프로젝트 → Authentication → Providers.
2. "Google" 항목을 찾아 활성화(Enable).
3. 2단계에서 복사한 Client ID / Client Secret을 붙여넣고 저장.
4. Authentication → URL Configuration에서 "Site URL"과 "Redirect URLs"에 실제 서비스 도메인(예: `https://<서비스 도메인>/**`)이 등록되어 있는지 확인. 없으면 추가.

## 4. 최종 확인

- 배포된 사이트에서 구글 로그인 버튼을 눌러 실제 `@ts.hs.kr` 계정으로 로그인이 되는지 확인한다.
- 개인 Gmail 계정으로 시도했을 때 로그인 자체는 되더라도, 이후 화면에서 "🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다" 경고와 함께 자동 로그아웃되는지 확인한다(코드가 처리하는 부분, `lib/supabase-auth.ts`의 `ensureProfile`).
