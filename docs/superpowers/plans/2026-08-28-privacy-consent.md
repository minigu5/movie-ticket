# 개인정보처리방침 계정별 동의/철회 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 계정별로 개인정보처리방침에 동의해야 예매를 진행할 수 있게 하고, 동의 시각을 내부에 기록하며, `/privacy` 페이지에서 동의를 철회할 수 있게 한다.

**Architecture:** `profiles` 테이블에 `privacy_consented_at`/`privacy_withdrawn_at` 컬럼 2개를 추가하고, `reservations` INSERT RLS 정책을 이 값 검증하도록 교체해 서버측으로 강제한다. 클라이언트에서는 예매 시도 시(`app/page.tsx`) 미동의면 모달을 띄워 동의를 받고, `/privacy` 페이지에는 신규 클라이언트 컴포넌트를 추가해 동의 일자 표시와 철회 버튼을 제공한다.

**Tech Stack:** Next.js App Router(클라이언트 컴포넌트), Supabase(Postgres + RLS + supabase-js). 프로젝트에 자동화 테스트 스위트 없음 — `npx tsc --noEmit`으로 타입 체크, `npm run build`로 빌드 검증, 나머지는 수동 브라우저/SQL 검증.

**Spec:** `docs/superpowers/specs/2026-08-28-privacy-consent-design.md`

## Global Constraints

- 차단 대상은 예매 신규/변경(`app/page.tsx`의 `handleSubmit` 진입점)뿐이다. 조회, 관리자 대시보드 수동 예매 생성(`app/api/reservations/route.ts`)은 대상 아님.
- DB 컬럼은 `privacy_consented_at`, `privacy_withdrawn_at` 2개만 쓴다. 별도 이력 테이블 만들지 않는다.
- 동의 상태 판정식은 항상 `privacy_consented_at IS NOT NULL AND (privacy_withdrawn_at IS NULL OR privacy_withdrawn_at < privacy_consented_at)`로 통일한다(SQL과 TS 양쪽).
- 기존 로그인 사용자에 대한 소급 처리 없음 — 마이그레이션 직후 전원 미동의 상태로 시작.
- 기존 모달 스타일(`app/page.tsx`의 `alertInfo`/`confirmInfo`/`successInfo` 패턴: `bg-slate-900 border ... rounded-2xl`, 버튼 색상 톤)을 그대로 따른다.

---

## Task 1: DB 마이그레이션 — 동의 컬럼 + RLS 강제

**Files:**
- Create: `supabase/migrations/0011_privacy_consent.sql`

**Interfaces:**
- Produces: `public.profiles.privacy_consented_at timestamptz`, `public.profiles.privacy_withdrawn_at timestamptz` — Task 2 이후 모든 태스크가 이 컬럼명을 그대로 참조한다.

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/0011_privacy_consent.sql`:

```sql
-- 계정별 개인정보처리방침 동의/철회 기록
-- 판정식: privacy_consented_at is not null and (privacy_withdrawn_at is null or privacy_withdrawn_at < privacy_consented_at)

alter table public.profiles
  add column if not exists privacy_consented_at timestamptz,
  add column if not exists privacy_withdrawn_at timestamptz;

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

- [ ] **Step 2: 사용자에게 실행 요청**

이 프로젝트는 Supabase CLI/DB 직접 연결이 연결돼 있지 않다(`.env.local`에 `DATABASE_URL` 없음, `supabase/config.toml` 없음) — 기존 마이그레이션들(`docs/superpowers/remaining-manual-steps.md` 참고)도 전부 사용자가 Supabase 대시보드 SQL Editor에서 수동 실행해왔다. 이 파일도 동일하게, 작성 완료 후 사용자에게 아래처럼 요청한다:

> "Supabase 대시보드 → SQL Editor에서 `supabase/migrations/0011_privacy_consent.sql` 내용을 실행해주세요."

- [ ] **Step 3: 적용 확인 쿼리 안내**

사용자가 Step 2 실행 후, 아래 쿼리로 확인하도록 안내한다:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('privacy_consented_at', 'privacy_withdrawn_at');
-- 2행 나와야 함

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'reservations' and policyname = 'reservations_insert_authenticated';
-- 1행, cmd = 'INSERT' 나와야 함
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0011_privacy_consent.sql
git commit -m "feat(privacy): add consent columns and enforce via reservations insert RLS"
```

---

## Task 2: `AppProfile` 타입 + 동의 판정 헬퍼

**Files:**
- Modify: `lib/supabase-auth.ts`

**Interfaces:**
- Consumes: 없음(독립).
- Produces: `AppProfile` 타입에 `privacy_consented_at: string | null`, `privacy_withdrawn_at: string | null` 필드 추가. `hasPrivacyConsent(profile: AppProfile | null): boolean` 함수 — Task 3, Task 4가 그대로 import해서 쓴다.

- [ ] **Step 1: `AppProfile` 타입에 필드 추가**

`lib/supabase-auth.ts`의 기존 타입:

```ts
export type AppProfile = {
  id: string;
  email: string;
  student_id: string | null;
  name: string;
  role: 'student' | 'staff';
};
```

를 아래로 교체:

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

(`ensureProfile()`은 이미 `.select('*')`를 쓰므로 쿼리 코드는 변경할 필요 없음.)

- [ ] **Step 2: 동의 판정 헬퍼 추가**

같은 파일 끝에 추가:

```ts
// 개인정보처리방침 동의 상태 판정: 동의 이력이 있고, 그 이후 철회한 적이 없어야 한다.
export function hasPrivacyConsent(profile: AppProfile | null): boolean {
  if (!profile?.privacy_consented_at) return false;
  if (!profile.privacy_withdrawn_at) return true;
  return profile.privacy_withdrawn_at < profile.privacy_consented_at;
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 기존에 있던 에러 외 새 에러 없음 (이 시점엔 `hasPrivacyConsent`를 아무도 안 쓰므로 "unused" 경고는 나지 않음 — export된 함수라 무관).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase-auth.ts
git commit -m "feat(privacy): add consent fields to AppProfile and hasPrivacyConsent helper"
```

---

## Task 3: 예매 시도 시 동의 게이트 (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx:5` (import), `app/page.tsx:441-533` (`handleSubmit`), 모달 렌더 블록(`confirmInfo` 근처, 현재 파일 기준 1474행 부근)

**Interfaces:**
- Consumes: `hasPrivacyConsent(profile)` (Task 2, `lib/supabase-auth.ts`), `AppProfile` 타입.
- Produces: `runReservationFlow(currentProfile: AppProfile)` — 이 태스크 내부에서만 쓰이는 헬퍼라 다른 태스크가 참조하지 않음.

- [ ] **Step 1: import에 `hasPrivacyConsent` 추가**

`app/page.tsx:5`:

```ts
import { ensureProfile, signInWithGoogle, signOutAndClear, authFetch, authFetchGet, DomainNotAllowedError, hasPrivacyConsent, type AppProfile } from '../lib/supabase-auth';
```

- [ ] **Step 2: 동의 모달 state 추가**

`app/page.tsx:132` (`successInfo` state 선언) 바로 아래에 추가:

```ts
  const [consentPromptOpen, setConsentPromptOpen] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
```

- [ ] **Step 3: `handleSubmit`을 동의 게이트 + `runReservationFlow`로 재구성**

현재 `app/page.tsx:441-533`의 아래 블록 전체를:

```ts
  const handleSubmit = async () => {
    if (!profile) return showAlert("로그인이 필요합니다.");

    if (blacklistedUsers.includes(profile.email)) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");

    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!clubMemberIds.includes(profile.email)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
      }
    }

    const processReservation = async () => {
      try {
        const { data: existingTickets } = await supabase.from('reservations')
          .select('*')
          .eq('movie_date', movieInfo.db_date)
          .eq('user_id', profile.id);

        const baseUrl = window.location.origin;
        const userEmail = profile.email;
        const finalPopcornString = popcornList.filter(p => p !== 'none').join(',') || 'none';

        if (existingTickets && existingTickets.length > 0) {
          const myOldTicket = existingTickets[0];
          
          // 기존 팝콘 삭제 불가 로직
          const oldPopcorns = myOldTicket.popcorn_order && myOldTicket.popcorn_order !== 'none' ? myOldTicket.popcorn_order.split(',') : [];
          const newPopcorns = finalPopcornString !== 'none' ? finalPopcornString.split(',') : [];
          
          if (newPopcorns.length < oldPopcorns.length) {
            return showAlert("🚫 결제 혼선 방지를 위해 기존에 주문한 팝콘 수량을 취소/삭제할 수 없습니다. (맛 변경 및 추가만 가능)");
          }

          let confirmMsg = `이미 예약된 좌석(${myOldTicket.seat_number})을 새로운 좌석(${selectedSeat})으로 변경하시겠습니까?`;
          if (myOldTicket.popcorn_order !== finalPopcornString) {
            confirmMsg = `팝콘 주문 내역이 변경되었습니다.\n(추가 결제/수령 시 현장에서 문의해주세요.)\n\n` + confirmMsg;
          }
          
          showConfirm(confirmMsg, async () => {
            const { data: updatedTicket, error: updateError } = await supabase.from('reservations')
              .update({ seat_number: selectedSeat, popcorn_order: finalPopcornString })
              .eq('id', myOldTicket.id)
              .select('id')
              .single();

            if (updateError) return showAlert("변경 중 오류 발생 (이미 선점된 좌석일 수 있습니다).");

            await supabase.from('activity_logs').insert([{ student_id: profile.student_id, student_name: profile.name, description: `좌석 변경 (${myOldTicket.seat_number} ➡️ ${selectedSeat}) 및 팝콘 갱신` }]);

            if (userEmail && updatedTicket) {
              fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: profile.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, venue: movieInfo.venue, ageRating: movieInfo.age_rating, posterUrl: movieInfo.poster_url, backgroundTemplateUrl: (movieInfo as any).background_template_url, statusType: 'changed', popcorn: finalPopcornString, ticketId: updatedTicket.id, baseUrl }) });
            }
            showSuccess("예매 변경 완료!", "✨ 좌석이 성공적으로 변경되었습니다.\n새로운 티켓이 학교 메일로 발송되었습니다.");
            fetchInitialData(); setIsModalOpen(false); setSelectedSeat(null); setIsMovingSeat(false);
          });
          return;
        }

        const finalStatus = finalPopcornString === 'none' ? 'confirmed' : 'pending';
        const { data: newTicket, error: insertError } = await supabase.from('reservations')
          .insert([{ movie_date: movieInfo.db_date, movie_settings_id: (movieInfo as any).id, user_id: profile.id, student_id: profile.student_id, student_name: profile.name, email: profile.email, seat_number: selectedSeat, popcorn_order: finalPopcornString, payment_status: finalStatus }])
          .select('id').single();

        if (insertError) {
          showAlert("앗! 다른 분이 먼저 예매했습니다.\n다른 좌석을 선택해주세요.");
          fetchInitialData(); return;
        }

        const logDesc = finalStatus === 'confirmed' ? `무료 예매 (${selectedSeat})` : `팝콘 포함 예매 대기 (${selectedSeat})`;
        await supabase.from('activity_logs').insert([{ student_id: profile.student_id, student_name: profile.name, description: logDesc }]);

        setSeatStatuses((prev) => ({ ...prev,[selectedSeat as string]: { status: finalStatus, name: profile.name, ticketId: newTicket?.id || '' } }));
        setMyReservation({ id: newTicket?.id || '', seat: selectedSeat as string, status: finalStatus, popcorn: finalPopcornString });
        setIsModalOpen(false);

        if (userEmail && newTicket) {
          fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: profile.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, venue: movieInfo.venue, ageRating: movieInfo.age_rating, posterUrl: movieInfo.poster_url, backgroundTemplateUrl: (movieInfo as any).background_template_url, statusType: finalStatus, popcorn: finalPopcornString, ticketId: newTicket.id, baseUrl }) });
        }

        if (finalStatus === 'confirmed') {
          showSuccess("🎉 예매 성공!", `${profile.name}님 귀중한 예매 감사합니다! 📧\n학교 이메일로 VIP 모바일 티켓이 발송되었습니다.`);
          setSelectedSeat(null);
        } else {
          setIsPaymentModalOpen(true);
        }

      } catch (err) {
        showAlert("네트워크 오류가 발생했습니다.");
      }
    };

    showConfirm(`[${selectedSeat}] 좌석 예매를 확정하시겠습니까?`, processReservation);
  };
```

아래로 교체 (기존 로직은 그대로, `profile` → `currentProfile` 파라미터로 바뀌고 `handleSubmit`이 동의 게이트를 먼저 통과시키는 구조로 감싸짐):

```ts
  const runReservationFlow = (currentProfile: AppProfile) => {
    if (blacklistedUsers.includes(currentProfile.email)) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");

    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!clubMemberIds.includes(currentProfile.email)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
      }
    }

    const processReservation = async () => {
      try {
        const { data: existingTickets } = await supabase.from('reservations')
          .select('*')
          .eq('movie_date', movieInfo.db_date)
          .eq('user_id', currentProfile.id);

        const baseUrl = window.location.origin;
        const userEmail = currentProfile.email;
        const finalPopcornString = popcornList.filter(p => p !== 'none').join(',') || 'none';

        if (existingTickets && existingTickets.length > 0) {
          const myOldTicket = existingTickets[0];
          
          // 기존 팝콘 삭제 불가 로직
          const oldPopcorns = myOldTicket.popcorn_order && myOldTicket.popcorn_order !== 'none' ? myOldTicket.popcorn_order.split(',') : [];
          const newPopcorns = finalPopcornString !== 'none' ? finalPopcornString.split(',') : [];
          
          if (newPopcorns.length < oldPopcorns.length) {
            return showAlert("🚫 결제 혼선 방지를 위해 기존에 주문한 팝콘 수량을 취소/삭제할 수 없습니다. (맛 변경 및 추가만 가능)");
          }

          let confirmMsg = `이미 예약된 좌석(${myOldTicket.seat_number})을 새로운 좌석(${selectedSeat})으로 변경하시겠습니까?`;
          if (myOldTicket.popcorn_order !== finalPopcornString) {
            confirmMsg = `팝콘 주문 내역이 변경되었습니다.\n(추가 결제/수령 시 현장에서 문의해주세요.)\n\n` + confirmMsg;
          }
          
          showConfirm(confirmMsg, async () => {
            const { data: updatedTicket, error: updateError } = await supabase.from('reservations')
              .update({ seat_number: selectedSeat, popcorn_order: finalPopcornString })
              .eq('id', myOldTicket.id)
              .select('id')
              .single();

            if (updateError) return showAlert("변경 중 오류 발생 (이미 선점된 좌석일 수 있습니다).");

            await supabase.from('activity_logs').insert([{ student_id: currentProfile.student_id, student_name: currentProfile.name, description: `좌석 변경 (${myOldTicket.seat_number} ➡️ ${selectedSeat}) 및 팝콘 갱신` }]);

            if (userEmail && updatedTicket) {
              fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: currentProfile.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, venue: movieInfo.venue, ageRating: movieInfo.age_rating, posterUrl: movieInfo.poster_url, backgroundTemplateUrl: (movieInfo as any).background_template_url, statusType: 'changed', popcorn: finalPopcornString, ticketId: updatedTicket.id, baseUrl }) });
            }
            showSuccess("예매 변경 완료!", "✨ 좌석이 성공적으로 변경되었습니다.\n새로운 티켓이 학교 메일로 발송되었습니다.");
            fetchInitialData(); setIsModalOpen(false); setSelectedSeat(null); setIsMovingSeat(false);
          });
          return;
        }

        const finalStatus = finalPopcornString === 'none' ? 'confirmed' : 'pending';
        const { data: newTicket, error: insertError } = await supabase.from('reservations')
          .insert([{ movie_date: movieInfo.db_date, movie_settings_id: (movieInfo as any).id, user_id: currentProfile.id, student_id: currentProfile.student_id, student_name: currentProfile.name, email: currentProfile.email, seat_number: selectedSeat, popcorn_order: finalPopcornString, payment_status: finalStatus }])
          .select('id').single();

        if (insertError) {
          showAlert("앗! 다른 분이 먼저 예매했습니다.\n다른 좌석을 선택해주세요.");
          fetchInitialData(); return;
        }

        const logDesc = finalStatus === 'confirmed' ? `무료 예매 (${selectedSeat})` : `팝콘 포함 예매 대기 (${selectedSeat})`;
        await supabase.from('activity_logs').insert([{ student_id: currentProfile.student_id, student_name: currentProfile.name, description: logDesc }]);

        setSeatStatuses((prev) => ({ ...prev,[selectedSeat as string]: { status: finalStatus, name: currentProfile.name, ticketId: newTicket?.id || '' } }));
        setMyReservation({ id: newTicket?.id || '', seat: selectedSeat as string, status: finalStatus, popcorn: finalPopcornString });
        setIsModalOpen(false);

        if (userEmail && newTicket) {
          fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: currentProfile.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, venue: movieInfo.venue, ageRating: movieInfo.age_rating, posterUrl: movieInfo.poster_url, backgroundTemplateUrl: (movieInfo as any).background_template_url, statusType: finalStatus, popcorn: finalPopcornString, ticketId: newTicket.id, baseUrl }) });
        }

        if (finalStatus === 'confirmed') {
          showSuccess("🎉 예매 성공!", `${currentProfile.name}님 귀중한 예매 감사합니다! 📧\n학교 이메일로 VIP 모바일 티켓이 발송되었습니다.`);
          setSelectedSeat(null);
        } else {
          setIsPaymentModalOpen(true);
        }

      } catch (err) {
        showAlert("네트워크 오류가 발생했습니다.");
      }
    };

    showConfirm(`[${selectedSeat}] 좌석 예매를 확정하시겠습니까?`, processReservation);
  };

  const handleAgreeAndContinue = async () => {
    if (!profile) return;
    setConsentBusy(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from('profiles').update({ privacy_consented_at: nowIso }).eq('id', profile.id);
    setConsentBusy(false);
    if (error) {
      setConsentPromptOpen(false);
      return showAlert("동의 처리 중 오류가 발생했습니다.");
    }
    const updatedProfile: AppProfile = { ...profile, privacy_consented_at: nowIso };
    setProfile(updatedProfile);
    setConsentPromptOpen(false);
    runReservationFlow(updatedProfile);
  };

  const handleSubmit = () => {
    if (!profile) return showAlert("로그인이 필요합니다.");

    if (!hasPrivacyConsent(profile)) {
      setConsentPromptOpen(true);
      return;
    }

    runReservationFlow(profile);
  };
```

- [ ] **Step 4: 동의 모달 JSX 추가**

`app/page.tsx`의 `{confirmInfo && (...)}` 블록(현재 1474~1492행 부근) 바로 뒤에 추가:

```tsx
      {consentPromptOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-[90]">
          <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl w-full max-w-sm text-center shadow-[0_0_30px_rgba(79,70,229,0.2)]">
            <div className="text-4xl mb-4 text-center mx-auto flex justify-center">🔒</div>
            <p className="text-white text-lg font-bold mb-3 leading-relaxed">개인정보처리방침 동의가 필요합니다</p>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              예매를 진행하려면 개인정보 수집·이용에 동의해야 합니다.{' '}
              <Link href="/privacy" target="_blank" className="text-indigo-400 hover:text-indigo-300 underline">전체 내용 보기</Link>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConsentPromptOpen(false)}
                disabled={consentBusy}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded-lg text-slate-300 font-bold transition-all border border-white/10">취소</button>
              <button
                onClick={handleAgreeAndContinue}
                disabled={consentBusy}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-white font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-500">
                {consentBusy ? '처리 중...' : '동의'}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 수동 브라우저 테스트**

Run: `npm run dev`, `http://localhost:3000` 접속.
1. Task 1의 마이그레이션이 아직 적용 안 됐다면(사용자가 아직 실행 전이면) 이 단계는 마이그레이션 적용 후 진행.
2. 미동의 계정으로 로그인 → 좌석 선택 → "예매하기" → 동의 모달이 뜨는지 확인(기존 블랙리스트/VIP 체크보다 먼저 떠야 함).
3. "전체 내용 보기" 링크가 새 탭에서 `/privacy`를 여는지 확인.
4. "동의" 클릭 → 모달이 닫히고 곧바로 기존 "좌석 예매를 확정하시겠습니까?" 확인 모달로 이어지는지 확인.
5. 확인 → 예매 정상 완료 확인.
6. Supabase Table Editor에서 해당 계정의 `profiles.privacy_consented_at`이 방금 시각으로 채워졌는지 확인.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat(privacy): gate reservation flow behind consent modal"
```

---

## Task 4: `/privacy` 페이지 — 동의 상태 표시 + 철회

**Files:**
- Create: `components/PrivacyConsentStatus.tsx`
- Modify: `app/privacy/page.tsx`

**Interfaces:**
- Consumes: `hasPrivacyConsent(profile)`, `AppProfile` 타입 (Task 2, `lib/supabase-auth.ts`), `supabase` 클라이언트 (`lib/supabase.ts`).
- Produces: `PrivacyConsentStatus` 컴포넌트(props 없음, 자체적으로 세션 조회) — `app/privacy/page.tsx`에서만 사용.

- [ ] **Step 1: `PrivacyConsentStatus` 컴포넌트 작성**

`components/PrivacyConsentStatus.tsx` (신규):

```tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hasPrivacyConsent, type AppProfile } from '@/lib/supabase-auth';

export default function PrivacyConsentStatus() {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (active) {
        setProfile(data as AppProfile | null);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleWithdraw = async () => {
    if (!profile) return;
    if (!window.confirm('개인정보처리방침 동의를 철회하시겠습니까?\n철회 후에는 예매 등 핵심 기능을 다시 이용하려면 재동의가 필요합니다.')) return;

    setBusy(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from('profiles').update({ privacy_withdrawn_at: nowIso }).eq('id', profile.id);
    setBusy(false);

    if (error) {
      window.alert('철회 처리 중 오류가 발생했습니다.');
      return;
    }
    setProfile({ ...profile, privacy_withdrawn_at: nowIso });
  };

  if (loading || !profile) return null;

  const consented = hasPrivacyConsent(profile);
  const formattedDate = profile.privacy_consented_at
    ? new Date(profile.privacy_consented_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-8">
      <h2 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-2 mb-4">내 동의 상태</h2>
      {consented ? (
        <>
          <p className="text-sm text-slate-300 mb-4">{formattedDate}에 동의했습니다.</p>
          <button
            onClick={handleWithdraw}
            disabled={busy}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-lg text-white text-sm font-bold transition-colors"
          >
            {busy ? '처리 중...' : '동의 철회'}
          </button>
        </>
      ) : (
        <p className="text-sm text-slate-400">아직 동의하지 않았습니다.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `/privacy` 페이지에 렌더**

`app/privacy/page.tsx` 상단에 import 추가:

```tsx
import PrivacyConsentStatus from "@/components/PrivacyConsentStatus";
```

기존 마지막 `</section>` 바로 다음, `</div>`(정책 카드 닫는 태그) 바로 앞에 있는 구조를 아래처럼 바꾼다 — 현재:

```tsx
          </section>
        </div>
      </div>
    </div>
  );
}
```

를:

```tsx
          </section>
        </div>

        <PrivacyConsentStatus />
      </div>
    </div>
  );
}
```

로 교체(정책 카드 `<div className="bg-slate-900 ...">` 밖, `max-w-2xl mx-auto` 안쪽에 위치).

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: 성공 (Server Component인 `app/privacy/page.tsx`가 Client Component `PrivacyConsentStatus`를 문제 없이 렌더).

- [ ] **Step 5: 수동 브라우저 테스트**

`npm run dev` 유지한 채:
1. 비로그인 상태로 `/privacy` 접속 → "내 동의 상태" 섹션 자체가 안 보이는지 확인.
2. Task 3에서 동의한 계정으로 로그인 후 `/privacy` 접속 → "YYYY년 M월 D일에 동의했습니다." + [동의 철회] 버튼 확인.
3. [동의 철회] 클릭 → 확인창 → 확인 → "아직 동의하지 않았습니다."로 바뀌는지 확인. Supabase Table Editor에서 `privacy_withdrawn_at` 기록 확인.
4. 메인 페이지(`/`)로 돌아가 좌석 선택 후 예매 시도 → 동의 모달이 다시 뜨는지 확인(철회 반영 확인).
5. devtools Network 탭에서 미동의 상태로 `reservations` insert를 흉내 낸 직접 요청(또는 콘솔에서 `supabase.from('reservations').insert(...)` 직접 호출)을 시도 → RLS로 거부되는지 확인.
6. `/admin` 대시보드에서 미동의 계정에 대해 수동 예매 생성(`app/api/reservations/route.ts`, `supabaseAdmin` 경유) → 동의 여부와 무관하게 정상 동작하는지 확인(이 경로는 RLS를 서비스 키로 우회하므로 Task 1의 정책 변경 영향을 받지 않아야 함).

- [ ] **Step 6: Commit**

```bash
git add components/PrivacyConsentStatus.tsx app/privacy/page.tsx
git commit -m "feat(privacy): show consent status and withdraw button on /privacy"
```
