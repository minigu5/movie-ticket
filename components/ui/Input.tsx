"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  trailing?: ReactNode;
  align?: "left" | "center";
}

export function Input({
  label,
  helper,
  error,
  trailing,
  align = "left",
  className,
  id,
  ...rest
}: Props) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={fieldId}
          className="text-[12px] font-medium text-[var(--color-text-secondary)] tracking-wide uppercase"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={fieldId}
          className={[
            "w-full h-11 rounded-[var(--radius)] bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] px-3.5",
            "text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-faint)]",
            "transition-colors outline-none",
            "hover:border-[var(--color-border)]",
            "focus:border-[var(--color-accent)] focus:bg-[var(--color-bg-elevated)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error ? "border-[var(--color-danger)] focus:border-[var(--color-danger)]" : "",
            align === "center" ? "text-center" : "",
            trailing ? "pr-12" : "",
            className ?? "",
          ].join(" ")}
          {...rest}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-text-muted)]">
            {trailing}
          </div>
        )}
      </div>
      {error ? (
        <p className="text-[12px] text-[var(--color-danger-soft)]">{error}</p>
      ) : helper ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">{helper}</p>
      ) : null}
    </div>
  );
}
