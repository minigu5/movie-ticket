import { emailShell } from "./layout";

export function blacklistSubject(name: string, action: "added" | "removed"): string {
  return action === "added"
    ? `[영화대교] ${name}님, 블랙리스트 등록 안내`
    : `[영화대교] ${name}님, 블랙리스트 해제 안내`;
}

export function blacklistHtml(name: string, action: "added" | "removed"): string {
  const accent = action === "added" ? "rose" : "emerald";
  const headline = action === "added" ? "예매 제한 안내" : "제한 해제 안내";
  const message = action === "added"
    ? `${name}님, 이전 관람 시 좌석 주변 정리 미흡 등 운영 정책 위반으로 향후 예매가 제한되었습니다. 자세한 사유는 동아리 운영진에게 문의 바랍니다.`
    : `${name}님, 예매 제한이 해제되어 다시 정상적으로 영화대교 정기 상영회를 예매하실 수 있습니다. 다음 상영회에서 만나뵙기를 기대합니다.`;
  const body = `
    <div style="background:#18181b;border:1px solid ${action === "added" ? "#f43f5e40" : "#10b98140"};border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 8px 0;font-size:20px;color:#fafafa;letter-spacing:-0.01em;">${headline}</h1>
      <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.7;">${message}</p>
    </div>
  `;
  return emailShell(body, { accent });
}
