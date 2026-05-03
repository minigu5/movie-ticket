import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AdminAction } from "@/lib/api-types";

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  let body: AdminAction;
  try {
    body = (await req.json()) as AdminAction;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const expected = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (!expected || body.adminPassword !== expected) return unauthorized();

  try {
    switch (body.action) {
      case "LOGIN":
        return NextResponse.json({ success: true });

      case "FETCH_INITIAL_DATA": {
        const [movie, blacklist, logs] = await Promise.all([
          supabaseAdmin.from("movie_settings").select("*").eq("id", 1).single(),
          supabaseAdmin.from("blacklist").select("*").order("created_at", { ascending: false }),
          supabaseAdmin
            .from("activity_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100),
        ]);
        const dbDate = movie.data?.db_date;
        const reservations = dbDate
          ? await supabaseAdmin
              .from("reservations")
              .select("*")
              .eq("movie_date", dbDate)
              .order("created_at", { ascending: false })
          : { data: [] as never[] };
        return NextResponse.json({
          success: true,
          data: {
            movieData: movie.data,
            resData: reservations.data,
            blData: blacklist.data,
            logData: logs.data,
          },
        });
      }

      case "UPDATE_SETTINGS": {
        const { error } = await supabaseAdmin
          .from("movie_settings")
          .update(body.payload)
          .eq("id", 1);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case "CLEAR_RESERVATIONS": {
        const { error } = await supabaseAdmin
          .from("reservations")
          .delete()
          .eq("movie_date", body.payload.movieDate);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case "APPROVE_RESERVATION": {
        const { id, studentId, studentName, seatNumber } = body.payload;
        const { error } = await supabaseAdmin
          .from("reservations")
          .update({ payment_status: "confirmed" })
          .eq("id", id);
        if (error) throw error;
        await supabaseAdmin
          .from("activity_logs")
          .insert([{ student_id: studentId, student_name: studentName, description: `관리자 승인 (${seatNumber})` }]);
        return NextResponse.json({ success: true });
      }

      case "CANCEL_RESERVATION": {
        const { id, studentId, studentName, seatNumber, description } = body.payload;
        const { error } = await supabaseAdmin.from("reservations").delete().eq("id", id);
        if (error) throw error;
        await supabaseAdmin.from("activity_logs").insert([
          {
            student_id: studentId,
            student_name: studentName,
            description: description ?? `관리자 강제 취소 (${seatNumber})`,
          },
        ]);
        return NextResponse.json({ success: true });
      }

      case "RESET_PRINT": {
        const { id, studentId, studentName, seatNumber } = body.payload;
        const { error } = await supabaseAdmin
          .from("reservations")
          .update({ is_printed: false })
          .eq("id", id);
        if (error) throw error;
        await supabaseAdmin.from("activity_logs").insert([
          { student_id: studentId, student_name: studentName, description: `관리자 티켓 발권 상태 초기화 (${seatNumber})` },
        ]);
        return NextResponse.json({ success: true });
      }

      case "ADD_BLACKLIST": {
        const { studentId, studentName, movieDate } = body.payload;
        const { error: insErr } = await supabaseAdmin
          .from("blacklist")
          .insert([{ student_id: studentId, student_name: studentName }]);
        if (insErr) throw insErr;
        const { data: existing } = await supabaseAdmin
          .from("reservations")
          .select("*")
          .eq("movie_date", movieDate)
          .eq("student_id", studentId)
          .maybeSingle();
        let canceledTicket: unknown = null;
        if (existing) {
          await supabaseAdmin.from("reservations").delete().eq("id", existing.id);
          await supabaseAdmin.from("activity_logs").insert([
            {
              student_id: studentId,
              student_name: studentName,
              description: `블랙리스트 등록 및 예매 자동 취소 (${existing.seat_number})`,
            },
          ]);
          canceledTicket = existing;
        } else {
          await supabaseAdmin.from("activity_logs").insert([
            { student_id: studentId, student_name: studentName, description: "블랙리스트 등록" },
          ]);
        }
        return NextResponse.json({ success: true, canceledTicket });
      }

      case "REMOVE_BLACKLIST": {
        const { error } = await supabaseAdmin
          .from("blacklist")
          .delete()
          .eq("student_id", body.payload.studentId);
        if (error) throw error;
        await supabaseAdmin.from("activity_logs").insert([
          { student_id: body.payload.studentId, student_name: "-", description: "블랙리스트 해제" },
        ]);
        return NextResponse.json({ success: true });
      }

      case "LOG_ACTION": {
        await supabaseAdmin.from("activity_logs").insert([body.payload]);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("admin action error", err);
    const msg = err instanceof Error ? err.message : "Server Error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
