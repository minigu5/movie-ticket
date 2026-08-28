# 개인정보처리방침 계정별 동의/철회 설계

## 배경

로그인 사용자가 개인정보처리방침에 동의하지 않아도 예매 등 핵심 기능을 사용할 수 있는 상태다. 계정별로 동의를 받고, 동의 시각을 내부에 기록하며, `/privacy` 페이지에서 철회할 수 있게 한다.

현재 인증 구조: `middleware.ts` 없음, `app/page.tsx`의 `onAuthStateChange` 콜백에서 `ensureProfile()` 호출하는 클라이언트 주도 방식. `profiles` 테이블(`0001_google_auth.sql`)은 `auth.users`를 참조하며 RLS로 보호됨. AuthContext/useUser 같은 전역 훅 없음 — 각 페이지가 `lib/supabase-auth.ts`를 직접 호출.

## 범위

- 차단 대상: 예매 신규/변경(`app/page.tsx` `handleSubmit`)만. 조회는 비로그인도 허용 중이므로 그대로 둔다.
- 관리자 대시보드의 수동 예매 생성(`app/api/reservations/route.ts`, `supabaseAdmin` 서비스키 사용)은 대상 아님 — 관리자가 사용자를 대신 등록하는 경로라 본인 동의 흐름과 무관.
- 기존 로그인 사용자에 대한 소급 처리 없음. 마이그레이션 후 전원 미동의 상태로 시작하고, 다음 예매 시도 시 자연스럽게 동의를 받는다.

## 데이터 모델

`supabase/migrations/0011_privacy_consent.sql`:

```sql
alter table public.profiles
  add column if not exists privacy_consented_at timestamptz,
  add column if not exists privacy_withdrawn_at timestamptz;
```

- `privacy_consented_at`: 마지막으로 동의한 시각. NULL이면 한번도 동의한 적 없음.
- `privacy_withdrawn_at`: 마지막으로 철회한 시각. NULL이면 철회한 적 없거나, 이후 재동의함.
- 현재 동의 상태 판정식: `privacy_consented_at IS NOT NULL AND (privacy_withdrawn_at IS NULL OR privacy_withdrawn_at < privacy_consented_at)`.
- 동의 시: `privacy_consented_at = now()`만 갱신, `privacy_withdrawn_at`은 건드리지 않음 → 과거 철회 이력이 자연 보존됨.
- 철회 시: `privacy_withdrawn_at = now()`만 갱신.

컬럼을 2개로 유지하면서도(사용자 확정 사항) 재동의/재철회를 오가는 이력이 시각 비교로 정확히 재구성된다.

## RLS 강제

`0001_google_auth.sql`의 `reservations_insert_authenticated` 정책(현재 `with check (true)`)을 교체:

```sql
drop policy if exists reservations_insert_authenticated on public.reservations;

create policy reservations_insert_authenticated on public.reservations
  for insert to authenticated with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.privacy_consented_at is not null
        and (p.privacy_withdrawn_at is null or p.privacy_withdrawn_at < p.privacy_consented_at)
    )
  );
```

클라이언트 모달을 우회해 API를 직접 호출해도 DB 레벨에서 막힌다. 좌석 변경(UPDATE)은 범위에서 제외 — 최초 INSERT 시점에 이미 동의가 강제되므로 별도 게이트 불필요.

## 클라이언트 흐름

### `lib/supabase-auth.ts`
`AppProfile` 타입에 필드 추가:

```ts
export type AppProfile = {
  id: string;
  email: string;
  student_id: string | null;
  name: string;
  role: 'student' | 'staff';
  privacy_consented_at: string | null;
  privacy_withdrawn_at: string | null;
};
```

`ensureProfile()`은 이미 `select('*')`를 쓰므로 쿼리 변경 불필요.

동의 상태 판정 헬퍼(신규, 같은 파일에 추가):

```ts
export function hasPrivacyConsent(profile: AppProfile | null): boolean {
  if (!profile?.privacy_consented_at) return false;
  if (!profile.privacy_withdrawn_at) return true;
  return profile.privacy_withdrawn_at < profile.privacy_consented_at;
}
```

### `app/page.tsx`
- `handleSubmit` 최상단, 기존 블랙리스트/VIP 체크와 같은 위치에서 `hasPrivacyConsent(profile)` 확인.
- 미동의면 예매 로직 진행 대신 `PrivacyConsentModal`을 오픈(기존 `alertInfo`/`confirmInfo`/`successInfo`와 같은 로컬 state 패턴으로 `consentPromptOpen` state 추가).
- 모달에서 "동의" 클릭 → `supabase.from('profiles').update({ privacy_consented_at: new Date().toISOString() }).eq('id', profile.id)` 실행 → 성공 시 로컬 `profile` state 갱신 후 원래 하려던 예매 처리(`processReservation` 등) 그대로 이어감.
- 모달 문구: 개인정보처리방침 핵심 요약 + `/privacy` 전체 보기 링크(새 탭) + [동의] 버튼. 기존 `confirmInfo` 모달과 동일한 톤/스타일(`text-white text-lg font-bold` 등) 재사용.

### `app/privacy/page.tsx`
현재 서버 컴포넌트. 하단에 클라이언트 서브컴포넌트(`components/PrivacyConsentStatus.tsx`, 신규) 추가:
- 마운트 시 `supabase.auth.getSession()` + `profiles` 조회(비로그인이면 아무것도 렌더 안 함).
- 로그인 + 미동의: "아직 동의하지 않았습니다" 안내.
- 로그인 + 동의함: "YYYY년 MM월 DD일 동의함" 표시 + [동의 철회] 버튼.
- 철회 버튼 클릭 → 확인창(`window.confirm` 또는 기존 확인 모달 패턴) → `privacy_withdrawn_at = now()` 업데이트 → 화면 갱신(미동의 상태로 전환).

## 에러 처리

- 동의/철회 UPDATE 실패 시 기존 `showAlert` 패턴으로 에러 안내, 예매 로직 진행하지 않음(동의 모달의 경우) / 상태 그대로 유지(철회의 경우).
- RLS로 인해 미동의 상태에서 INSERT가 거부되는 경우(클라이언트 체크를 우회한 경쟁 상황 등) 기존 `insertError` 처리 경로("다른 분이 먼저 예매했습니다" 메시지)와 구분되는 별도 에러 메시지는 만들지 않는다 — 정상 흐름에서는 클라이언트가 이미 동의를 확인 후 INSERT를 시도하므로 도달하지 않는 경로이며, RLS는 순수 방어선 역할.

## 테스트 계획

프로젝트에 자동화 테스트 스위트 없음(기존 관례 확인됨) — 수동 테스트:
1. 미동의 신규 유저(또는 마이그레이션 직후 기존 유저) 좌석 선택 후 예매 시도 → 동의 모달 표시 → 동의 → 예매 정상 완료, `profiles.privacy_consented_at` 기록 확인.
2. `/privacy` 페이지에서 동의 일자 표시 확인 → 철회 → `privacy_withdrawn_at` 기록, 상태가 미동의로 전환됨 확인.
3. 철회 후 재예매 시도 → 동의 모달 재등장 확인.
4. 미동의 상태에서 devtools로 `reservations` insert API를 직접 호출(RLS 우회 시도) → 거부되는지 확인.
5. 관리자 대시보드 수동 예매 생성은 동의 여부와 무관하게 그대로 동작하는지 확인.
