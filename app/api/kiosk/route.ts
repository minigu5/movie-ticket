// app/api/kiosk/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json();

    if (action === 'KIOSK_LOGIN') {
      const { password } = payload;
      const { data: settings, error } = await supabaseAdmin.from('kiosk_settings').select('password').eq('id', 1).single();
      if (error) throw error;

      if (!settings || settings.password !== password) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Invalid kiosk password' }, { status: 401 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'PRINT_TICKET') {
      const { ticketId, studentId, studentName, seatNumber } = payload;

      const { data: ticket, error: fetchError } = await supabaseAdmin.from('reservations')
        .select('id, student_id, student_name')
        .eq('id', ticketId)
        .single();

      if (fetchError || !ticket || ticket.student_id !== studentId || ticket.student_name !== studentName) {
        return NextResponse.json({ success: false, error: 'Unauthorized: 학번/이름이 예약 내역과 일치하지 않습니다.' }, { status: 401 });
      }

      const { error: e1 } = await supabaseAdmin.from('reservations').update({ is_printed: true }).eq('id', ticketId);
      if (e1) throw e1;

      const { error: e2 } = await supabaseAdmin.from('activity_logs').insert([{
        student_id: studentId,
        student_name: studentName,
        description: `현장 KIOSK 티켓 발권 완료 (${seatNumber})`
      }]);
      if (e2) throw e2;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Kiosk API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
