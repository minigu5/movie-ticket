"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "success" | "danger" | "ghost" | "outline" | "info";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const sizeMap: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5",
  md: "h-11 px-4 text-[14px] gap-2",
  lg: "h-13 px-5 text-[15px] gap-2.5",
};

const variantMap: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-bg-base)] border border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] hover:shadow-[var(--shadow-glow-amber)] active:translate-y-px disabled:opacity-50 disabled:hover:bg-[var(--color-accent)] disabled:shadow-none",
  success:
    "bg-[var(--color-success)] text-[var(--color-bg-base)] border border-[var(--color-success)] hover:bg-[var(--color-success-soft)] hover:shadow-[var(--shadow-glow-emerald)] active:translate-y-px disabled:opacity-50",
  info:
    "bg-[var(--color-info)] text-[var(--color-bg-base)] border border-[var(--color-info)] hover:bg-[var(--color-info-soft)] active:translate-y-px disabled:opacity-50",
  danger:
    "bg-[var(--color-danger)] text-white border border-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:shadow-[var(--shadow-glow-rose)] active:translate-y-px disabled:opacity-50",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] disabled:opacity-50",
  outline:
    "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-overlay)] hover:border-[var(--color-border-strong)] disabled:opacity-50",
};

export function Button({
  variant = "primary",
  size = "md",
  leading,
  trailing,
  loading,
  fullWidth,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center font-semibold tracking-tight rounded-[var(--radius)] transition-all duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]",
        sizeMap[size],
        variantMap[variant],
        fullWidth ? "w-full" : "",
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
      ) : leading}
      <span>{children}</span>
      {trailing}
    </button>
  );
}
