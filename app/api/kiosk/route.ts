import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json();

    if (action === 'PRINT_TICKET') {
      const { ticketId, studentId, studentName, password, seatNumber } = payload;
      
      const authKey = studentId === "교직원" ? studentName : studentId;
      const { data: authResult, error: authError } = await supabaseAdmin.rpc('verify_student_password', { 
        p_student_id: authKey, 
        p_password: password 
      });

      if (authError || !authResult.success) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Invalid password' }, { status: 401 });
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

    if (action === 'UPDATE_GROUP_POPCORN') {
      const { reservationId, popcornOrder, paymentStatus } = payload;
      
      const { error } = await supabaseAdmin.from('reservations').update({ 
        popcorn_order: popcornOrder, 
        payment_status: paymentStatus 
      }).eq('id', reservationId);
      
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Kiosk API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
