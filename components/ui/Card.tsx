import type { HTMLAttributes, ReactNode } from "react";

type Tone = "default" | "warm" | "danger" | "success" | "info" | "muted";

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const toneMap: Record<Tone, string> = {
  default: "bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)]",
  warm: "bg-[var(--color-bg-elevated)] border-[var(--color-accent)]/30",
  danger: "bg-[var(--color-danger)]/5 border-[var(--color-danger)]/30",
  success: "bg-[var(--color-success)]/5 border-[var(--color-success)]/30",
  info: "bg-[var(--color-info)]/5 border-[var(--color-info)]/30",
  muted: "bg-[var(--color-bg-input)] border-[var(--color-border-subtle)]",
};

const padMap = { none: "", sm: "p-4", md: "p-5", lg: "p-7" };

export function Card({ tone = "default", padding = "md", className, children, ...rest }: Props) {
  return (
    <div
      className={[
        "rounded-[var(--radius-lg)] border shadow-[var(--shadow-elev-1)]",
        toneMap[tone],
        padMap[padding],
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
