import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { KioskAction } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as KioskAction;

    if (body.action === "PRINT_TICKET") {
      const { ticketId, studentId, studentName, password, seatNumber } = body.payload;
      const authKey = studentId === "교직원" ? studentName : studentId;
      const { data: auth, error: rpcErr } = await supabaseAdmin.rpc("verify_student_password", {
        p_student_id: authKey,
        p_password: password,
      });
      if (rpcErr) throw rpcErr;
      if (!auth?.success) {
        return NextResponse.json({ success: false, error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
      }
      const { error: updErr } = await supabaseAdmin
        .from("reservations")
        .update({ is_printed: true })
        .eq("id", ticketId);
      if (updErr) throw updErr;
      await supabaseAdmin.from("activity_logs").insert([
        { student_id: studentId, student_name: studentName, description: `현장 KIOSK 티켓 발권 완료 (${seatNumber})` },
      ]);
      return NextResponse.json({ success: true });
    }

    if (body.action === "UPDATE_GROUP_POPCORN") {
      const { reservationId, popcornOrder, paymentStatus } = body.payload;
      const { error } = await supabaseAdmin
        .from("reservations")
        .update({ popcorn_order: popcornOrder, payment_status: paymentStatus })
        .eq("id", reservationId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("kiosk error", err);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
