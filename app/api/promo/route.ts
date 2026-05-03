import { NextResponse } from "next/server";
import { getTransporter } from "@/lib/mailer";
import { promoHtml, promoSubject } from "@/emails/promo";
import type { PromoBody } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PromoBody;
    const { transporter, user } = getTransporter();
    await Promise.all(
      body.chunk.map((r) =>
        r.email
          ? transporter.sendMail({
              from: `"영화대교" <${user}>`,
              to: r.email,
              subject: promoSubject(r.name),
              html: promoHtml(r.name, r.studentId, body.movieInfo, body.baseUrl),
            })
          : Promise.resolve()
      )
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("promo error", err);
    return NextResponse.json({ success: false, error: "Mail Failed" }, { status: 500 });
  }
}
