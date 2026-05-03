# 🎬 영화대교 예매 시스템 (Movie Bridge Ticketing System) - AI Agent Context

이 문서는 AI 에이전트가 본 프로젝트의 아키텍처, 코드베이스 구조 및 주요 비즈니스 로직을 빠르게 파악할 수 있도록 작성된 가이드라인입니다.

## 1. 시스템 개요 (System Overview)
*   **프로젝트 목적**: 고등학교 동아리 "영화대교"의 정기 상영회 좌석 예매, 단체 관람, 팝콘 주문, 티켓 발권을 관리하는 풀스택 웹 애플리케이션입니다.
*   **기술 스택 (Tech Stack)**:
    *   **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
    *   **Backend**: Next.js API Routes (Serverless/Edge Functions)
    *   **Database**: Supabase (PostgreSQL) - Row Level Security(RLS) 및 RPC 기능 적극 활용
    *   **Emailing**: Nodemailer (제로 코스트 로드 밸런싱 적용)

## 2. 주요 기능 및 비즈니스 로직 (Core Workflows)

### A. 좌석 예매 (Seat Reservation)
*   사용자(`app/page.tsx`)는 배치도에서 빈 좌석을 선택하고 학번(4자리), 이름, 영구 비밀번호(PIN)를 입력하여 예매합니다.
*   예매 시 `student_auth` 테이블에 저장된 PIN 번호와 대조하며, 최초 예매 시 PIN이 등록됩니다. 검증 로직은 Supabase RPC(`verify_student_password`)를 통해 처리됩니다.

### B. 단체 관람 (Group Booking)
*   리더가 최대 10명(본인 포함)의 좌석을 지정하여 단체 예매를 시작합니다.
*   리더의 예매는 즉시 `confirmed` 처리되며, 멤버들의 좌석은 `group_pending` 상태로 선점됩니다.
*   멤버들에게 초대 이메일이 발송되며, 멤버는 1시간 내에 `app/group-confirm/page.tsx`에 접속해 수락해야 합니다.
*   시간 초과 시 크론(Cron) 작업(`app/api/cron/group-check/route.ts`)이 미수락 좌석을 삭제하고 결과를 리포트합니다.

### C. 팝콘 주문 시스템 (Popcorn Ordering)
*   단일 예매 또는 단체 확정 시 팝콘(오리지널, 콘소메, 카라멜 등)을 선택할 수 있습니다.
*   팝콘을 선택하면 예매 상태(`payment_status`)가 `pending`(결제 대기)으로 설정되며, 화면에 계좌번호 및 송금용 QR 코드가 표시됩니다.
*   관리자가 현장 또는 백오피스에서 입금을 확인한 후 `confirmed`로 상태를 업데이트해야 최종 확정됩니다.

### D. 관리자 대시보드 (Admin Dashboard)
*   경로: `app/admin/page.tsx`
*   환경 변수(`ADMIN_PASSWORD`)를 사용해 인증합니다.
*   기능: 전체 예매 현황 모니터링 및 상태 변경, 영화 설정(제목, 날짜, 포스터, 등급 등) 수정, 팝콘 주문 통계, 활동 로그 열람, 블랙리스트 관리, 전체 대상 홍보 메일 발송(포스터 첨부 지원).

### E. 이메일 로드 밸런싱 (Email Load Balancing)
*   Gmail의 일일 발송 한도(500건)를 우회하기 위해 다중 계정 로드 밸런싱 로직이 구현되어 있습니다. (`lib/mailer.ts`)
*   `GMAIL_USER_1`, `GMAIL_APP_PASSWORD_1`, `GMAIL_USER_2` 등의 환경 변수를 순회하며 랜덤한 발신 계정을 선택하여 메일을 전송합니다.

## 3. 데이터베이스 스키마 구조 (Database Schema)

*   `reservations`: 모든 예매 정보 관리. (주요 필드: `id`, `movie_date`, `seat_number`, `student_id`, `student_name`, `payment_status`, `popcorn_order`, `group_id`, `is_group_leader`, `group_expires_at`)
*   `student_auth`: 학생들의 고유 4자리 PIN 번호 저장 테이블. (단방향 해시 또는 평문 관리 여부는 RPC 로직에 의존)
*   `movie_settings`: 상영회 정보(영화 제목, 일시, 포스터 URL 등) 저장. (단일 Row만 존재, `id=1`)
*   `blacklist`: 블랙리스트 처리된 학생 명단 저장. 추가 즉시 예약이 차단되며 기존 예매도 삭제 처리됨.
*   `activity_logs`: 시스템 내 주요 활동 이력(로그) 보관.

## 4. 디렉토리 및 주요 파일 구조 (Directory Structure)

*   `app/page.tsx`: 사용자 메인 예매 화면 (좌석 렌더링, 예약 폼, 가이드 모달 등)
*   `app/admin/page.tsx`: 관리자 전용 대시보드
*   `app/group-confirm/page.tsx`: 단체 예매 멤버가 초대 수락, 본인 인증, 팝콘 선택을 수행하는 페이지
*   `app/api/admin/action/route.ts`: 관리자 권한(Supabase Service Role)을 사용하는 백엔드 API
*   `app/api/ticket/route.ts`: 예매 완료 및 발권 메일 발송 API
*   `app/api/kiosk/route.ts`: 키오스크 앱에서 호출하는 현장 발권(QR 대조) 및 RLS 우회 상태 업데이트용 API
*   `app/api/cron/group-check/route.ts`: 단체 예매 제한시간 만료 확인 및 정리용 주기적 실행 API
*   `lib/constants.ts`: 정적 학생 데이터(`STUDENT_LIST`), 교직원 명단, 동아리 부원 명단 등 관리
*   `lib/emails.ts`: 학번-이메일 주소 매핑 데이터
*   `lib/supabase.ts`: 클라이언트 권한용 Supabase Client
*   `lib/supabase-admin.ts`: 서버/API 권한용 (RLS 우회) Supabase Client

## 5. 유지보수 시 주의사항 (Important Considerations)

1.  **동시성 제어 및 RLS**: 사용자 측(`app/page.tsx`)에서 DB를 수정할 때 Row Level Security에 의해 제한될 수 있습니다. 복잡한 업데이트(단체 확정, 팝콘 주문 추가 등)는 안전성을 위해 Supabase RPC(`confirm_group_reservation`, `update_popcorn_order` 등) 또는 서버 API(`/api/kiosk`)를 통해 Service Role로 권한을 상승시켜 처리합니다.
2.  **타입 불일치 주의**: DB 스키마에 컬럼이 추가된 경우, 프론트엔드의 `select` 쿼리에 반드시 추가해야 TypeScript 타입 불일치 에러(`Cannot find name`)가 발생하지 않습니다. (예: `popcorn_order` 필드)
3.  **UI/UX 디자인 기조**: Tailwind CSS 4 기반의 세련된 다크/글래스모피즘(Glassmorphism) 테마를 따릅니다. 경고창 대신 인라인 UI나 모달, 애니메이션(Pulse 등)을 활용해 높은 수준의 사용자 경험을 유지해야 합니다.
