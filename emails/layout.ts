/**
 * Shared email shell — cinematic dark theme.
 * Email clients render <style> inconsistently, so all critical styles are inlined.
 */

export interface EmailShellOptions {
  preheader?: string;
  accent?: "amber" | "emerald" | "rose" | "sky";
}

const accentMap = {
  amber: { hex: "#f59e0b", soft: "#fbbf24" },
  emerald: { hex: "#10b981", soft: "#34d399" },
  rose: { hex: "#f43f5e", soft: "#fb7185" },
  sky: { hex: "#38bdf8", soft: "#7dd3fc" },
};

export function emailShell(body: string, opts: EmailShellOptions = {}): string {
  const accent = accentMap[opts.accent ?? "amber"];
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>영화대교</title>
</head>
<body style="margin:0;padding:0;background:#09090b;color:#fafafa;font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;-webkit-font-smoothing:antialiased;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;">${opts.preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09090b;background-image:radial-gradient(800px circle at 0% 0%, rgba(245,158,11,0.06), transparent 50%);">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <div style="font-family:'Song Myung',Georgia,serif;font-size:28px;letter-spacing:0.1em;color:#fafafa;line-height:1;">영화대교</div>
              <div style="margin-top:6px;font-size:11px;letter-spacing:0.3em;color:${accent.soft};text-transform:uppercase;">cinema bridge</div>
            </td>
          </tr>
          <tr>
            <td>${body}</td>
          </tr>
          <tr>
            <td style="padding:32px 0 0 0;text-align:center;">
              <div style="font-size:11px;color:#71717a;letter-spacing:0.05em;">대구과학고등학교 자율동아리 영화대교</div>
              <div style="margin-top:4px;font-size:10px;color:#52525b;letter-spacing:0.2em;text-transform:uppercase;">Powered by Supabase &middot; Vercel</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function btn(href: string, label: string, color: "amber" | "emerald" | "rose" | "sky" = "amber"): string {
  const map = {
    amber: { bg: "#f59e0b", text: "#09090b" },
    emerald: { bg: "#10b981", text: "#09090b" },
    rose: { bg: "#f43f5e", text: "#ffffff" },
    sky: { bg: "#38bdf8", text: "#09090b" },
  };
  const c = map[color];
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;background:${c.bg};color:${c.text};text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;letter-spacing:0.02em;">${label}</a>`;
}
