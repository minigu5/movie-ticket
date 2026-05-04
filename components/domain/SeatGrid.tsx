"use client";

import { useMemo } from "react";
import type { MovieSettings, SeatSummary } from "@/lib/db-types";
import { computeVipSeats, getHallShape, getSeatId, isAisleColumn } from "@/lib/seats";
import { Seat, type SeatVisualState } from "./Seat";

export interface SeatGridProps {
  movie: MovieSettings;
  reservations: Record<string, SeatSummary>;
  selectedSeat: string | null;
  groupMode?: boolean;
  groupLeaderSeat?: string | null;
  groupMemberSeats?: { seat: string; name: string }[];
  leaderName?: string;
  onSeatClick: (seatId: string, state: SeatVisualState, isVip: boolean) => void;
  isClosed?: boolean;
}

export function SeatGrid({
  movie,
  reservations,
  selectedSeat,
  groupMode,
  groupLeaderSeat,
  groupMemberSeats = [],
  leaderName,
  onSeatClick,
  isClosed,
}: SeatGridProps) {
  const shape = useMemo(() => getHallShape(movie.venue), [movie.venue]);
  const vipSeats = useMemo(() => computeVipSeats(movie, shape), [movie, shape]);
  const memberMap = useMemo(() => new Map(groupMemberSeats.map((m) => [m.seat, m.name])), [groupMemberSeats]);
  const aisleClass = shape.isGrand ? "mr-3 md:mr-6" : "mr-6 md:mr-10";

  return (
    <div className="w-full">
      <div className="md:hidden mb-3 text-center text-[11px] text-[var(--color-accent-soft)] animate-pulse">
        ← 가로로 스크롤하여 좌석을 확인하세요
      </div>
      <div className="relative w-full overflow-x-auto pb-6">
      {isClosed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-base)]/85 backdrop-blur-sm rounded-[var(--radius-lg)]">
          <div className="px-6 py-3 rounded-[var(--radius)] border-2 border-[var(--color-danger)] text-[var(--color-danger-soft)] font-semibold tracking-wider -rotate-3">
            예매가 마감되었습니다
          </div>
        </div>
      )}

      <div className="flex flex-col items-center min-w-max px-4 pt-2 mx-auto">
        <div
          className={[
            "w-[72%] h-9 md:h-10 rounded-t-[28px] mb-10 flex items-center justify-center",
            "border-t",
            groupMode
              ? "bg-[var(--color-success)]/55 border-[var(--color-success-soft)] shadow-[0_-14px_44px_rgba(16,185,129,0.35)]"
              : "bg-zinc-200/95 border-white/70 shadow-[0_-14px_44px_rgba(255,255,255,0.18)]",
          ].join(" ")}
        >
          <span
            className={`text-[11px] md:text-[12px] font-bold tracking-[0.5em] uppercase ${
              groupMode ? "text-[var(--color-bg-base)] animate-pulse" : "text-zinc-900"
            }`}
          >
            {groupMode ? "단체 예매 중" : "Screen"}
          </span>
        </div>

        {shape.rows.map((rowChar, rowIndex) => (
          <div
            key={rowChar}
            className={`flex items-center gap-1 md:gap-1.5 ${
              shape.isGrand && rowChar === "H" ? "mb-6 md:mb-10" : ""
            }`}
          >
            <span className="w-6 md:w-7 text-center text-[11px] md:text-[12px] font-medium text-[var(--color-text-muted)] font-mono">
              {rowChar}
            </span>
            <div className="flex gap-[3px] md:gap-1">
              {shape.cols.map((colNum, colIndex) => {
                const seatId = getSeatId(rowIndex, colIndex, shape.isGrand);
                const aisle = isAisleColumn(colNum, shape.isGrand);
                const aisleCls = aisle ? aisleClass : "";

                if (!seatId) {
                  return <Seat key={`p-${rowIndex}-${colIndex}`} state="phantom" label="" isGrand={shape.isGrand} className={aisleCls} />;
                }

                const isVip = vipSeats.has(seatId);
                const res = reservations[seatId];
                const isLeaderSeat = groupMode && groupLeaderSeat === seatId;
                const isMemberSeat = groupMode && memberMap.has(seatId);
                const isSelected = !groupMode && selectedSeat === seatId;

                let state: SeatVisualState;
                let label = seatId;

                if (isLeaderSeat) {
                  state = "group_leader";
                  label = leaderName ?? seatId;
                } else if (isMemberSeat) {
                  state = "group_member";
                  label = memberMap.get(seatId) ?? seatId;
                } else if (res) {
                  if (res.status === "confirmed") {
                    state = "confirmed";
                    label = res.name;
                  } else if (res.status === "pending") {
                    state = "pending";
                    label = res.name;
                  } else {
                    state = "group_pending";
                    label = res.name;
                  }
                } else if (isSelected) {
                  state = "selected";
                } else if (isVip) {
                  state = "vip";
                } else {
                  state = "empty";
                }

                return (
                  <Seat
                    key={seatId}
                    state={state}
                    label={label}
                    isGrand={shape.isGrand}
                    className={aisleCls}
                    onClick={() => onSeatClick(seatId, state, isVip)}
                    aria-label={`${seatId} 좌석`}
                  />
                );
              })}
            </div>
            <span className="w-6 md:w-7 text-center text-[11px] md:text-[12px] font-medium text-[var(--color-text-muted)] font-mono">
              {rowChar}
            </span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

export function SeatLegend({
  showGroupPending,
  showPending,
  showGroupColors,
}: {
  showGroupPending?: boolean;
  showPending?: boolean;
  showGroupColors?: boolean;
}) {
  const items: { dot: string; text: string }[] = [
    { dot: "bg-[var(--color-bg-overlay)] border border-[var(--color-border)]", text: "예매 가능" },
    { dot: "bg-[var(--color-vip)]/15 border border-[var(--color-vip)]/40", text: "동아리 전용" },
    { dot: "bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)]", text: "예매 완료" },
  ];
  if (showGroupPending) {
    items.push({ dot: "bg-[var(--color-info)]/10 border border-[var(--color-info)]/30", text: "단체 대기" });
  }
  if (showPending) {
    items.push({
      dot: "bg-[var(--color-warning)]/12 border border-[var(--color-warning)] animate-[pulse-slow_2.4s_ease-in-out_infinite]",
      text: "결제 대기",
    });
  }
  if (showGroupColors) {
    items.push({ dot: "bg-[var(--color-success)]", text: "리더 (나)" });
    items.push({ dot: "bg-[var(--color-info)]", text: "단체 멤버" });
  }

  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12px] text-[var(--color-text-secondary)]">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`w-3.5 h-3.5 rounded-[3px] ${it.dot}`} />
          <span>{it.text}</span>
        </div>
      ))}
    </div>
  );
}
