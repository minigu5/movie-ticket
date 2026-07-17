// app/api/admin/action/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api-auth';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const adminEmail = auth.user.email as string;

    const { action, payload } = await req.json();

    switch (action) {
      case 'FETCH_INITIAL_DATA': {
        const { data: movieData, error: e1 } = await supabaseAdmin.from('movie_settings').select('*').eq('id', 1).single();
        if (e1) throw e1;

        const [resQ, blQ, logQ, adminQ, clubQ, kioskQ] = await Promise.all([
          supabaseAdmin.from('reservations')
            .select('id, seat_number, payment_status, student_name, student_id, email, popcorn_order, is_printed, is_group_leader')
            .eq('movie_date', movieData?.db_date)
            .order('created_at', { ascending: false }),
          supabaseAdmin.from('blacklist').select('student_id, student_name').order('created_at', { ascending: false }),
          supabaseAdmin.from('activity_logs').select('id, created_at, student_id, student_name, description').order('created_at', { ascending: false }).limit(100),
          supabaseAdmin.from('admins').select('email, added_by, created_at').order('created_at', { ascending: false }),
          supabaseAdmin.from('club_members').select('student_id, added_by, created_at').order('created_at', { ascending: false }),
          supabaseAdmin.from('kiosk_settings').select('password').eq('id', 1).single()
        ]);

        if (resQ.error) throw resQ.error;
        if (blQ.error) throw blQ.error;
        if (logQ.error) throw logQ.error;
        if (adminQ.error) throw adminQ.error;
        if (clubQ.error) throw clubQ.error;
        if (kioskQ.error) throw kioskQ.error;

        return NextResponse.json({
          success: true,
          data: {
            movieData, resData: resQ.data, blData: blQ.data, logData: logQ.data,
            adminData: adminQ.data, clubData: clubQ.data, kioskPassword: kioskQ.data?.password ?? ''
          }
        });
      }

      case 'UPDATE_SETTINGS': {
        const { error } = await supabaseAdmin.from('movie_settings').update(payload).eq('id', 1);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'CLEAR_RESERVATIONS': {
        const { movieDate } = payload;
        const { error } = await supabaseAdmin.from('reservations').delete().eq('movie_date', movieDate);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'APPROVE_RESERVATION': {
        const { id, studentId, studentName, seatNumber } = payload;
        const { error: updateError } = await supabaseAdmin.from('reservations').update({ payment_status: 'confirmed' }).eq('id', id);
        if (updateError) throw updateError;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: studentId, student_name: studentName,
          description: `관리자 승인 (${seatNumber})`
        }]);

        return NextResponse.json({ success: true });
      }

      case 'CANCEL_RESERVATION': {
        const { id, studentId, studentName, seatNumber, description } = payload;
        const { error: deleteError } = await supabaseAdmin.from('reservations').delete().eq('id', id);
        if (deleteError) throw deleteError;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: studentId, student_name: studentName,
          description: description || `관리자 강제 취소 (${seatNumber})`
        }]);

        return NextResponse.json({ success: true });
      }

      case 'RESET_PRINT': {
        const { id, studentId, studentName, seatNumber } = payload;
        const { error } = await supabaseAdmin.from('reservations').update({ is_printed: false }).eq('id', id);
        if (error) throw error;

        await supabaseAdmin.from('activity_logs').insert([{
          student_id: studentId, student_name: studentName,
          description: `관리자 티켓 발권 상태 초기화 (${seatNumber})`
        }]);

        return NextResponse.json({ success: true });
      }

      case 'ADD_BLACKLIST': {
        const { studentId, studentName, movieDate } = payload;

        const { error: blError } = await supabaseAdmin.from('blacklist').insert([{ student_id: studentId, student_name: studentName }]);
        if (blError) throw blError;

        const { data: existingTickets } = await supabaseAdmin.from('reservations')
          .select('*')
          .eq('student_id', studentId)
          .eq('movie_date', movieDate);

        let canceledTicket = null;
        if (existingTickets && existingTickets.length > 0) {
          canceledTicket = existingTickets[0];
          await supabaseAdmin.from('reservations').delete().eq('id', canceledTicket.id);
          await supabaseAdmin.from('activity_logs').insert([{
            student_id: studentId, student_name: studentName,
            description: `블랙리스트 등록 및 예매 자동 취소 (${canceledTicket.seat_number})`
          }]);
        }

        // 취소된 예약이 없으면(아직 로그인/예매한 적 없는 학생 선제 등록), profiles에서 이메일을 찾아본다.
        // 둘 다 없으면 안내 메일 발송은 그냥 건너뛴다(email: null).
        let email: string | null = canceledTicket?.email ?? null;
        if (!email) {
          const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('student_id', studentId).maybeSingle();
          email = prof?.email ?? null;
        }

        return NextResponse.json({ success: true, canceledTicket, email });
      }

      case 'REMOVE_BLACKLIST': {
        const { studentId } = payload;
        const { error } = await supabaseAdmin.from('blacklist').delete().eq('student_id', studentId);
        if (error) throw error;

        const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('student_id', studentId).maybeSingle();
        return NextResponse.json({ success: true, email: prof?.email ?? null });
      }

      case 'LIST_ADMINS': {
        const { data, error } = await supabaseAdmin.from('admins').select('email, added_by, created_at').order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'ADD_ADMIN': {
        const { email } = payload;
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail.endsWith('@ts.hs.kr')) {
          return NextResponse.json({ success: false, error: '@ts.hs.kr 이메일만 등록할 수 있습니다.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('admins').insert([{ email: cleanEmail, added_by: adminEmail }]);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'REMOVE_ADMIN': {
        const { email } = payload;
        if (email === adminEmail) {
          return NextResponse.json({ success: false, error: '본인 계정은 스스로 제거할 수 없습니다.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('admins').delete().eq('email', email);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'LIST_CLUB_MEMBERS': {
        const { data, error } = await supabaseAdmin.from('club_members').select('student_id, added_by, created_at').order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'ADD_CLUB_MEMBER': {
        const { studentId } = payload;
        const cleanId = String(studentId || '').trim();
        if (!/^\d{4}$/.test(cleanId)) {
          return NextResponse.json({ success: false, error: '학번은 4자리 숫자여야 합니다.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('club_members').insert([{ student_id: cleanId, added_by: adminEmail }]);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'REMOVE_CLUB_MEMBER': {
        const { studentId } = payload;
        const { error } = await supabaseAdmin.from('club_members').delete().eq('student_id', studentId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'SEARCH_PROFILE': {
        const { query } = payload;
        const q = String(query || '').replace(/[^a-zA-Z0-9가-힣.@_\-\s]/g, '').trim().slice(0, 40);
        if (!q) return NextResponse.json({ success: true, data: [] });
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('id, email, student_id, name, role')
          .or(`email.ilike.%${q}%,name.ilike.%${q}%,student_id.eq.${q}`)
          .limit(10);
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'UPDATE_PROFILE': {
        const { id, studentId, name, role } = payload;
        if (!['student', 'staff'].includes(role)) {
          return NextResponse.json({ success: false, error: 'role은 student 또는 staff여야 합니다.' }, { status: 400 });
        }
        const cleanStudentId = role === 'staff' ? null : String(studentId || '').trim();
        if (role === 'student' && !/^\d{4}$/.test(cleanStudentId || '')) {
          return NextResponse.json({ success: false, error: '학생은 학번 4자리가 필요합니다.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('profiles')
          .update({ student_id: cleanStudentId, name: String(name || '').trim(), role })
          .eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'UPDATE_KIOSK_PASSWORD': {
        const { password } = payload;
        const cleanPassword = String(password || '').trim();
        if (!cleanPassword) {
          return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('kiosk_settings').update({ password: cleanPassword, updated_at: new Date().toISOString() }).eq('id', 1);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Admin API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
