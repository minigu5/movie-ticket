// lib/api-auth.ts
import { supabaseAdmin } from './supabase-admin';
import type { User } from '@supabase/supabase-js';

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  if (!data.user.email?.toLowerCase().endsWith('@ts.hs.kr')) return null;

  return data.user;
}

type AdminCheckResult =
  | { ok: true; user: User }
  | { ok: false; status: number; error: string };

export async function requireAdmin(req: Request): Promise<AdminCheckResult> {
  const user = await getUserFromRequest(req);
  if (!user) return { ok: false, status: 401, error: '로그인이 필요합니다.' };

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('email')
    .eq('email', user.email as string)
    .maybeSingle();

  if (!admin) return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
  return { ok: true, user };
}
