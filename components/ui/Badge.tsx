import type { ReactNode } from "react";

type Tone = "neutral" | "amber" | "emerald" | "sky" | "yellow" | "rose" | "muted";

const toneMap: Record<Tone, string> = {
  neutral: "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]",
  amber: "bg-[var(--color-accent)]/12 text-[var(--color-accent-soft)] border-[var(--color-accent)]/40",
  emerald: "bg-[var(--color-success)]/12 text-[var(--color-success-soft)] border-[var(--color-success)]/40",
  sky: "bg-[var(--color-info)]/12 text-[var(--color-info-soft)] border-[var(--color-info)]/40",
  yellow: "bg-[var(--color-warning)]/12 text-[var(--color-warning)] border-[var(--color-warning)]/40",
  rose: "bg-[var(--color-danger)]/12 text-[var(--color-danger-soft)] border-[var(--color-danger)]/40",
  muted: "bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]",
};

export function Badge({
  tone = "neutral",
  children,
  leading,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium tracking-tight",
        toneMap[tone],
        className ?? "",
      ].join(" ")}
    >
      {leading}
      {children}
    </span>
  );
}
