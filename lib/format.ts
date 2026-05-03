import { POPCORN_LABELS, POPCORN_PRICE, type PopcornFlavor } from "./db-types";

export function parsePopcorn(order: string | null | undefined): PopcornFlavor[] {
  if (!order || order === "none") return [];
  return order
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PopcornFlavor => s in POPCORN_LABELS);
}

export function popcornTotal(order: string | null | undefined): number {
  return parsePopcorn(order).length * POPCORN_PRICE;
}

export function popcornBreakdown(order: string | null | undefined): { flavor: PopcornFlavor; count: number }[] {
  const items = parsePopcorn(order);
  const counts = new Map<PopcornFlavor, number>();
  for (const f of items) counts.set(f, (counts.get(f) ?? 0) + 1);
  return Array.from(counts.entries()).map(([flavor, count]) => ({ flavor, count }));
}

export function formatKRW(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

export function formatKstDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLogTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function shortTicketId(id: string): string {
  return (id.split("-")[0] ?? id).toUpperCase();
}
