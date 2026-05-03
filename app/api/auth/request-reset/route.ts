import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { USER_EMAILS } from "@/lib/emails";
import { getTransporter } from "@/lib/mailer";
import { resetHtml, resetSubject } from "@/emails/reset";
import type { RequestResetBody } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestResetBody;
    const authKey = body.studentId === "교직원" ? body.studentName : body.studentId;
    const email = body.studentId === "교직원" ? USER_EMAILS[body.studentName] : USER_EMAILS[body.studentId];
    if (!email) {
      return NextResponse.json({ success: false, error: "이메일을 찾을 수 없습니다." }, { status: 400 });
    }

    const resetToken = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from("student_auth")
      .update({ reset_token: resetToken, token_expires_at: expires })
      .eq("student_id", authKey);
    if (error) throw error;

    const params = new URLSearchParams({ token: resetToken, id: authKey });
    if (body.returnUrl) params.set("returnUrl", body.returnUrl);
    const link = `${body.baseUrl}/reset-password?${params.toString()}`;

    const { transporter, user } = getTransporter();
    await transporter.sendMail({
      from: `"영화대교" <${user}>`,
      to: email,
      subject: resetSubject(body.studentName),
      html: resetHtml(body.studentName, link),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reset request error", err);
    return NextResponse.json({ success: false, error: "Request Failed" }, { status: 500 });
  }
}
