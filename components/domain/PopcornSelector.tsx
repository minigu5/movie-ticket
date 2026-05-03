"use client";

import { POPCORN_LABELS, POPCORN_PRICE, type PopcornFlavor } from "@/lib/db-types";
import { formatKRW } from "@/lib/format";
import { PopcornIcon } from "@/components/icons";

interface Props {
  list: string[];
  onChange: (next: string[]) => void;
}

export function PopcornSelector({ list, onChange }: Props) {
  const handle = (idx: number, value: string) => {
    const updated = [...list];
    updated[idx] = value;
    const filtered = updated.filter((p) => p !== "none");
    filtered.push("none");
    onChange(filtered);
  };
  const total = list.filter((p) => p !== "none").length * POPCORN_PRICE;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <PopcornIcon className="w-4 h-4 text-[var(--color-accent-soft)]" />
        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">팝콘 선택</span>
        <span className="text-[11px] text-[var(--color-text-muted)]">개당 2,500원</span>
      </div>
      <div className="space-y-2">
        {list.map((pop, idx) => (
          <select
            key={idx}
            value={pop}
            onChange={(e) => handle(idx, e.target.value)}
            className="w-full h-10 rounded-[var(--radius-sm)] bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] px-3 text-[13.5px] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
          >
            <option value="none">
              {pop === "none" ? "+ 팝콘 추가하기" : "선택 취소"}
            </option>
            {(Object.keys(POPCORN_LABELS) as PopcornFlavor[]).map((k) => (
              <option key={k} value={k}>
                {POPCORN_LABELS[k]} (2,500원)
              </option>
            ))}
          </select>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        팝콘을 추가할수록 결제 대기로 전환됩니다. 음료는 배부하지 않습니다.
      </p>
      {total > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 px-3 py-2">
          <span className="text-[12px] font-medium text-[var(--color-accent-soft)]">결제 예정</span>
          <span className="text-[16px] font-bold text-[var(--color-accent-soft)] font-mono">{formatKRW(total)}</span>
        </div>
      )}
    </div>
  );
}
