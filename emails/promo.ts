import type { MovieSettings } from "@/lib/db-types";
import { formatKstDeadline } from "@/lib/format";
import { btn, emailShell } from "./layout";

export function promoSubject(name: string): string {
  return `[영화대교] ${name}님을 위한 특별 초청장이 도착했습니다.`;
}

export function promoHtml(name: string, studentId: string, movie: MovieSettings, baseUrl: string): string {
  const link = `${baseUrl}?invite=true&id=${encodeURIComponent(studentId)}&name=${encodeURIComponent(name)}`;
  const deadline = formatKstDeadline(movie.deadline_date);
  const poster = movie.poster_url
    ? `<div style="margin:24px 0;text-align:center;">
        <img src="${movie.poster_url}" alt="poster" width="220" style="display:inline-block;border-radius:12px;border:1px solid #27272a;box-shadow:0 12px 40px rgba(0,0,0,0.5);" />
      </div>`
    : "";

  const body = `
    <div style="background:#18181b;border:1px solid #f59e0b40;border-radius:16px;padding:32px;box-shadow:0 12px 50px rgba(245,158,11,0.12);">
      <div style="font-family:'Song Myung',Georgia,serif;font-size:14px;letter-spacing:0.3em;color:#fbbf24;text-transform:uppercase;text-align:center;">special invitation</div>
      <h1 style="margin:14px 0 0 0;font-size:24px;color:#fafafa;letter-spacing:-0.01em;text-align:center;">${name}님을 초대합니다</h1>
      <p style="margin:10px 0 0 0;font-size:14px;color:#a1a1aa;line-height:1.7;text-align:center;">
        이달의 명작 상영회에 모실 수 있어 영광입니다.<br/>
        오리지널 버터·콘소메·카라멜 팝콘을 함께 즐길 수 있도록 준비했습니다.
      </p>

      ${poster}

      <div style="margin-top:24px;background:#09090b;border-left:3px solid #f59e0b;border-radius:8px;padding:16px 18px;font-size:14px;line-height:1.8;color:#fafafa;">
        <div><strong style="color:#fbbf24;letter-spacing:0.02em;">${movie.title}</strong></div>
        <div style="color:#a1a1aa;">${movie.venue}</div>
        <div style="color:#a1a1aa;">${movie.date_string}</div>
      </div>

      <div style="margin-top:24px;text-align:center;">
        ${btn(link, "지금 좌석 예매하기", "amber")}
      </div>

      <p style="margin:20px 0 0 0;text-align:center;font-size:12px;color:#fb7185;letter-spacing:0.02em;">
        예매 마감 — ${deadline}
      </p>
    </div>
  `;
  return emailShell(body, { accent: "amber", preheader: `${name}님을 위한 ${movie.title} 초청장` });
}
