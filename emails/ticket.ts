import type { TicketStatusType } from "@/lib/api-types";
import { POPCORN_LABELS, POPCORN_PRICE, type PopcornFlavor } from "@/lib/db-types";
import { popcornBreakdown, popcornTotal, shortTicketId } from "@/lib/format";
import { btn, emailShell } from "./layout";

interface Args {
  name: string;
  seat: string;
  movieTitle: string;
  movieDate: string;
  statusType: TicketStatusType;
  popcorn?: string;
  ticketId: string;
  baseUrl: string;
  isRefundNeeded?: boolean;
}

const STATUS_COPY: Record<TicketStatusType, { tag: string; bg: string; fg: string; verb: string }> = {
  confirmed: { tag: "예매 완료", bg: "#10b98119", fg: "#34d399", verb: "예매가 확정되었습니다." },
  pending: { tag: "결제 대기", bg: "#eab30819", fg: "#fde047", verb: "30분 내로 입금을 완료해주세요." },
  changed: { tag: "좌석 변경", bg: "#38bdf819", fg: "#7dd3fc", verb: "좌석이 변경되었습니다." },
  canceled: { tag: "예매 취소", bg: "#f43f5e19", fg: "#fb7185", verb: "예매가 취소되었습니다." },
};

export function ticketSubject(name: string, seat: string, statusType: TicketStatusType): string {
  if (statusType === "canceled") return `[영화대교] ${name}님의 예매 취소 안내`;
  if (statusType === "changed") return `[영화대교] ${name}님의 좌석 변경 안내 - ${seat} 좌석`;
  return `[영화대교] ${name}님의 티켓 예매 안내 - ${seat} 좌석`;
}

export function ticketHtml(a: Args): string {
  const status = STATUS_COPY[a.statusType];
  const breakdown = popcornBreakdown(a.popcorn);
  const total = popcornTotal(a.popcorn);
  const accent = a.statusType === "canceled" ? "rose" : a.statusType === "pending" ? "amber" : a.statusType === "changed" ? "sky" : "emerald";

  const popcornRows = breakdown.length === 0
    ? `<div style="font-size:13px;color:#a1a1aa;">팝콘 없음 (음료/팝콘 미포함)</div>`
    : breakdown
        .map(
          (b) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#fafafa;padding:6px 0;">
              <span>${POPCORN_LABELS[b.flavor as PopcornFlavor]}</span>
              <span style="color:#a1a1aa;font-variant-numeric:tabular-nums;">×${b.count}</span>
            </div>`
        )
        .join("");

  const seatStyle = a.statusType === "canceled" ? "text-decoration:line-through;color:#71717a;" : "color:#f59e0b;";

  const priceLine = a.statusType === "confirmed" || (a.statusType === "changed" && total === 0)
    ? `<span style="color:#34d399;font-weight:700;">무료 관람 (0원)</span>`
    : a.statusType === "canceled"
      ? a.isRefundNeeded
        ? `<span style="color:#fb7185;font-weight:700;">팝콘 환불 필요 — 상영 당일 현장에서 수령</span>`
        : `<span style="color:#71717a;">결제 미완료 (환불 없음)</span>`
      : `<span style="color:#fbbf24;font-weight:700;font-variant-numeric:tabular-nums;">${total.toLocaleString("ko-KR")}원</span>`;

  const pendingBlock = a.statusType === "pending"
    ? `<div style="margin-top:20px;padding:18px;background:#eab30810;border:1px solid #eab30833;border-radius:10px;text-align:center;">
        <div style="font-size:13px;color:#fde047;font-weight:600;letter-spacing:0.02em;">30분 내 송금이 필요합니다</div>
        <div style="margin-top:14px;display:inline-block;background:#ffffff;padding:10px;border-radius:8px;">
          <img src="${a.baseUrl}/qr.jpeg" alt="QR" width="160" height="160" style="display:block;border-radius:4px;" />
        </div>
        <div style="margin-top:10px;font-size:12px;color:#a1a1aa;">QR을 스캔하여 ${total.toLocaleString("ko-KR")}원을 송금해주세요.</div>
      </div>`
    : "";

  const cancelLink = a.statusType !== "canceled"
    ? `<div style="margin-top:32px;padding:18px;border:1px dashed #3f3f46;border-radius:10px;text-align:center;">
        <div style="font-size:12px;color:#a1a1aa;margin-bottom:10px;">본인이 예매하지 않았거나 취소가 필요하신가요?</div>
        ${btn(`${a.baseUrl}/cancel?ticketId=${a.ticketId}`, "예매 취소 / 비밀번호 변경", "rose")}
      </div>`
    : "";

  const body = `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;box-shadow:0 12px 40px rgba(0,0,0,0.4);">
      <div style="display:inline-block;padding:4px 10px;background:${status.bg};color:${status.fg};border:1px solid ${status.fg}40;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.04em;">${status.tag}</div>
      <h1 style="margin:14px 0 4px 0;font-size:22px;color:#fafafa;letter-spacing:-0.01em;line-height:1.3;">${a.movieTitle}</h1>
      <div style="font-size:13px;color:#a1a1aa;">${a.movieDate}</div>

      <div style="margin-top:22px;padding:20px;background:#09090b;border:1px solid #27272a;border-radius:12px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-size:10px;letter-spacing:0.3em;color:#71717a;text-transform:uppercase;">SEAT</div>
          <div style="margin-top:6px;font-size:38px;font-weight:800;letter-spacing:-0.02em;${seatStyle};font-family:'Geist Mono',monospace;">${a.seat}</div>
          <div style="margin-top:6px;font-size:13px;color:#a1a1aa;">${a.name} 님</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;letter-spacing:0.3em;color:#71717a;text-transform:uppercase;">TICKET</div>
          <div style="margin-top:6px;font-family:'Geist Mono',monospace;font-size:14px;color:#fafafa;letter-spacing:0.1em;">${shortTicketId(a.ticketId)}</div>
        </div>
      </div>

      <div style="margin-top:22px;">
        <div style="font-size:11px;letter-spacing:0.2em;color:#71717a;text-transform:uppercase;margin-bottom:8px;">팝콘 / 결제</div>
        <div style="background:#09090b;border:1px solid #27272a;border-radius:10px;padding:14px 16px;">
          ${popcornRows}
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid #27272a;display:flex;justify-content:space-between;align-items:center;font-size:13px;">
            <span style="color:#a1a1aa;">결제</span>
            ${priceLine}
          </div>
        </div>
      </div>

      ${pendingBlock}

      <div style="margin-top:22px;padding:14px;background:#09090b;border:1px solid #27272a;border-radius:10px;font-size:13px;color:#fafafa;line-height:1.6;">
        ${status.verb}
      </div>

      ${cancelLink}
    </div>
  `;

  void POPCORN_PRICE;
  return emailShell(body, { accent, preheader: `${a.movieTitle} · ${a.seat} · ${status.tag}` });
}
