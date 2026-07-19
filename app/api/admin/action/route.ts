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
        const { data: movieData, error: e1 } = await supabaseAdmin.from('movie_settings').select('*').eq('is_active', true).single();
        if (e1) throw e1;

        const [resQ, blQ, logQ, adminQ, clubQ, kioskQ] = await Promise.all([
          supabaseAdmin.from('reservations')
            .select('id, seat_number, payment_status, student_name, student_id, email, popcorn_order, is_printed, is_group_leader')
            .eq('movie_date', movieData?.db_date)
            .order('created_at', { ascending: false }),
          supabaseAdmin.from('blacklist').select('email, created_at').order('created_at', { ascending: false }),
          supabaseAdmin.from('activity_logs').select('id, created_at, student_id, student_name, description').order('created_at', { ascending: false }).limit(100),
          supabaseAdmin.from('admins').select('email, added_by, created_at').order('created_at', { ascending: false }),
          supabaseAdmin.from('club_members').select('email, added_by, created_at').order('created_at', { ascending: false }),
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
        const { error } = await supabaseAdmin.from('movie_settings').update(payload).eq('is_active', true);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      // 새 회차 시작: 현재 상영중인 영화를 이력으로 보존(is_active=false)하고
      // 새 movie_settings 행을 활성 상태로 생성한다. 예매(reservations)는 movie_settings_id로
      // 이전 회차에 계속 연결되어 있으므로 삭제하지 않는다(과거 CLEAR_RESERVATIONS 완전 대체).
      case 'START_NEW_MOVIE': {
        const { data: prevActive } = await supabaseAdmin.from('movie_settings').select('id').eq('is_active', true).maybeSingle();

        const { error: deactivateError } = await supabaseAdmin.from('movie_settings').update({ is_active: false }).eq('is_active', true);
        if (deactivateError) throw deactivateError;

        const { data: newMovie, error: insertError } = await supabaseAdmin.from('movie_settings')
          .insert([{ ...payload, is_active: true }]).select('*').single();
        if (insertError) {
          // 새 행 생성 실패 시 활성 회차가 하나도 없는 상태로 남지 않도록 이전 회차를 복구.
          if (prevActive) await supabaseAdmin.from('movie_settings').update({ is_active: true }).eq('id', prevActive.id);
          throw insertError;
        }

        return NextResponse.json({ success: true, data: newMovie });
      }

      case 'LIST_MOVIE_HISTORY': {
        const { data, error } = await supabaseAdmin.from('movie_settings')
          .select('*').eq('is_active', false).order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'FETCH_HISTORY_RESERVATIONS': {
        const { movieSettingsId } = payload;
        const { data, error } = await supabaseAdmin.from('reservations')
          .select('id, seat_number, payment_status, student_name, student_id, email, popcorn_order, is_printed, is_group_leader')
          .eq('movie_settings_id', movieSettingsId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ success: true, data });
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

      case 'ADD_BLACKLIST_BULK': {
        const { emails, movieDate } = payload;
        const cleanEmails = Array.from(new Set((emails as string[] || [])
          .map(e => String(e).trim().toLowerCase())
          .filter(e => e.endsWith('@ts.hs.kr'))));

        if (cleanEmails.length === 0) {
          return NextResponse.json({ success: false, error: '@ts.hs.kr 이메일이 없습니다.' }, { status: 400 });
        }

        type ReservationRow = {
          id: string; seat_number: string; student_id: string | null; student_name: string;
          email: string; popcorn_order: string; payment_status: string;
        };
        const results: { email: string; name: string; canceledTicket: ReservationRow | null }[] = [];

        for (const email of cleanEmails) {
          const { data: existingTickets } = await supabaseAdmin.from('reservations')
            .select('*')
            .eq('email', email)
            .eq('movie_date', movieDate);

          let canceledTicket: ReservationRow | null = null;
          let name: string;

          if (existingTickets && existingTickets.length > 0) {
            const ticket = existingTickets[0] as ReservationRow;
            canceledTicket = ticket;
            name = ticket.student_name;
            await supabaseAdmin.from('reservations').delete().eq('id', ticket.id);
            await supabaseAdmin.from('activity_logs').insert([{
              student_id: ticket.student_id, student_name: ticket.student_name,
              description: `블랙리스트 등록 및 예매 자동 취소 (${ticket.seat_number})`
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
