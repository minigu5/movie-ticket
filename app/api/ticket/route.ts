import { NextResponse } from "next/server";
import { getTransporter } from "@/lib/mailer";
import type { TicketRequest } from "@/lib/api-types";
import { ticketHtml, ticketSubject } from "@/emails/ticket";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TicketRequest;
    if (!body.email) return NextResponse.json({ success: true });
    const { transporter, user } = getTransporter();
    await transporter.sendMail({
      from: `"영화대교" <${user}>`,
      to: body.email,
      subject: ticketSubject(body.name, body.seat, body.statusType),
      html: ticketHtml(body),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("ticket mail error", err);
    return NextResponse.json({ success: false, error: "Mail Failed" }, { status: 500 });
  }
}
