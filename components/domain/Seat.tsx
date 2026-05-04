"use client";

import type { ButtonHTMLAttributes } from "react";

export type SeatVisualState =
  | "empty"
  | "vip"
  | "selected"
  | "confirmed"
  | "pending"
  | "group_pending"
  | "group_leader"
  | "group_member"
  | "phantom";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  state: SeatVisualState;
  label: string;
  isGrand: boolean;
}

const STATE_CLS: Record<SeatVisualState, string> = {
  empty:
    "bg-[var(--color-seat)] border border-[var(--color-seat-border)] text-zinc-200 hover:bg-[var(--color-seat-hover)] hover:border-[var(--color-seat-hover-border)]",
  vip:
    "bg-[var(--color-vip)]/12 border border-[var(--color-vip)]/35 text-[var(--color-vip-soft)] hover:bg-[var(--color-vip)]/22 hover:border-[var(--color-vip)]/55",
  selected:
    "bg-[var(--color-accent)] border border-[var(--color-accent)] text-[var(--color-bg-base)] -translate-y-[2px] shadow-[var(--shadow-glow-amber)] font-bold",
  confirmed:
    "bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-faint)] cursor-not-allowed",
  pending:
    "bg-[var(--color-warning)]/12 border border-[var(--color-warning)] text-[var(--color-warning)] cursor-not-allowed animate-[pulse-slow_2.4s_ease-in-out_infinite]",
  group_pending:
    "bg-[var(--color-info)]/8 border border-[var(--color-info)]/30 text-[var(--color-info-soft)] cursor-not-allowed opacity-80",
  group_leader:
    "bg-[var(--color-success)] border border-[var(--color-success)] text-[var(--color-bg-base)] -translate-y-[2px] shadow-[var(--shadow-glow-emerald)] font-bold",
  group_member:
    "bg-[var(--color-info)] border border-[var(--color-info)] text-[var(--color-bg-base)] -translate-y-[1px] font-bold",
  phantom: "invisible",
};

export function Seat({ state, label, isGrand, className, ...rest }: Props) {
  const size = isGrand
    ? "w-8 h-[36px] md:w-9 md:h-[40px]"
    : "w-10 h-[44px] md:w-11 md:h-[48px]";
  const text = isGrand
    ? "text-[10px] md:text-[11px]"
    : "text-[11px] md:text-[12.5px]";
  return (
    <button
      type="button"
      className={[
        size,
        text,
        "rounded-t-[8px] rounded-b-[3px] flex items-center justify-center",
        "transition-all duration-150 ease-out tracking-tight whitespace-nowrap overflow-hidden",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg-base)]",
        STATE_CLS[state],
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {state === "phantom" ? null : label}
    </button>
  );
}
