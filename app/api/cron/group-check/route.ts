import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { USER_EMAILS } from "@/lib/emails";
import { getTransporter } from "@/lib/mailer";
import {
  groupCancelHtml,
  groupCancelSubject,
  groupReportHtml,
  groupReportSubject,
} from "@/emails/groupReport";

export const dynamic = "force-dynamic";

interface MemberRow {
  id: string;
  group_id: string | null;
  is_group_leader: boolean | null;
  student_id: string;
  student_name: string;
  seat_number: string;
  payment_status: string;
  group_expires_at: string | null;
  group_report_sent: boolean | null;
  movie_date: string;
}

async function fetchSettings() {
  const { data } = await supabaseAdmin
    .from("movie_settings")
    .select("title, date_string")
    .eq("id", 1)
    .single();
  return { title: data?.title ?? "", date: data?.date_string ?? "" };
}

function emailFor(studentId: string, studentName: string): string | undefined {
  return studentId === "교직원" ? USER_EMAILS[studentName] : USER_EMAILS[studentId];
}

export async function GET() {
  try {
    const nowIso = new Date().toISOString();
    const { data: leaders, error } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .eq("is_group_leader", true)
      .eq("group_report_sent", false)
      .lt("group_expires_at", nowIso);
    if (error) throw error;
    if (!leaders || leaders.length === 0) {
      return NextResponse.json({ message: "no expired groups", processed: 0 });
    }

    const { title, date } = await fetchSettings();
    const { transporter, user } = getTransporter();
    const fromHeader = `"영화대교" <${user}>`;
    let processed = 0;

    for (const leader of leaders as MemberRow[]) {
      if (!leader.group_id) continue;
      const { data: members } = await supabaseAdmin
        .from("reservations")
        .select("*")
        .eq("group_id", leader.group_id);
      if (!members) continue;

      const expired = (members as MemberRow[]).filter(
        (m) => !m.is_group_leader && m.payment_status === "group_pending"
      );
      const confirmedMembers = (members as MemberRow[]).filter(
        (m) => !m.is_group_leader && m.payment_status !== "group_pending"
      );

      const expiredIds = expired.map((m) => m.id);
      if (expiredIds.length > 0) {
        await supabaseAdmin.from("reservations").delete().in("id", expiredIds);
      }

      const confirmedList = [
        { name: leader.student_name, seat: leader.seat_number },
        ...confirmedMembers.map((m) => ({ name: m.student_name, seat: m.seat_number })),
      ];
      const expiredList = expired.map((m) => ({ name: m.student_name, seat: m.seat_number }));

      const reportSubject = groupReportSubject(confirmedList.length);
      const reportHtml = groupReportHtml({
        leaderName: leader.student_name,
        movieTitle: title,
        movieDate: date,
        confirmed: confirmedList,
        expired: expiredList,
      });

      const reportRecipients = [leader, ...confirmedMembers]
        .map((m) => emailFor(m.student_id, m.student_name))
        .filter((e): e is string => Boolean(e));
      await Promise.all(
        reportRecipients.map((email) =>
          transporter
            .sendMail({ from: fromHeader, to: email, subject: reportSubject, html: reportHtml })
            .catch((e) => console.error("report mail err", e))
        )
      );

      await Promise.all(
        expired.map((m) => {
          const email = emailFor(m.student_id, m.student_name);
          if (!email) return Promise.resolve();
          return transporter
            .sendMail({
              from: fromHeader,
              to: email,
              subject: groupCancelSubject(m.student_name),
              html: groupCancelHtml({
                name: m.student_name,
                seat: m.seat_number,
                leaderName: leader.student_name,
                movieTitle: title,
              }),
            })
            .catch((e) => console.error("cancel mail err", e));
        })
      );

      await supabaseAdmin
        .from("reservations")
        .update({ group_report_sent: true })
        .eq("id", leader.id);

      await supabaseAdmin.from("activity_logs").insert([
        {
          student_id: leader.student_id,
          student_name: leader.student_name,
          description: `단체 예매 정리 완료 (확정 ${confirmedList.length}명, 취소 ${expiredList.length}명)`,
        },
      ]);

      processed++;
    }

    return NextResponse.json({ message: "processed", processedGroups: processed });
  } catch (err) {
    console.error("cron group-check error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
