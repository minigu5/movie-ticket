import { NextResponse } from "next/server";
import { getTransporter } from "@/lib/mailer";
import { blacklistHtml, blacklistSubject } from "@/emails/blacklist";
import type { BlacklistMailBody } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BlacklistMailBody;
    if (!body.email) return NextResponse.json({ success: true });
    const action = body.action === "added" ? "added" : "removed";
    const { transporter, user } = getTransporter();
    await transporter.sendMail({
      from: `"영화대교" <${user}>`,
      to: body.email,
      subject: blacklistSubject(body.name, action),
      html: blacklistHtml(body.name, action),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("blacklist mail error", err);
    return NextResponse.json({ success: false, error: "Mail Failed" }, { status: 500 });
  }
}
