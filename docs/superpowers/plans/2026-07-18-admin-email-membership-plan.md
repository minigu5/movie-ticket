# 관리자 레이아웃/이메일 명단 관리/관리자 버튼 노출 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 페이지 4개 박스 레이아웃 안정화, 동아리원(VIP)/블랙리스트를 학번 대신 이메일(붙여넣기 일괄 추가)로 관리하도록 전환, 메인 페이지 관리자/발권기 버튼을 실제 관리자 계정에만 노출.

**Architecture:** DB 스키마(`club_members`, `blacklist`)의 매칭 키를 `student_id`→`email`로 바꾸는 idempotent 마이그레이션을 추가하고, 서버 액션(`/api/admin/action`)의 관련 케이스를 단건→배열(email[]) bulk 처리로 교체한다. 클라이언트(관리자 페이지 textarea, 메인 페이지 예매 흐름)는 새 email 기준 데이터에 맞춰 매칭 로직만 바꾼다. 신규 `/api/admin/check`가 메인 페이지의 관리자 버튼 노출 여부를 결정한다.

**Tech Stack:** Next.js (edge runtime API routes), Supabase (Postgres + supabase-js), React (client components), TailwindCSS.

## Global Constraints

- 이메일 형식/도메인 검증: `@ts.hs.kr`로 끝나는 이메일만 허용 (기존 관리자 추가 로직과 동일 규칙, `app/api/admin/action/route.ts:153`)
- 테스트 프레임워크 없음 (package.json에 `test` 스크립트 없음) — 각 태스크의 검증은 `npm run lint`, `npm run build`, 그리고 가능한 경우 `npm run dev`로 실제 화면 확인으로 대체한다.
- DB 마이그레이션은 이 프로젝트 관례상 Supabase SQL Editor에서 수동 실행한다(자동 실행 러너 없음). idempotent하게 작성해서 재실행해도 안전해야 한다 (`supabase/migrations/0001_google_auth.sql` 패턴 따름).
- 커밋은 태스크 단위로 자주 한다.

---

### Task 1: DB 마이그레이션 — club_members/blacklist를 email 기준으로 전환

**Files:**
- Create: `supabase/migrations/0002_email_membership.sql`

**Interfaces:**
- Produces: `public.club_members(email text primary key, added_by text, created_at timestamptz)`, `public.blacklist(email text primary key, created_at timestamptz)` — 이후 모든 태스크가 이 컬럼명을 사용.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- supabase/migrations/0002_email_membership.sql

-- =========================================================
-- club_members: 학번(student_id) 기반 -> 이메일(email) 기반 하드 컷오버
-- =========================================================
truncate table public.club_members;

alter table public.club_members drop constraint if exists club_members_pkey;
alter table public.club_members drop column if exists student_id;
alter table public.club_members add column if not exists email text;
alter table public.club_members add constraint club_members_pkey primary key (email);

insert into public.club_members (email, added_by) values
  ('ts250024@ts.hs.kr', 'migration'),
  ('ts250079@ts.hs.kr', 'migration'),
  ('ts250025@ts.hs.kr', 'migration'),
  ('ts250091@ts.hs.kr', 'migration'),
  ('ts250083@ts.hs.kr', 'migration'),
  ('ts250089@ts.hs.kr', 'migration'),
  ('ts250038@ts.hs.kr', 'migration'),
  ('ts250027@ts.hs.kr', 'migration'),
  ('ts250035@ts.hs.kr', 'migration'),
  ('ts250007@ts.hs.kr', 'migration')
on conflict (email) do nothing;

-- =========================================================
-- blacklist: 학번(student_id)+이름 기반 -> 이메일(email) 기반 하드 컷오버
-- =========================================================
truncate table public.blacklist;

alter table public.blacklist drop constraint if exists blacklist_pkey;
alter table public.blacklist drop column if exists student_id;
alter table public.blacklist drop column if exists student_name;
alter table public.blacklist add column if not exists email text;
alter table public.blacklist add column if not exists created_at timestamptz not null default now();
alter table public.blacklist add constraint blacklist_pkey primary key (email);
```

- [ ] **Step 2: 재실행 가능성(idempotent) 육안 점검**

파일을 처음부터 다시 읽으며 `drop constraint if exists`, `drop column if exists`, `add column if not exists`, `on conflict do nothing`가 모든 구조 변경/삽입에 적용됐는지 확인한다. 두 번 연속 실행해도 에러 없이 통과해야 한다(실제 DB 접근 권한이 없으면 SQL을 다시 읽고 각 문장이 "이미 적용된 상태에서 재실행"해도 안전한지 논리적으로 확인).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_email_membership.sql
git commit -m "$(cat <<'EOF'
feat(db): club_members/blacklist 학번 기준을 이메일 기준으로 전환

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 이메일 일괄 추출 유틸

**Files:**
- Create: `lib/parseEmails.ts`

**Interfaces:**
- Produces: `extractSchoolEmails(text: string): string[]` — Task 6, 7에서 사용.

- [ ] **Step 1: 유틸 작성**

```ts
// lib/parseEmails.ts
const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.[\w.-]+/g;
const SCHOOL_DOMAIN = '@ts.hs.kr';

export function extractSchoolEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  const unique = Array.from(new Set(matches.map(e => e.toLowerCase())));
  return unique.filter(e => e.endsWith(SCHOOL_DOMAIN));
}
```

- [ ] **Step 2: 동작 확인**

Node REPL로 빠르게 확인:

Run: `node -e "const {extractSchoolEmails}=require('ts-node/register') && 1" 2>/dev/null; npx tsx -e "import {extractSchoolEmails} from './lib/parseEmails'; console.log(extractSchoolEmails('2208 신민규 <ts250024@ts.hs.kr>, 2101고도균 <ts250079@ts.hs.kr>, foo@gmail.com'))"`

Expected: `[ 'ts250024@ts.hs.kr', 'ts250079@ts.hs.kr' ]` (gmail.com은 도메인 필터로 제외됨)

- [ ] **Step 3: Commit**

```bash
git add lib/parseEmails.ts
git commit -m "$(cat <<'EOF'
feat(lib): 텍스트에서 학교 도메인 이메일만 추출하는 유틸 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `/api/admin/action` — club_members/blacklist 액션을 email 기준 bulk로 교체

**Files:**
- Modify: `app/api/admin/action/route.ts`

**Interfaces:**
- Consumes: 없음 (독립 실행 가능, DB 스키마는 Task 1 완료 가정)
- Produces:
  - `ADD_CLUB_MEMBERS` payload `{ emails: string[] }` → `{ success: true, added: number }`
  - `REMOVE_CLUB_MEMBER` payload `{ email: string }` → `{ success: true }`
  - `LIST_CLUB_MEMBERS` → `{ success: true, data: {email, added_by, created_at}[] }`
  - `ADD_BLACKLIST_BULK` payload `{ emails: string[], movieDate: string }` → `{ success: true, results: {email: string, name: string, canceledTicket: any}[] }`
  - `REMOVE_BLACKLIST` payload `{ email: string }` → `{ success: true, name: string }`
  - `FETCH_INITIAL_DATA`의 `blData`/`clubData`가 이제 `email` 컬럼을 포함
  - Task 6(`app/admin/page.tsx`)이 이 액션명/응답 형태를 그대로 소비한다.

- [ ] **Step 1: FETCH_INITIAL_DATA의 select 컬럼 변경**

`app/api/admin/action/route.ts:28`을 다음으로 교체:

```ts
          supabaseAdmin.from('blacklist').select('email, created_at').order('created_at', { ascending: false }),
```

`app/api/admin/action/route.ts:31`을 다음으로 교체:

```ts
          supabaseAdmin.from('club_members').select('email, added_by, created_at').order('created_at', { ascending: false }),
```

- [ ] **Step 2: ADD_BLACKLIST → ADD_BLACKLIST_BULK, REMOVE_BLACKLIST 교체**

`app/api/admin/action/route.ts:103-142`(`case 'ADD_BLACKLIST':` ~ `case 'REMOVE_BLACKLIST':` 블록 전체)를 다음으로 교체:

```ts
      case 'ADD_BLACKLIST_BULK': {
        const { emails, movieDate } = payload;
        const cleanEmails = Array.from(new Set((emails as string[] || [])
          .map(e => String(e).trim().toLowerCase())
          .filter(e => e.endsWith('@ts.hs.kr'))));

        if (cleanEmails.length === 0) {
          return NextResponse.json({ success: false, error: '@ts.hs.kr 이메일이 없습니다.' }, { status: 400 });
        }

        const results: { email: string; name: string; canceledTicket: any }[] = [];

        for (const email of cleanEmails) {
          const { data: existingTickets } = await supabaseAdmin.from('reservations')
            .select('*')
            .eq('email', email)
            .eq('movie_date', movieDate);

          let canceledTicket: any = null;
          let name: string;

          if (existingTickets && existingTickets.length > 0) {
            canceledTicket = existingTickets[0];
            name = canceledTicket.student_name;
            await supabaseAdmin.from('reservations').delete().eq('id', canceledTicket.id);
            await supabaseAdmin.from('activity_logs').insert([{
              student_id: canceledTicket.student_id, student_name: canceledTicket.student_name,
              description: `블랙리스트 등록 및 예매 자동 취소 (${canceledTicket.seat_number})`
            }]);
          } else {
            const { data: prof } = await supabaseAdmin.from('profiles').select('name').eq('email', email).maybeSingle();
            name = prof?.name ?? email;
          }

          results.push({ email, name, canceledTicket });
        }

        const { error: blError } = await supabaseAdmin
          .from('blacklist')
          .upsert(cleanEmails.map(email => ({ email })), { onConflict: 'email', ignoreDuplicates: true });
        if (blError) throw blError;

        return NextResponse.json({ success: true, results });
      }

      case 'REMOVE_BLACKLIST': {
        const { email } = payload;
        const { error } = await supabaseAdmin.from('blacklist').delete().eq('email', email);
        if (error) throw error;

        const { data: prof } = await supabaseAdmin.from('profiles').select('name').eq('email', email).maybeSingle();
        return NextResponse.json({ success: true, name: prof?.name ?? email });
      }
```

- [ ] **Step 3: LIST_CLUB_MEMBERS, ADD_CLUB_MEMBER → ADD_CLUB_MEMBERS, REMOVE_CLUB_MEMBER 교체**

`app/api/admin/action/route.ts:171-193`(`case 'LIST_CLUB_MEMBERS':` ~ `case 'REMOVE_CLUB_MEMBER':` 블록 전체)를 다음으로 교체:

```ts
      case 'LIST_CLUB_MEMBERS': {
        const { data, error } = await supabaseAdmin.from('club_members').select('email, added_by, created_at').order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'ADD_CLUB_MEMBERS': {
        const { emails } = payload;
        const cleanEmails = Array.from(new Set((emails as string[] || [])
          .map(e => String(e).trim().toLowerCase())
          .filter(e => e.endsWith('@ts.hs.kr'))));

        if (cleanEmails.length === 0) {
          return NextResponse.json({ success: false, error: '@ts.hs.kr 이메일이 없습니다.' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
          .from('club_members')
          .upsert(cleanEmails.map(email => ({ email, added_by: adminEmail })), { onConflict: 'email', ignoreDuplicates: true });
        if (error) throw error;
        return NextResponse.json({ success: true, added: cleanEmails.length });
      }

      case 'REMOVE_CLUB_MEMBER': {
        const { email } = payload;
        const { error } = await supabaseAdmin.from('club_members').delete().eq('email', email);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
```

- [ ] **Step 4: 정적 검증**

Run: `npm run lint -- app/api/admin/action/route.ts`
Expected: No errors.

Run: `npx tsc --noEmit`
Expected: No type errors related to this file (기존에 이미 에러가 있었다면 그 목록과 비교해서 새 에러만 없는지 확인).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/action/route.ts
git commit -m "$(cat <<'EOF'
feat(api): 동아리원/블랙리스트 관리 액션을 이메일 기준 일괄 처리로 전환

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `/api/profiles/search` — 응답에 email 포함

**Files:**
- Modify: `app/api/profiles/search/route.ts:18`

**Interfaces:**
- Produces: 응답 `results` 배열의 각 원소가 `{id, student_id, name, email}` 형태(기존 `{id, student_id, name}`에 `email` 추가). Task 7이 이 필드를 소비.

- [ ] **Step 1: select 절 수정**

`app/api/profiles/search/route.ts:18`을 다음으로 교체:

```ts
    .select('id, student_id, name, email')
```

- [ ] **Step 2: 정적 검증**

Run: `npx tsc --noEmit`
Expected: 이 파일 관련 새 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add app/api/profiles/search/route.ts
git commit -m "$(cat <<'EOF'
feat(api): 그룹원 검색 결과에 email 포함

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `/api/admin/check` 신설 — 경량 관리자 여부 확인

**Files:**
- Create: `app/api/admin/check/route.ts`

**Interfaces:**
- Consumes: `requireAdmin(req: Request): Promise<{ok:true,user:User}|{ok:false,status:number,error:string}>` (`lib/api-auth.ts:21`)
- Produces: `GET /api/admin/check` → `{ success: true, isAdmin: boolean }`. Task 7이 이 응답 형태를 소비.

- [ ] **Step 1: 라우트 작성**

```ts
// app/api/admin/check/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export const runtime = 'edge';

export async function GET(req: Request) {
  const result = await requireAdmin(req);
  return NextResponse.json({ success: true, isAdmin: result.ok });
}
```

- [ ] **Step 2: 동작 확인 (dev 서버)**

Run: `npm run dev` (백그라운드) 후 로그인 없이:
`curl -s http://localhost:3000/api/admin/check`
Expected: `{"success":true,"isAdmin":false}` (Authorization 헤더 없으면 `requireAdmin`이 401로 `ok:false` 반환 → `isAdmin:false`)

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/action/route.ts app/api/admin/check/route.ts 2>/dev/null; git add app/api/admin/check/route.ts
git commit -m "$(cat <<'EOF'
feat(api): 메인 페이지용 경량 관리자 여부 확인 엔드포인트 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `app/admin/page.tsx` — 레이아웃 카드화 + 이메일 일괄 추가 UI

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `extractSchoolEmails(text: string): string[]` (Task 2), `ADD_CLUB_MEMBERS`/`REMOVE_CLUB_MEMBER`/`ADD_BLACKLIST_BULK`/`REMOVE_BLACKLIST` 액션 (Task 3)
- Produces: 없음 (leaf UI)

- [ ] **Step 1: import 추가**

`app/admin/page.tsx:6` 다음 줄에 추가:

```tsx
import { extractSchoolEmails } from '../../lib/parseEmails';
```

- [ ] **Step 2: state 교체**

`app/admin/page.tsx:26-33`을 다음으로 교체:

```tsx
  const [blacklist, setBlacklist] = useState<{email: string, created_at: string}[]>([]);
  const [newBlacklistText, setNewBlacklistText] = useState('');

  const [admins, setAdmins] = useState<{email: string, added_by: string | null, created_at: string}[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [clubMembers, setClubMembers] = useState<{email: string, added_by: string | null, created_at: string}[]>([]);
  const [newClubMembersText, setNewClubMembersText] = useState('');
```

- [ ] **Step 3: 미리보기 카운트 useMemo 추가**

`popcornStats` useMemo 블록(`app/admin/page.tsx:43-55`) 바로 다음에 추가:

```tsx
  const clubEmailPreviewCount = useMemo(() => extractSchoolEmails(newClubMembersText).length, [newClubMembersText]);
  const blacklistEmailPreviewCount = useMemo(() => extractSchoolEmails(newBlacklistText).length, [newBlacklistText]);
```

- [ ] **Step 4: handleAddBlacklist/handleRemoveBlacklist 교체**

`app/admin/page.tsx:223-262`(`handleAddBlacklist` ~ `handleRemoveBlacklist` 함수 전체)를 다음으로 교체:

```tsx
  const handleAddBlacklistBulk = async () => {
    const emails = extractSchoolEmails(newBlacklistText);
    if (emails.length === 0) return alert("추가할 @ts.hs.kr 이메일이 없습니다.");
    if (!confirm(`${emails.length}명을 블랙리스트에 추가하시겠습니까?\n(⚠️ 주의: 현재 진행 중이거나 완료된 예매 내역이 있다면 자동으로 취소됩니다.)`)) return;

    const res = await authFetch('/api/admin/action', { action: 'ADD_BLACKLIST_BULK', payload: { emails, movieDate: movieInfo.db_date } });
    const data = await res.json();
    if (!data.success) return alert("추가 실패: " + (data.error || ''));

    data.results.forEach((r: any) => {
      if (r.canceledTicket) {
        const ticket = r.canceledTicket;
        const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
        fetch('/api/ticket', {
          method: 'POST',
          body: JSON.stringify({ email: r.email, name: r.name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
        });
      }
      fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: r.email, name: r.name, action: 'added' }) });
    });

    setNewBlacklistText('');
    fetchAdminData();
    alert(`✅ ${emails.length}명 블랙리스트 추가 및 예매 자동 취소 처리가 완료되었습니다!`);
  };

  const handleRemoveBlacklist = async (email: string) => {
    if (!confirm(`${email} 블랙리스트를 해제하시겠습니까?`)) return;
    const res = await authFetch('/api/admin/action', { action: 'REMOVE_BLACKLIST', payload: { email } });
    const data = await res.json();
    if (!data.success) return alert("해제 실패");
    fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email, name: data.name, action: 'removed' }) });
    fetchAdminData();
    alert("✅ 해제 완료 및 안내 메일 발송!");
  };
```

- [ ] **Step 5: handleAddClubMember/handleRemoveClubMember 교체**

`app/admin/page.tsx:283-299`(`handleAddClubMember` ~ `handleRemoveClubMember` 함수 전체)를 다음으로 교체:

```tsx
  const handleAddClubMembers = async () => {
    const emails = extractSchoolEmails(newClubMembersText);
    if (emails.length === 0) return alert("추가할 @ts.hs.kr 이메일이 없습니다.");
    const res = await authFetch('/api/admin/action', { action: 'ADD_CLUB_MEMBERS', payload: { emails } });
    const data = await res.json();
    if (!data.success) return alert("추가 실패: " + data.error);
    setNewClubMembersText('');
    fetchAdminData();
    alert(`✅ ${emails.length}명 동아리원(VIP)으로 추가되었습니다.`);
  };

  const handleRemoveClubMember = async (email: string) => {
    if (!confirm(`${email} 학생을 동아리원(VIP)에서 제거하시겠습니까?`)) return;
    const res = await authFetch('/api/admin/action', { action: 'REMOVE_CLUB_MEMBER', payload: { email } });
    const data = await res.json();
    if (!data.success) return alert("제거 실패: " + data.error);
    fetchAdminData();
  };
```

- [ ] **Step 6: 4열 그리드 카드화 + 관리자/동아리원 UI를 textarea로 교체**

`app/admin/page.tsx:498-576`(4열 grid 컨테이너 `<div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-emerald-600 mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">`부터 그 닫는 `</div>`까지) 전체를 다음으로 교체:

```tsx
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-emerald-600 mb-8 grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        <div className="bg-gray-900/60 rounded-lg border border-emerald-800/40 p-4 flex flex-col">
          <h2 className="text-lg font-bold text-emerald-400 mb-3">👑 관리자 목록</h2>
          <div className="flex gap-2 mb-3">
            <input type="text" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="xxxx@ts.hs.kr" className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleAddAdmin} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded font-bold text-sm">추가</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {admins.map(a => (
              <div key={a.email} className="flex items-center justify-between bg-gray-700/50 rounded px-2 py-1 text-xs">
                <span className="text-gray-200">{a.email}</span>
                <button onClick={() => handleRemoveAdmin(a.email)} className="text-red-400 hover:text-red-300 font-bold">×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-indigo-800/40 p-4 flex flex-col">
          <h2 className="text-lg font-bold text-indigo-400 mb-3">🎟️ 동아리원(VIP) 목록</h2>
          <textarea
            value={newClubMembersText}
            onChange={e => setNewClubMembersText(e.target.value)}
            placeholder={"이름과 이메일을 붙여넣으면 이메일만 자동 인식됩니다.\n예) 2208 신민규 <ts250024@ts.hs.kr>"}
            rows={3}
            className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm resize-none mb-1"
          />
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500 text-xs">{clubEmailPreviewCount}개 이메일 인식됨</span>
            <button onClick={handleAddClubMembers} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded font-bold text-sm">일괄 추가</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {clubMembers.map(c => (
              <div key={c.email} className="flex items-center justify-between bg-gray-700/50 rounded px-2 py-1 text-xs">
                <span className="text-gray-200">{c.email}</span>
                <button onClick={() => handleRemoveClubMember(c.email)} className="text-red-400 hover:text-red-300 font-bold">×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-yellow-800/40 p-4 flex flex-col">
          <h2 className="text-lg font-bold text-yellow-400 mb-3">🖨️ 키오스크 잠금 비밀번호</h2>
          <div className="flex gap-2">
            <input type="text" value={kioskPasswordInput} onChange={e => setKioskPasswordInput(e.target.value)} className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleUpdateKioskPassword} className="bg-yellow-600 hover:bg-yellow-500 px-3 py-2 rounded font-bold text-sm text-black">변경</button>
          </div>
          <p className="text-gray-500 text-xs mt-2">현장 키오스크(/print) 진입 시 입력하는 비밀번호입니다.</p>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-pink-800/40 p-4 flex flex-col">
          <h2 className="text-lg font-bold text-pink-400 mb-3">🛠️ 사용자 프로필 수정</h2>
          <p className="text-gray-500 text-xs mb-2">구글 이름이 잘못 인식된 경우 여기서 고칩니다.</p>
          <div className="flex gap-2 mb-3">
            <input type="text" value={profileSearchQuery} onChange={e => setProfileSearchQuery(e.target.value)} placeholder="이메일/이름/학번" className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleSearchProfile} className="bg-pink-600 hover:bg-pink-500 px-3 py-2 rounded font-bold text-sm">검색</button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto mb-3">
            {profileSearchResults.map(p => (
              <button
                key={p.id}
                onClick={() => setEditingProfile({ id: p.id, email: p.email, student_id: p.student_id ?? '', name: p.name, role: p.role })}
                className="w-full text-left bg-gray-700/50 hover:bg-gray-700 rounded px-2 py-1 text-xs text-gray-200"
              >
                {p.email} — {p.name} ({p.student_id ?? '교직원'})
              </button>
            ))}
          </div>
          {editingProfile && (
            <div className="bg-gray-900 p-3 rounded-lg border border-pink-700 space-y-2 max-h-64 overflow-y-auto">
              <p className="text-xs text-gray-400">{editingProfile.email}</p>
              <select value={editingProfile.role} onChange={e => setEditingProfile({ ...editingProfile, role: e.target.value })} className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs">
                <option value="student">학생</option>
                <option value="staff">교직원</option>
              </select>
              {editingProfile.role === 'student' && (
                <input type="text" maxLength={4} value={editingProfile.student_id} onChange={e => setEditingProfile({ ...editingProfile, student_id: e.target.value })} placeholder="학번 4자리" className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs" />
              )}
              <input type="text" value={editingProfile.name} onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })} placeholder="이름" className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs" />
              <div className="flex gap-2">
                <button onClick={() => setEditingProfile(null)} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold">취소</button>
                <button onClick={handleSaveProfile} className="flex-1 py-1.5 bg-pink-600 hover:bg-pink-500 rounded text-xs font-bold">저장</button>
              </div>
            </div>
          )}
        </div>
      </div>
```

- [ ] **Step 7: 블랙리스트 섹션 UI 교체**

`app/admin/page.tsx:578-594` 전체를 다음으로 교체:

```tsx
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-red-600 mb-8">
        <h2 className="text-xl font-bold text-red-400 mb-4">🚫 블랙리스트 관리</h2>
        <div className="flex flex-col md:flex-row gap-2 mb-6">
          <textarea
            value={newBlacklistText}
            onChange={(e) => setNewBlacklistText(e.target.value)}
            placeholder={"이름과 이메일을 붙여넣으면 이메일만 자동 인식됩니다.\n예) 2208 신민규 <ts250024@ts.hs.kr>"}
            rows={2}
            className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm resize-none"
          />
          <div className="flex md:flex-col justify-between md:justify-center items-center gap-2">
            <span className="text-gray-500 text-xs whitespace-nowrap">{blacklistEmailPreviewCount}개 인식됨</span>
            <button onClick={handleAddBlacklistBulk} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold transition-colors whitespace-nowrap">일괄 추가</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {blacklist.length === 0 && <p className="text-gray-500 text-sm">등록된 블랙리스트가 없습니다.</p>}
          {blacklist.map((user) => (
            <div key={user.email} className="bg-red-900/40 border border-red-800 rounded-full px-4 py-1 flex items-center gap-2">
              <span className="text-red-200 text-sm">{user.email}</span>
              <button onClick={() => handleRemoveBlacklist(user.email)} className="text-red-400 hover:text-white font-bold ml-2">×</button>
            </div>
          ))}
        </div>
      </div>
```

- [ ] **Step 8: 정적 검증**

Run: `npx tsc --noEmit`
Expected: `app/admin/page.tsx` 관련 새 타입 에러 없음 (남아있는 `student_id` 참조 — 예: `SEARCH_PROFILE`/`UPDATE_PROFILE` 관련 — 은 프로필 자체의 학번이므로 그대로 유지).

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 9: 수동 확인 (dev 서버)**

Run: `npm run dev`, 브라우저에서 `/admin` 접속 → 4개 박스가 각각 카드로 구분되어 보이는지, 동아리원/블랙리스트 textarea에 `2208 신민규 <ts250024@ts.hs.kr>` 형식 붙여넣었을 때 미리보기 카운트가 올라가는지 확인.

- [ ] **Step 10: Commit**

```bash
git add app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): 4열 박스 카드화 + 동아리원/블랙리스트 이메일 일괄 추가 UI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `app/page.tsx` — 예매 흐름 email 매칭 전환 + 관리자 버튼 노출 조건

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/check` → `{success:true, isAdmin:boolean}` (Task 5), `/api/profiles/search` 응답에 `email` 포함 (Task 4)
- Produces: 없음 (leaf UI)

- [ ] **Step 1: fetchInitialData의 select/매핑 변경**

`app/page.tsx:178-179`을 다음으로 교체:

```ts
        supabase.from('blacklist').select('email'),
        supabase.from('club_members').select('email'),
```

`app/page.tsx:181`을 다음으로 교체:

```ts
      if (clubData) setClubMemberIds(clubData.map(c => c.email));
```

`app/page.tsx:190`을 다음으로 교체:

```ts
      if (bgData) setBlacklistedUsers(bgData.map(b => b.email));
```

- [ ] **Step 2: handleSubmit의 블랙리스트/VIP 체크를 email 기준으로 변경**

`app/page.tsx:275`를 다음으로 교체:

```ts
    if (blacklistedUsers.includes(profile.email)) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");
```

`app/page.tsx:277-281`을 다음으로 교체:

```ts
    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!clubMemberIds.includes(profile.email)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
      }
    }
```

- [ ] **Step 3: handleGroupStart의 블랙리스트/VIP 체크를 email 기준으로 변경**

`app/page.tsx:370-373`을 다음으로 교체:

```ts
    if (blacklistedUsers.includes(profile.email)) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");
    if (selectedSeat && vipSeats.has(selectedSeat) && !clubMemberIds.includes(profile.email)) {
      return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
    }
```

- [ ] **Step 4: memberSearchResults/selectedMember 타입에 email 추가**

`app/page.tsx:123`을 다음으로 교체:

```ts
  const [memberSearchResults, setMemberSearchResults] = useState<{id: string, student_id: string | null, name: string, email: string}[]>([]);
```

`app/page.tsx:124`을 다음으로 교체:

```ts
  const [selectedMember, setSelectedMember] = useState<{id: string, student_id: string | null, name: string, email: string} | null>(null);
```

- [ ] **Step 5: handleAddGroupMember의 블랙리스트/VIP 체크를 email 기준으로 변경**

`app/page.tsx:402`를 다음으로 교체:

```ts
    if (blacklistedUsers.includes(selectedMember.email)) return showAlert("🚫 블랙리스트에 등록되어 추가할 수 없습니다.");
```

`app/page.tsx:410-414`를 다음으로 교체:

```ts
    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!clubMemberIds.includes(selectedMember.email)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n이 좌석에는 동아리 부원만 추가할 수 있습니다.");
      }
    }
```

- [ ] **Step 6: 관리자 버튼 노출 상태 추가**

`app/page.tsx:127`(`groupSendingProgress` state 선언) 바로 다음에 추가:

```ts
  const [isAdmin, setIsAdmin] = useState(false);
```

`app/page.tsx:161-163`(`useEffect(() => { if (profile) fetchInitialData(); }, [profile]);`) 바로 다음에 추가:

```ts
  useEffect(() => {
    if (!profile) { setIsAdmin(false); return; }
    let active = true;
    authFetchGet('/api/admin/check')
      .then(res => res.json())
      .then(data => { if (active && data.success) setIsAdmin(data.isAdmin); })
      .catch(() => {});
    return () => { active = false; };
  }, [profile]);
```

- [ ] **Step 7: 관리자/발권기 버튼 조건부 렌더링**

`app/page.tsx:546-556`을 다음으로 교체:

```tsx
      <div className="w-full max-w-4xl flex justify-end gap-3 z-20 mt-2 md:mt-0">
        <button onClick={() => setIsManualOpen(true)} className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/50 rounded-lg text-xs md:text-sm text-indigo-300 font-bold transition-all shadow-lg">
          📖 이용 안내
        </button>
        {isAdmin && (
          <>
            <Link href="/admin" className="px-4 py-2 bg-white/5 backdrop-blur-md hover:bg-white/10 border border-white/10 rounded-lg text-xs md:text-sm text-slate-300 font-bold transition-all shadow-lg hover:shadow-white/5">
              ⚙️ 관리자
            </Link>
            <Link href="/print" className="px-4 py-2 bg-white/5 backdrop-blur-md hover:bg-white/10 border border-white/10 rounded-lg text-xs md:text-sm text-slate-300 font-bold transition-all shadow-lg hover:shadow-white/5">
              🖨️ 발권기
            </Link>
          </>
        )}
      </div>
```

- [ ] **Step 8: 정적 검증**

Run: `npx tsc --noEmit`
Expected: `app/page.tsx` 관련 새 타입 에러 없음.

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 9: 수동 확인 (dev 서버)**

Run: `npm run dev`, 관리자 계정으로 로그인 → 메인 페이지에 "관리자"/"발권기" 버튼 보이는지 확인. `admins` 테이블에 없는 일반 계정으로 로그인 → 두 버튼 안 보이는지 확인. VIP 좌석 클릭 시 `club_members`에 이메일이 있는 계정만 예매 가능한지, 블랙리스트에 등록된 이메일 계정은 예매가 막히는지 확인.

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(main): VIP/블랙리스트 체크 이메일 기준 전환, 관리자 버튼 권한 노출

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 전체 빌드 검증

**Files:**
- 없음 (검증 전용 태스크)

**Interfaces:**
- Consumes: Task 1~7의 모든 변경사항

- [ ] **Step 1: 전체 빌드**

Run: `npm run build`
Expected: 빌드 성공, 타입 에러 없음.

- [ ] **Step 2: 전체 lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: 남은 수동 작업 문서에 마이그레이션 실행 안내 추가 여부 확인**

`docs/superpowers/remaining-manual-steps.md`를 열어서 "0002 마이그레이션 SQL을 Supabase SQL Editor에서 실행" 항목이 있는지 확인하고 없으면 한 줄 추가한다(이 프로젝트는 마이그레이션을 수동 실행하는 관례이므로).

- [ ] **Step 4: Commit (문서만 변경된 경우)**

```bash
git add docs/superpowers/remaining-manual-steps.md
git commit -m "$(cat <<'EOF'
docs: 0002 마이그레이션 수동 실행 안내 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
