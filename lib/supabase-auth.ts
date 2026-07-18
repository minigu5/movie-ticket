// lib/supabase-auth.ts
import { supabase } from './supabase';

export type AppProfile = {
  id: string;
  email: string;
  student_id: string | null;
  name: string;
  role: 'student' | 'staff';
};

export function parseGoogleIdentity(fullName: string): { student_id: string | null; name: string; role: 'student' | 'staff' } {
  const cleaned = fullName.trim();
  const match = cleaned.match(/^(\d{4})\s?(.+)$/);
  if (match && match[2].trim().length > 0) {
    return { student_id: match[1], name: match[2].trim(), role: 'student' };
  }
  return { student_id: null, name: cleaned, role: 'staff' };
}

export async function signInWithGoogle(redirectPath?: string) {
  const redirectTo = `${window.location.origin}${redirectPath ?? window.location.pathname + window.location.search}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { queryParams: { hd: 'ts.hs.kr' }, redirectTo }
  });
  if (error) throw error;
}

export async function signOutAndClear() {
  await supabase.auth.signOut();
}

export class DomainNotAllowedError extends Error {
  constructor() { super('DOMAIN_NOT_ALLOWED'); this.name = 'DomainNotAllowedError'; }
}

// 세션이 있으면 profiles 행을 반환한다. 최초 로그인이면 구글 이름을 파싱해 생성한다.
// @ts.hs.kr 도메인이 아니면 즉시 로그아웃시키고 DomainNotAllowedError를 던진다.
export async function ensureProfile(): Promise<AppProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const email = session.user.email ?? '';
  if (!email.toLowerCase().endsWith('@ts.hs.kr')) {
    await supabase.auth.signOut();
    throw new DomainNotAllowedError();
  }

  const { data: existing } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (existing) return existing as AppProfile;

  const fullName = (session.user.user_metadata?.full_name || session.user.user_metadata?.name || email) as string;
  const identity = parseGoogleIdentity(fullName);

  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ id: session.user.id, email, ...identity })
    .select('*')
    .single();

  if (error) throw error;
  return created as AppProfile;
}

// 관리자/키오스크 API 등 인증이 필요한 POST 요청에 access token을 실어 보낸다.
export async function authFetch(url: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`
    },
    body: JSON.stringify(body)
  });
}

// 인증이 필요한 GET 요청용 (예: 사용자 검색).
export async function authFetchGet(url: string) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }
  });
}
