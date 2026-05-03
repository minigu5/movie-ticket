import { emailShell } from "./layout";

export function groupReportSubject(confirmedCount: number): string {
  return `[영화대교] 단체 예매 최종 결과 안내 (${confirmedCount}명 확정)`;
}

export function groupReportHtml(args: {
  leaderName: string;
  movieTitle: string;
  movieDate: string;
  confirmed: { name: string; seat: string }[];
  expired: { name: string; seat: string }[];
}): string {
  const { leaderName, movieTitle, movieDate, confirmed, expired } = args;
  const allOk = expired.length === 0;
  const headline = allOk ? "단체 예매 전원 확정" : "단체 예매 결과";

  const confirmedList = confirmed
    .map(
      (c) =>
        `<div style="display:flex;justify-content:space-between;font-size:13px;color:#fafafa;padding:6px 0;border-top:1px solid #27272a;">
          <span>${c.name}</span><span style="font-family:'Geist Mono',monospace;color:#34d399;">${c.seat}</span>
        </div>`
    )
    .join("");

  const expiredList = expired.length === 0
    ? ""
    : `<div style="margin-top:18px;padding:16px;background:#f43f5e10;border:1px solid #f43f5e33;border-radius:10px;">
        <div style="font-size:11px;letter-spacing:0.2em;color:#fb7185;text-transform:uppercase;margin-bottom:8px;">취소된 멤버</div>
        ${expired
          .map(
            (e) =>
              `<div style="display:flex;justify-content:space-between;font-size:13px;color:#a1a1aa;padding:4px 0;">
                <span>${e.name}</span><span style="font-family:'Geist Mono',monospace;text-decoration:line-through;color:#71717a;">${e.seat}</span>
              </div>`
          )
          .join("")}
      </div>`;

  const body = `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 4px 0;font-size:22px;color:#fafafa;letter-spacing:-0.01em;">${headline}</h1>
      <p style="margin:6px 0 0 0;font-size:13px;color:#a1a1aa;">${leaderName}님의 단체 — ${movieTitle} · ${movieDate}</p>
      <div style="margin-top:20px;padding:16px;background:#10b98110;border:1px solid #10b98133;border-radius:10px;">
        <div style="font-size:11px;letter-spacing:0.2em;color:#34d399;text-transform:uppercase;margin-bottom:4px;">확정 인원 ${confirmed.length}명</div>
        ${confirmedList}
      </div>
      ${expiredList}
    </div>
  `;
  return emailShell(body, { accent: allOk ? "emerald" : "rose" });
}

export function groupCancelSubject(name: string): string {
  return `[영화대교] ${name}님의 단체 예매가 시간 초과로 취소되었습니다`;
}

export function groupCancelHtml(args: { name: string; seat: string; leaderName: string; movieTitle: string }): string {
  const { name, seat, leaderName, movieTitle } = args;
  const body = `
    <div style="background:#18181b;border:1px solid #f43f5e40;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 4px 0;font-size:22px;color:#fafafa;letter-spacing:-0.01em;">예매가 취소되었습니다</h1>
      <p style="margin:8px 0 0 0;font-size:14px;color:#a1a1aa;line-height:1.7;">
        ${name}님, ${leaderName}님이 초대한 ${movieTitle} 단체 관람 초대를 1시간 이내에 응답하지 않아 좌석이 해제되었습니다.
      </p>
      <div style="margin-top:20px;padding:18px;background:#09090b;border:1px dashed #f43f5e40;border-radius:12px;text-align:center;">
        <div style="font-size:11px;letter-spacing:0.2em;color:#71717a;text-transform:uppercase;">SEAT</div>
        <div style="margin-top:6px;font-family:'Geist Mono',monospace;font-size:36px;font-weight:800;color:#71717a;text-decoration:line-through;">${seat}</div>
        <div style="margin-top:6px;font-size:12px;color:#fb7185;">예매 취소됨</div>
      </div>
    </div>
  `;
  return emailShell(body, { accent: "rose" });
}
