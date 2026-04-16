import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { action, adminPassword, payload } = await req.json();

    // 1. 관리자 비밀번호 검증 (환경 변수 기준)
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid admin password' }, { status: 401 });
    }

    switch (action) {
      case 'LOGIN': {
        return NextResponse.json({ success: true });
      }

      case 'FETCH_INITIAL_DATA': {
        const { data: movieData, error: e1 } = await supabaseAdmin.from('movie_settings').select('*').eq('id', 1).single();
        if (e1) throw e1;
        const { data: resData, error: e2 } = await supabaseAdmin.from('reservations').select('*').eq('movie_date', movieData?.db_date).order('created_at', { ascending: false });
        if (e2) throw e2;
        const { data: blData, error: e3 } = await supabaseAdmin.from('blacklist').select('*').order('created_at', { ascending: false });
        if (e3) throw e3;
        const { data: logData, error: e4 } = await supabaseAdmin.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (e4) throw e4;
        
        return NextResponse.json({ success: true, data: { movieData, resData, blData, logData } });
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
        
        // 1. 블랙리스트 추가
        const { error: blError } = await supabaseAdmin.from('blacklist').insert([{ student_id: studentId, student_name: studentName }]);
        if (blError) throw blError;

        // 2. 해당 학생의 기존 예매 내역 조회 (Service Role 활용)
        const { data: existingTickets } = await supabaseAdmin.from('reservations')
          .select('*')
          .eq('student_id', studentId)
          .eq('movie_date', movieDate);

        let canceledTicket = null;
        if (existingTickets && existingTickets.length > 0) {
          canceledTicket = existingTickets[0];
          // 예매 취소 처리
          await supabaseAdmin.from('reservations').delete().eq('id', canceledTicket.id);
          // 로그 기록
          await supabaseAdmin.from('activity_logs').insert([{ 
            student_id: studentId, student_name: studentName, 
            description: `블랙리스트 등록 및 예매 자동 취소 (${canceledTicket.seat_number})` 
          }]);
        }

        return NextResponse.json({ success: true, canceledTicket });
      }

      case 'REMOVE_BLACKLIST': {
        const { studentId } = payload;
        const { error } = await supabaseAdmin.from('blacklist').delete().eq('student_id', studentId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'LOG_ACTION': {
        const { studentId, studentName, description } = payload;
        await supabaseAdmin.from('activity_logs').insert([{ student_id: studentId, student_name: studentName, description }]);
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
