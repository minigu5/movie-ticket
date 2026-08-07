// lib/supabase-admin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ⚠️ WARNING: Never expose this key in client-side code!

// Cloudflare Workers에서는 process.env가 요청 처리 시점에야 채워지므로,
// 모듈 최상위에서 즉시 클라이언트를 만들면 시크릿이 비어있는 상태로 고정된다.
// 요청 핸들러 안에서 처음 호출될 때 생성하도록 지연 초기화한다.
let cached: SupabaseClient | null = null

// RLS를 우회하는 서버 전용 관리자 클라이언트
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  if (!supabaseServiceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.')
  }

  cached = createClient(supabaseUrl, supabaseServiceRoleKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  return cached
}
