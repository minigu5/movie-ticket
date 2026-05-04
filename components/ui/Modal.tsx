"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/icons";

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "danger";
  dismissible?: boolean;
  zIndex?: number;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  tone = "default",
  dismissible = true,
  zIndex,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // focus + body lock — fire ONLY when `open` flips, not on every parent rerender
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => dialogRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = original;
      clearTimeout(t);
    };
  }, [open]);

  // ESC handler — re-bound when handler identity changes, but doesn't steal focus
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!open || typeof document === "undefined") return null;

  const z = zIndex ?? 50;
  const borderTone =
    tone === "danger"
      ? "border-[var(--color-danger)]/40 shadow-[var(--shadow-glow-rose)]"
      : "border-[var(--color-border)]";

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: z }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible && onClose) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-[fade-in_220ms_ease-out_both]"
        aria-hidden
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={[
          "relative w-full bg-[var(--color-bg-elevated)] rounded-[var(--radius-lg)] border shadow-[var(--shadow-elev-2)]",
          "animate-[scale-in_220ms_ease-out_both]",
          sizeMap[size],
          borderTone,
        ].join(" ")}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-2">
            <div className="flex-1">
              {title && (
                <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {dismissible && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -m-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                aria-label="닫기"
              >
                <XIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="px-6 pb-6 pt-2">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/30 rounded-b-[var(--radius-lg)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
