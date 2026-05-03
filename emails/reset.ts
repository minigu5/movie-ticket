import { btn, emailShell } from "./layout";

export function resetSubject(name: string): string {
  return `[영화대교] ${name}님, 비밀번호 재설정 안내`;
}

export function resetHtml(name: string, link: string): string {
  const body = `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 4px 0;font-size:22px;color:#fafafa;letter-spacing:-0.01em;">비밀번호 재설정</h1>
      <p style="margin:8px 0 0 0;font-size:14px;color:#a1a1aa;line-height:1.7;">
        ${name}님, 영화대교 예매 시스템 비밀번호 재설정 요청을 받았습니다.
        아래 버튼은 <strong style="color:#fbbf24;">30분 동안</strong>만 유효합니다.
      </p>
      <div style="margin-top:24px;text-align:center;">
        ${btn(link, "비밀번호 재설정", "amber")}
      </div>
      <p style="margin:24px 0 0 0;font-size:12px;color:#71717a;line-height:1.7;">
        본인이 요청하지 않았다면 이 메일을 무시해 주세요. 다른 사람이 본인의 비밀번호를 변경할 수 없습니다.
      </p>
    </div>
  `;
  return emailShell(body, { accent: "amber", preheader: "비밀번호 재설정 링크가 도착했습니다." });
}
