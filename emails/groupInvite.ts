import { btn, emailShell } from "./layout";

export function groupInviteSubject(name: string, seat: string): string {
  return `[영화대교] ${name}님, 단체 관람에 초대되었습니다 — ${seat} 좌석`;
}

export function groupInviteHtml(args: {
  name: string;
  seat: string;
  leaderName: string;
  movieTitle: string;
  movieDate: string;
  link: string;
}): string {
  const { name, seat, leaderName, movieTitle, movieDate, link } = args;
  const body = `
    <div style="background:#18181b;border:1px solid #10b98140;border-radius:16px;padding:28px;">
      <div style="font-size:11px;letter-spacing:0.3em;color:#34d399;text-transform:uppercase;">group invitation</div>
      <h1 style="margin:10px 0 0 0;font-size:22px;color:#fafafa;letter-spacing:-0.01em;">단체 관람 초대장</h1>
      <p style="margin:8px 0 0 0;font-size:14px;color:#a1a1aa;line-height:1.7;">
        ${leaderName}님이 ${name}님을 단체 관람에 초대했습니다.
      </p>

      <div style="margin-top:20px;padding:18px;background:#09090b;border:1px solid #27272a;border-radius:12px;">
        <div style="font-size:13px;color:#a1a1aa;line-height:1.8;">
          <div><strong style="color:#fafafa;">${movieTitle}</strong></div>
          <div>${movieDate}</div>
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid #27272a;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;letter-spacing:0.2em;color:#71717a;text-transform:uppercase;">SEAT</span>
          <span style="font-family:'Geist Mono',monospace;font-size:28px;font-weight:800;color:#34d399;letter-spacing:-0.01em;">${seat}</span>
        </div>
      </div>

      <div style="margin-top:18px;padding:14px 16px;background:#eab30810;border:1px solid #eab30833;border-radius:10px;font-size:13px;color:#fde047;line-height:1.6;">
        1시간 이내에 예매를 확정해야 단체 관람에 포함됩니다. 미응답 시 좌석은 자동으로 해제됩니다.
      </div>

      <div style="margin-top:22px;text-align:center;">
        ${btn(link, "예매 확정하러 가기", "emerald")}
      </div>
    </div>
  `;
  return emailShell(body, { accent: "emerald", preheader: `${seat} 좌석으로 단체 관람에 초대되었습니다.` });
}
