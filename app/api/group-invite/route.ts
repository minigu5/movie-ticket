import { NextResponse } from "next/server";
import { getTransporter } from "@/lib/mailer";
import { groupInviteHtml, groupInviteSubject } from "@/emails/groupInvite";
import type { GroupInviteBody } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GroupInviteBody;
    const { transporter, user } = getTransporter();
    await Promise.all(
      body.members.map((m) => {
        if (!m.email) return Promise.resolve();
        const link = `${body.baseUrl}/group-confirm?groupId=${body.groupId}&memberId=${m.memberId}`;
        return transporter.sendMail({
          from: `"영화대교" <${user}>`,
          to: m.email,
          subject: groupInviteSubject(m.name, m.seat),
          html: groupInviteHtml({
            name: m.name,
            seat: m.seat,
            leaderName: body.leaderName,
            movieTitle: body.movieTitle,
            movieDate: body.movieDate,
            link,
          }),
        });
      })
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("group invite error", err);
    return NextResponse.json({ success: false, error: "Mail Failed" }, { status: 500 });
  }
}
