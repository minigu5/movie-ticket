# 영화대교 🎬

대구과학고등학교 영화 동아리 **영화대교**의 온라인 영화 예매 시스템입니다.

## 주요 기능

- **좌석 선택 및 예매** — 중강당/대강당 배치도를 실시간으로 표시하고 좌석을 선택해 예매
- **단체 예매** — 리더가 최대 10명의 좌석을 한 번에 예약, 멤버에게 초대 이메일 발송 (1시간 내 수락)
- **팝콘 주문** — 예매 시 팝콘 종류·수량 선택 (개당 2,500원, 현장 결제)
- **이메일 티켓** — 예매 확정 시 학교 이메일로 모바일 티켓 자동 발송
- **관리자 대시보드** (`/admin`) — 예매 승인/취소, 블랙리스트 관리, 홍보 메일 발송, 활동 로그 조회
- **현장 발권기** (`/print`) — 영화 당일 현장에서 티켓 출력
- **비밀번호 재설정** — 이메일 링크를 통한 예매 비밀번호 재설정
- **동아리 전용석 (VIP)** — 관리자가 설정한 좌석 범위는 동아리 부원만 예매 가능

## 기술 스택

| 분야 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| 데이터베이스 | Supabase (PostgreSQL) |
| 이메일 | Nodemailer |
| 배포 | Vercel |
| 분석 | Vercel Analytics |

## 프로젝트 구조

```
app/
  page.tsx              # 메인 예매 페이지
  admin/page.tsx        # 관리자 대시보드
  print/page.tsx        # 현장 발권기
  cancel/page.tsx       # 예매 취소 페이지
  group-confirm/page.tsx # 단체 예매 수락 페이지
  reset-password/page.tsx
  api/
    admin/action/       # 관리자 전용 API (인증 필요)
    ticket/             # 티켓 이메일 발송
    promo/              # 홍보 메일 발송
    blacklist/          # 블랙리스트 알림 메일
    group-invite/       # 단체 예매 초대 메일
    cron/group-check/   # 만료된 단체 예매 자동 정리
    auth/request-reset/ # 비밀번호 재설정 요청
lib/
  supabase.ts           # 공개 Supabase 클라이언트
  supabase-admin.ts     # 서버 전용 Supabase 관리자 클라이언트
  constants.ts          # 학생 명단, 동아리 부원 목록
  emails.ts             # 학생/교직원 이메일 맵
  mailer.ts             # Nodemailer 설정
components/
  AccountInfo.tsx       # 계좌 정보 표시 컴포넌트
```

## 로컬 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 값을 채웁니다.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ADMIN_PASSWORD=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### 3. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인하세요.

## 배포

Vercel에 연결된 GitHub 저장소에 `main` 브랜치를 푸시하면 자동으로 배포됩니다.
