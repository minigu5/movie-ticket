"use client";

import { CrownIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";

interface Member {
  studentId: string;
  name: string;
  seat: string;
}

interface Props {
  leader: Member;
  members: Member[];
  onRemoveMember: (seat: string) => void;
}

export function GroupSummaryList({ leader, members, onRemoveMember }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] bg-[var(--color-success)]/8 border border-[var(--color-success)]/30">
        <CrownIcon className="w-5 h-5 text-[var(--color-success-soft)]" />
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            {leader.name}{" "}
            <span className="text-[11px] font-normal text-[var(--color-success-soft)]">리더</span>
          </div>
          <div className="text-[12px] text-[var(--color-text-muted)] font-mono">
            {leader.seat} · {leader.studentId}
          </div>
        </div>
      </div>
      {members.map((m, i) => (
        <div
          key={m.seat}
          className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] bg-[var(--color-info)]/6 border border-[var(--color-info)]/25"
        >
          <Badge tone="sky">{i + 1}</Badge>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">{m.name}</div>
            <div className="text-[12px] text-[var(--color-text-muted)] font-mono">
              {m.seat} · {m.studentId}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemoveMember(m.seat)}
            aria-label="멤버 제거"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger-soft)] hover:bg-[var(--color-danger)]/10 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
